# Diarization Service with pyannote.audio (NVIDIA GPU support)
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

WORKDIR /app

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/bin/python

# Install PyTorch 2.4.x (last version with weights_only=False default)
# PyTorch 2.5+ and 2.6 default to weights_only=True which breaks pyannote models
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cu121 \
    torch==2.4.1+cu121 \
    torchaudio==2.4.1+cu121

# Copy requirements (without torch) for caching
COPY requirements.txt .

# Install remaining dependencies WITH constraint to keep torch version
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Expose port
EXPOSE 5000

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "300", "--workers", "1", "app:app"]
