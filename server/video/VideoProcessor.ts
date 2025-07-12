import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

export interface VideoProcessResult {
  success: boolean;
  duration?: number;
  transcript?: string;
  error?: string;
}

export class VideoProcessor {
  private static readonly UPLOAD_DIR = 'uploads/videos';
  private static readonly TEMP_DIR = '/tmp/video_processing';

  static async initialize() {
    // Create upload directory if it doesn't exist
    try {
      await mkdir(this.UPLOAD_DIR, { recursive: true });
      await mkdir(this.TEMP_DIR, { recursive: true });
    } catch (error) {
      console.log('Directories already exist or created');
    }
  }

  static async processVideo(filePath: string): Promise<VideoProcessResult> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Video file not found: ${filePath}`);
      }
      
      // Get video duration first
      const duration = await this.getVideoDuration(filePath);
      
      // Calculate dynamic timeout based on video duration
      // Tiny model: ~6x realtime speed, add buffer for safety
      const transcriptionTimeout = Math.max(
        60000, // Minimum 1 minute
        Math.min(
          600000, // Maximum 10 minutes
          duration * 10 * 1000 // 10x video duration in milliseconds
        )
      );
      
      console.log(`Video duration: ${duration}s, timeout set to: ${transcriptionTimeout/1000}s`);
      
      // Extract audio using FFmpeg
      const audioPath = await this.extractAudio(filePath, duration);
      
      try {
        // Transcribe using Whisper with dynamic timeout
        const transcript = await this.transcribeAudio(audioPath, transcriptionTimeout);
        
        return {
          success: true,
          duration,
          transcript: transcript || '' // Ensure we always return a string
        };
      } finally {
        // Always cleanup temporary audio file
        await this.cleanup(audioPath);
      }
    } catch (error) {
      console.error('Video processing error:', error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('ffmpeg') || error.message.includes('FFmpeg')) {
          return {
            success: false,
            error: 'FFmpeg not installed. Please install FFmpeg to process videos.'
          };
        }
        if (error.message.includes('whisper') || error.message.includes('Whisper')) {
          return {
            success: false,
            error: 'Whisper not installed. Please install OpenAI Whisper to transcribe videos.'
          };
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        filePath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to get video duration'));
          return;
        }

        try {
          const metadata = JSON.parse(output);
          const duration = parseFloat(metadata.format.duration);
          resolve(duration);
        } catch (error) {
          reject(new Error('Failed to parse video metadata'));
        }
      });

      // Timeout để tránh treo nếu video bị hỏng
      setTimeout(() => {
        ffprobe.kill();
        reject(new Error('Video duration check timeout'));
      }, 30000);
    });
  }

  private static async extractAudio(videoPath: string, videoDuration?: number): Promise<string> {
    const audioPath = path.join(this.TEMP_DIR, `audio_${Date.now()}.wav`);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-ac', '1', // mono
        '-ar', '16000', // 16kHz sample rate for Whisper
        '-vn', // no video
        '-f', 'wav',
        '-acodec', 'pcm_s16le', // Simple PCM encoding for faster processing
        '-y', // overwrite
        audioPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to extract audio'));
          return;
        }
        resolve(audioPath);
      });

      ffmpeg.stderr.on('data', (data) => {
        // Log FFmpeg progress but don't reject
        console.log(`FFmpeg: ${data}`);
      });

      // Dynamic timeout based on video duration
      const audioTimeout = videoDuration 
        ? Math.min(videoDuration * 2 * 1000, 600000) // 2x duration, max 10 min
        : 300000; // Default 5 minutes
        
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Audio extraction timeout'));
      }, audioTimeout);
    });
  }

  private static async transcribeAudio(audioPath: string, timeout: number = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      // Escape the audio path properly for Python
      const escapedPath = audioPath.replace(/'/g, "\\'");
      
      const whisper = spawn('python3', ['-c', `
import whisper
import sys
import signal
import os
import warnings
warnings.filterwarnings("ignore")

def timeout_handler(signum, frame):
    print("Transcription timeout", file=sys.stderr)
    sys.exit(1)

# Only use signal on Unix systems
if hasattr(signal, 'SIGALRM'):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(${Math.floor(timeout/1000)})  # Dynamic timeout in seconds

try:
    # Check if file exists
    if not os.path.exists('${escapedPath}'):
        print(f"Audio file not found: ${escapedPath}", file=sys.stderr)
        sys.exit(1)
        
    # Use tiny model for much faster processing
    model = whisper.load_model("tiny")
    
    # Optimize transcription parameters for speed
    result = model.transcribe(
        '${escapedPath}', 
        language="vi",
        fp16=False,  # Disable FP16 for CPU compatibility
        verbose=False,  # Reduce output
        task="transcribe",  # Skip translation
        best_of=1,  # Reduce beam search for speed
        beam_size=1,  # Minimal beam size for fastest processing
        patience=1.0,  # Reduce patience
        length_penalty=1.0,
        suppress_tokens="-1",  # Don't suppress any tokens
        condition_on_previous_text=False,  # Faster processing
        compression_ratio_threshold=2.4,
        logprob_threshold=-1.0,
        no_speech_threshold=0.6
    )
    
    # Ensure we have text
    if result and "text" in result:
        print(result["text"])
    else:
        print("", file=sys.stderr)  # Empty transcript
        
    if hasattr(signal, 'SIGALRM'):
        signal.alarm(0)  # Cancel timeout
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`]);

      let transcript = '';
      let error = '';

      whisper.stdout.on('data', (data) => {
        transcript += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        error += data.toString();
      });

      whisper.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper failed: ${error}`));
          return;
        }
        resolve(transcript.trim());
      });

      // Use the same timeout as Python
      setTimeout(() => {
        whisper.kill();
        reject(new Error('Transcription timeout'));
      }, timeout);
    });
  }

  private static async cleanup(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      console.log('Cleanup error (non-critical):', error);
    }
  }

  static async saveVideoFile(file: Express.Multer.File): Promise<string> {
    const fileName = `video_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(this.UPLOAD_DIR, fileName);
    
    try {
      // Ensure directory exists
      await mkdir(this.UPLOAD_DIR, { recursive: true });
      
      // Write file directly to avoid cross-device link issues
      await writeFile(filePath, file.buffer);
      
      // Verify file was written
      if (!fs.existsSync(filePath)) {
        throw new Error('Failed to save video file');
      }
      
      return filePath;
    } catch (error) {
      console.error('Failed to save video file:', error);
      throw error;
    }
  }

  static async deleteVideo(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      console.log('Video deletion error:', error);
    }
  }
}