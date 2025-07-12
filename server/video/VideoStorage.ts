import { db } from '../db.js';
import { videos, transcriptChunks } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import type { 
  Video, 
  InsertVideo, 
  TranscriptChunk, 
  InsertTranscriptChunk 
} from '../../shared/schema.js';

export interface IVideoStorage {
  // Video operations
  createVideo(video: InsertVideo): Promise<Video>;
  getVideo(id: number): Promise<Video | undefined>;
  getVideosBySubject(subjectId: number): Promise<Video[]>;
  deleteVideo(id: number): Promise<void>;
  
  // Transcript chunk operations
  createTranscriptChunks(chunks: InsertTranscriptChunk[]): Promise<TranscriptChunk[]>;
  getTranscriptChunks(videoId: number): Promise<TranscriptChunk[]>;
  deleteTranscriptChunksByVideoId(videoId: number): Promise<void>;
}

export class VideoStorage implements IVideoStorage {
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(insertVideo).returning();
    return video;
  }

  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async getVideosBySubject(subjectId: number): Promise<Video[]> {
    return await db.select().from(videos).where(eq(videos.subjectId, subjectId));
  }

  async deleteVideo(id: number): Promise<void> {
    // Delete transcript chunks first
    await this.deleteTranscriptChunksByVideoId(id);
    
    // Delete video
    await db.delete(videos).where(eq(videos.id, id));
  }

  async createTranscriptChunks(chunks: InsertTranscriptChunk[]): Promise<TranscriptChunk[]> {
    if (chunks.length === 0) return [];
    return await db.insert(transcriptChunks).values(chunks).returning();
  }

  async getTranscriptChunks(videoId: number): Promise<TranscriptChunk[]> {
    return await db.select().from(transcriptChunks).where(eq(transcriptChunks.videoId, videoId));
  }

  async deleteTranscriptChunksByVideoId(videoId: number): Promise<void> {
    await db.delete(transcriptChunks).where(eq(transcriptChunks.videoId, videoId));
  }
}

export const videoStorage = new VideoStorage();