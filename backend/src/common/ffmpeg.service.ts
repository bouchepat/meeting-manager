import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  /**
   * Convert audio file to M4A (AAC codec in MP4 container)
   * Optimized for voice recordings
   */
  async convertToM4A(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, '.m4a');

    this.logger.log(`Converting ${path.basename(inputPath)} to M4A...`);

    try {
      // FFmpeg command optimized for voice recordings:
      // -i: input file
      // -c:a aac: use AAC codec
      // -b:a 64k: 64kbps bitrate (good for voice, smaller files)
      // -ac 1: mono audio (voice recordings don't need stereo)
      // -ar 44100: sample rate
      // -y: overwrite output file if exists
      const command = `ffmpeg -i "${inputPath}" -c:a aac -b:a 64k -ac 1 -ar 44100 -y "${outputPath}"`;

      const { stdout, stderr } = await execPromise(command);

      if (stderr && !stderr.includes('time=')) {
        this.logger.warn(`FFmpeg warnings: ${stderr}`);
      }

      // Verify output file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error('Conversion failed: output file not created');
      }

      const stats = fs.statSync(outputPath);
      this.logger.log(
        `Conversion successful: ${path.basename(outputPath)} (${stats.size} bytes)`,
      );

      // Delete original file after successful conversion
      try {
        fs.unlinkSync(inputPath);
        this.logger.log(`Deleted original file: ${path.basename(inputPath)}`);
      } catch (error) {
        this.logger.warn(`Failed to delete original file: ${error.message}`);
      }

      return outputPath;
    } catch (error) {
      this.logger.error(`FFmpeg conversion failed: ${error.message}`);
      this.logger.error(`Command output: ${error.stdout}`);
      this.logger.error(`Command error: ${error.stderr}`);

      // Clean up output file if it exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      throw new Error(`Audio conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert audio file to FLAC format for Google Speech API
   * FLAC is well-supported by Google Speech-to-Text
   */
  async convertToFlac(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, '.flac');

    this.logger.log(`Converting ${path.basename(inputPath)} to FLAC for speech recognition...`);

    try {
      // FFmpeg command for FLAC conversion:
      // -i: input file
      // -ar 16000: 16kHz sample rate (optimal for speech recognition)
      // -ac 1: mono audio
      // -c:a flac: FLAC codec
      // -y: overwrite output file if exists
      const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a flac -y "${outputPath}"`;

      const { stderr } = await execPromise(command);

      if (stderr && !stderr.includes('time=')) {
        this.logger.warn(`FFmpeg warnings: ${stderr}`);
      }

      // Verify output file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error('Conversion failed: output file not created');
      }

      const stats = fs.statSync(outputPath);
      this.logger.log(
        `FLAC conversion successful: ${path.basename(outputPath)} (${stats.size} bytes)`,
      );

      return outputPath;
    } catch (error) {
      this.logger.error(`FFmpeg FLAC conversion failed: ${error.message}`);

      // Clean up output file if it exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      throw new Error(`Audio conversion to FLAC failed: ${error.message}`);
    }
  }

  /**
   * Convert audio file to WAV format for compatibility with various speech APIs
   */
  async convertToWav(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, '.wav');

    this.logger.log(`Converting ${path.basename(inputPath)} to WAV...`);

    try {
      // FFmpeg command for WAV conversion:
      // -i: input file
      // -ar 16000: 16kHz sample rate (optimal for speech recognition)
      // -ac 1: mono audio
      // -c:a pcm_s16le: 16-bit PCM
      // -y: overwrite output file if exists
      const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le -y "${outputPath}"`;

      const { stderr } = await execPromise(command);

      if (stderr && !stderr.includes('time=')) {
        this.logger.warn(`FFmpeg warnings: ${stderr}`);
      }

      // Verify output file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error('Conversion failed: output file not created');
      }

      const stats = fs.statSync(outputPath);
      this.logger.log(
        `WAV conversion successful: ${path.basename(outputPath)} (${stats.size} bytes)`,
      );

      return outputPath;
    } catch (error) {
      this.logger.error(`FFmpeg WAV conversion failed: ${error.message}`);

      // Clean up output file if it exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      throw new Error(`Audio conversion to WAV failed: ${error.message}`);
    }
  }

  /**
   * Get audio file information using ffprobe
   */
  async getAudioInfo(filePath: string): Promise<any> {
    try {
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
      const { stdout } = await execPromise(command);
      return JSON.parse(stdout);
    } catch (error) {
      this.logger.error(`FFprobe failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if ffmpeg is available
   */
  async checkFfmpegAvailable(): Promise<boolean> {
    try {
      await execPromise('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }
}
