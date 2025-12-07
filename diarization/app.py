"""
Speaker Diarization Service using pyannote.audio
Provides a REST API for speaker diarization
"""

import os
import tempfile
import logging

# Patch torch.load BEFORE importing pyannote to fix weights_only issue in PyTorch 2.6+
import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

from flask import Flask, request, jsonify
from pyannote.audio import Pipeline
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize pyannote pipeline
pipeline = None

def get_pipeline():
    global pipeline
    if pipeline is None:
        hf_token = os.getenv('HUGGINGFACE_TOKEN')
        if not hf_token:
            raise ValueError('HUGGINGFACE_TOKEN environment variable required')

        logger.info('Loading pyannote speaker diarization pipeline (v4.x)...')
        # pyannote.audio 4.x uses 'token' parameter (not 'use_auth_token')
        pipeline = Pipeline.from_pretrained(
            'pyannote/speaker-diarization-3.1',
            token=hf_token
        )

        # Use GPU if available
        import torch
        if torch.cuda.is_available():
            pipeline.to(torch.device('cuda'))
            logger.info('Using GPU for diarization')
        else:
            logger.info('Using CPU for diarization')

    return pipeline


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


@app.route('/diarize', methods=['POST'])
def diarize():
    """
    Diarize an audio file

    Expects:
    - file: Audio file (multipart/form-data)
    OR
    - file_path: Path to audio file on shared volume (JSON)

    Returns:
    - segments: List of {speaker, start, end} objects
    """
    try:
        pipe = get_pipeline()

        audio_path = None
        temp_file = None

        # Check if file was uploaded
        if 'file' in request.files:
            file = request.files['file']
            # Save to temp file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            file.save(temp_file.name)
            audio_path = temp_file.name
            logger.info(f'Processing uploaded file: {file.filename}')

        # Check if file path was provided
        elif request.is_json and 'file_path' in request.json:
            audio_path = request.json['file_path']
            logger.info(f'Processing file from path: {audio_path}')

            if not os.path.exists(audio_path):
                return jsonify({'error': f'File not found: {audio_path}'}), 404

        else:
            return jsonify({'error': 'No file or file_path provided'}), 400

        # Run diarization
        logger.info('Running speaker diarization...')
        diarization_result = pipe(audio_path)

        # Convert to list of segments
        # Handle both pyannote 3.x (Annotation) and 4.x (DiarizeOutput) return types
        segments = []

        # Try to get the annotation object
        if hasattr(diarization_result, 'speaker_diarization'):
            # pyannote 4.x - DiarizeOutput with speaker_diarization attribute
            annotation = diarization_result.speaker_diarization
        elif hasattr(diarization_result, 'annotation'):
            # Alternative pyannote 4.x wrapper
            annotation = diarization_result.annotation
        elif hasattr(diarization_result, 'itertracks'):
            # pyannote 3.x - direct Annotation object
            annotation = diarization_result
        else:
            # Log available attributes for debugging
            logger.warning(f'Unknown diarization result type: {type(diarization_result)}')
            logger.warning(f'Available attributes: {dir(diarization_result)}')
            raise ValueError(f'Unsupported diarization result type: {type(diarization_result)}')

        for turn, _, speaker in annotation.itertracks(yield_label=True):
            segments.append({
                'speaker': speaker,
                'start': turn.start,
                'end': turn.end,
            })

        logger.info(f'Diarization complete: {len(segments)} segments, {len(set(s["speaker"] for s in segments))} speakers')

        # Clean up temp file
        if temp_file:
            os.unlink(temp_file.name)

        return jsonify({
            'segments': segments,
            'num_speakers': len(set(s['speaker'] for s in segments)),
        })

    except Exception as e:
        logger.error(f'Diarization failed: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/diarize-with-whisper', methods=['POST'])
def diarize_with_whisper():
    """
    Combine Whisper transcription segments with speaker diarization

    Expects JSON:
    - file_path: Path to audio file
    - whisper_segments: List of {start, end, text} from Whisper

    Returns:
    - segments: List of {speaker, start, end, text} objects
    """
    try:
        if not request.is_json:
            return jsonify({'error': 'JSON body required'}), 400

        data = request.json
        file_path = data.get('file_path')
        whisper_segments = data.get('whisper_segments', [])

        if not file_path:
            return jsonify({'error': 'file_path required'}), 400

        if not os.path.exists(file_path):
            return jsonify({'error': f'File not found: {file_path}'}), 404

        pipe = get_pipeline()

        # Run diarization
        logger.info('Running speaker diarization...')
        diarization_result = pipe(file_path)

        # Handle both pyannote 3.x (Annotation) and 4.x (DiarizeOutput) return types
        if hasattr(diarization_result, 'speaker_diarization'):
            annotation = diarization_result.speaker_diarization
        elif hasattr(diarization_result, 'annotation'):
            annotation = diarization_result.annotation
        elif hasattr(diarization_result, 'itertracks'):
            annotation = diarization_result
        else:
            raise ValueError(f'Unsupported diarization result type: {type(diarization_result)}')

        # Build speaker timeline
        speaker_timeline = []
        for turn, _, speaker in annotation.itertracks(yield_label=True):
            speaker_timeline.append({
                'speaker': speaker,
                'start': turn.start,
                'end': turn.end,
            })

        # Assign speakers to Whisper segments
        result_segments = []
        for ws in whisper_segments:
            ws_start = ws.get('start', 0)
            ws_end = ws.get('end', 0)
            ws_mid = (ws_start + ws_end) / 2

            # Find the speaker at the midpoint of this segment
            speaker = 'SPEAKER_00'  # Default
            for st in speaker_timeline:
                if st['start'] <= ws_mid <= st['end']:
                    speaker = st['speaker']
                    break

            result_segments.append({
                'speaker': speaker,
                'start': ws_start,
                'end': ws_end,
                'text': ws.get('text', ''),
            })

        # Get unique speakers and create mapping (SPEAKER_00 -> 1, etc.)
        unique_speakers = sorted(set(s['speaker'] for s in result_segments))
        speaker_map = {sp: i + 1 for i, sp in enumerate(unique_speakers)}

        # Convert speaker names to numbers
        for seg in result_segments:
            seg['speakerTag'] = speaker_map.get(seg['speaker'], 1)

        logger.info(f'Combined {len(result_segments)} segments with {len(unique_speakers)} speakers')

        return jsonify({
            'segments': result_segments,
            'num_speakers': len(unique_speakers),
            'speaker_map': speaker_map,
        })

    except Exception as e:
        logger.error(f'Diarization failed: {str(e)}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
