import { videoStorage } from './VideoStorage.js';
import { VideoProcessor } from './VideoProcessor.js';
import { vectorService } from '../services/vectorService.js';
import type { InsertVideo, Video, TranscriptChunk } from '../../shared/schema.js';

export interface VideoWithChunks extends Video {
  transcriptChunks: TranscriptChunk[];
}

export interface TranscriptSearchResult {
  videoId: number;
  videoTitle: string;
  chunks: Array<{
    text: string;
    relevanceScore: number;
  }>;
}

export class VideoService {
  static async createVideoWithChunks(videoData: InsertVideo): Promise<Video> {
    try {
      // Create video record
      const video = await videoStorage.createVideo(videoData);
      
      // Create transcript chunks if transcript exists and is not empty
      if (videoData.transcript && videoData.transcript.trim().length > 0 && videoData.duration > 0) {
        const chunks = this.createTranscriptChunks(
          video.id, 
          videoData.transcript, 
          videoData.duration
        );
        
        if (chunks.length > 0) {
          try {
            const createdChunks = await videoStorage.createTranscriptChunks(chunks);
            
            // Process transcript chunks into vectors for semantic search
            if (createdChunks.length > 0) {
              await vectorService.processVideoTranscriptChunks(video.id, video.subjectId, createdChunks);
            }
          } catch (error) {
            console.error('Failed to create transcript chunks or vectors:', error);
            // Don't fail the whole operation if vector creation fails
          }
        }
      }
      
      return video;
    } catch (error) {
      console.error('Failed to create video with chunks:', error);
      throw error;
    }
  }

  static async getVideoWithChunks(videoId: number): Promise<VideoWithChunks | null> {
    const video = await videoStorage.getVideo(videoId);
    if (!video) return null;
    
    const transcriptChunks = await videoStorage.getTranscriptChunks(videoId);
    
    return {
      ...video,
      transcriptChunks
    };
  }

  static async getVideosBySubject(subjectId: number): Promise<Video[]> {
    return await videoStorage.getVideosBySubject(subjectId);
  }

  static async deleteVideo(videoId: number): Promise<void> {
    // Get video info for file cleanup
    const video = await videoStorage.getVideo(videoId);
    if (video) {
      // Delete physical video file
      await VideoProcessor.deleteVideo(video.filePath);
    }
    
    // Delete vectors from LanceDB
    await vectorService.deleteVideoVectors(videoId);
    
    // Delete from database (cascades to chunks)
    await videoStorage.deleteVideo(videoId);
  }

  static async searchTranscripts(
    query: string, 
    subjectId?: number
  ): Promise<TranscriptSearchResult[]> {
    // Use semantic vector search for better results
    const vectorResults = await vectorService.searchVideoTranscripts(query, subjectId, 10);
    
    if (vectorResults.length === 0) {
      return [];
    }
    
    // Group results by video
    const videoGroups = new Map<number, any[]>();
    
    for (const result of vectorResults) {
      if (!videoGroups.has(result.videoId)) {
        videoGroups.set(result.videoId, []);
      }
      videoGroups.get(result.videoId)!.push(result);
    }
    
    // Build final results with video metadata
    const finalResults: TranscriptSearchResult[] = [];
    
    for (const [videoId, chunks] of videoGroups) {
      const video = await videoStorage.getVideo(videoId);
      if (video) {
        const sortedChunks = chunks
          .map(chunk => ({
            text: chunk.text,
            relevanceScore: chunk.score || 0
          }))
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        finalResults.push({
          videoId: video.id,
          videoTitle: video.title,
          chunks: sortedChunks
        });
      }
    }
    
    // Sort by highest relevance score per video
    return finalResults.sort((a, b) => 
      Math.max(...b.chunks.map(c => c.relevanceScore)) - 
      Math.max(...a.chunks.map(c => c.relevanceScore))
    );
  }

  private static createTranscriptChunks(
    videoId: number, 
    transcript: string, 
    duration: number
  ) {
    // Validate inputs
    if (!transcript || transcript.trim().length === 0) {
      return [];
    }
    
    // Split transcript into sentences with better Vietnamese support
    const sentences = transcript
      .split(/[.!?。！？]+/)  // Support Vietnamese and other punctuation
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (sentences.length === 0) return [];
    
    const chunks = [];
    let chunkIndex = 0;
    
    // Group sentences into chunks of ~10 sentences each for semantic coherence
    const sentencesPerChunk = 10;
    
    for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
      const chunkSentences = sentences.slice(i, i + sentencesPerChunk);
      
      const chunkText = chunkSentences.join('. ').trim();
      if (chunkText.length > 0) {
        chunks.push({
          videoId,
          startTime: 0, // Timestamp removed but kept for schema compatibility
          endTime: 0,   // Timestamp removed but kept for schema compatibility
          text: chunkText + (chunkText.endsWith('.') ? '' : '.'),
          chunkIndex
        });
        
        chunkIndex++;
      }
    }
    
    return chunks;
  }

  private static calculateRelevanceScore(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Simple scoring based on exact matches and word frequency
    const exactMatches = (textLower.match(new RegExp(queryLower, 'g')) || []).length;
    const words = queryLower.split(' ');
    const wordMatches = words.reduce((count, word) => 
      count + (textLower.includes(word) ? 1 : 0), 0
    );
    
    return exactMatches * 10 + wordMatches * 2;
  }
}