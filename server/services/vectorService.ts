import { connect, Table } from "vectordb";
import path from "path";
import { storage } from "../storage.js";
import { DocumentChunk } from "../../shared/schema.js";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LanceDB configuration
const LANCEDB_PATH = path.join(process.cwd(), "lancedb-data");

export class VectorService {
  private db: any = null;
  private table: Table<any> | null = null;
  private videoTable: Table<any> | null = null;

  // Define schemas for tables
  private getDocumentSchema() {
    return [
      {
        vector: Array(1536).fill(0),
        text: "schema",
        documentId: 0,
        chunkIndex: 0,
        subjectId: 0,
        userId: 0,
        sessionId: 0,
        isTemporary: false,
        createdAt: new Date().toISOString(),
      }
    ];
  }

  private getVideoSchema() {
    return [
      {
        vector: Array(1536).fill(0),
        text: "schema",
        videoId: 0,
        chunkId: 0,
        startTime: 0,
        endTime: 0,
        subjectId: 0,
        createdAt: new Date().toISOString(),
      }
    ];
  }

  async initialize() {
    try {
      // Connect to LanceDB
      this.db = await connect(LANCEDB_PATH);
      
      // Create or open the documents table
      const tableNames = await this.db.tableNames();
      
      if (tableNames.includes("documents")) {
        // Drop existing table to recreate with proper schema
        await this.db.dropTable("documents");
        console.log("Dropped existing documents table to recreate with full schema");
      }
      
      // Create documents table with initial schema data
      this.table = await this.db.createTable("documents", [
        {
          vector: Array(1536).fill(0),
          text: "init",
          documentId: 0,
          chunkIndex: 0,
          subjectId: 0,
          userId: 0,
          sessionId: 0,
          isTemporary: false,
          createdAt: new Date().toISOString(),
        }
      ]);

      // Create or recreate video transcripts table
      if (tableNames.includes("video_transcripts")) {
        await this.db.dropTable("video_transcripts");
        console.log("Dropped existing video_transcripts table to recreate with full schema");
      }
      
      // Create video transcripts table with initial schema data
      this.videoTable = await this.db.createTable("video_transcripts", [
        {
          vector: Array(1536).fill(0),
          text: "init",
          videoId: 0,
          chunkId: 0,
          startTime: 0,
          endTime: 0,
          subjectId: 0,
          createdAt: new Date().toISOString(),
        }
      ]);

      console.log("Vector service initialized successfully with both document and video tables");
      
      // Clean up initialization records immediately
      try {
        await this.table!.delete(`"text" = 'init'`);
        await this.videoTable!.delete(`"text" = 'init'`);
      } catch (cleanupErr) {
        // Ignore cleanup errors on first init
      }
    } catch (error) {
      console.error("Failed to initialize vector service:", error);
      throw error;
    }
  }

  // Get embeddings from OpenAI
  async getEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  }



  // Unified method to process document chunks with embeddings
  async processDocumentChunks(
    documentId: number, 
    subjectId: number, 
    chunks: string[], 
    userId?: number, 
    sessionId?: number, 
    isTemporary: boolean = false
  ) {
    if (!this.table) await this.initialize();
    if (chunks.length === 0) return;

    try {
      // Process chunks in parallel with embeddings
      const records = await Promise.all(
        chunks.map(async (chunk, index) => ({
          vector: await this.getEmbedding(chunk),
          text: chunk,
          documentId,
          chunkIndex: index,
          subjectId,
          userId: userId || 0,
          sessionId: sessionId || 0,
          isTemporary,
          createdAt: new Date().toISOString(),
        }))
      );

      await this.table!.add(records);

      // Update database status for permanent documents only
      if (!isTemporary) {
        const documentChunks = await storage.getDocumentChunks(documentId);
        await Promise.all(
          documentChunks.map(chunk => 
            storage.updateDocumentChunk(chunk.id, { embedding: { processed: true } })
          )
        );
      }

      console.log(`✓ Processed ${chunks.length} ${isTemporary ? 'temporary' : 'permanent'} chunks for document ${documentId}`);
    } catch (error) {
      console.error(`Failed to process chunks for document ${documentId}:`, error);
      throw error;
    }
  }

  // Convenience method for temporary documents
  async processTemporaryDocumentChunks(
    documentId: number, 
    userId: number, 
    sessionId: number, 
    subjectId: number, 
    chunks: string[]
  ) {
    return this.processDocumentChunks(documentId, subjectId, chunks, userId, sessionId, true);
  }

  // Optimized search with user/session context and temporal prioritization
  async searchDocumentsWithContext(
    query: string, 
    subjectId?: number, 
    userId?: number, 
    sessionId?: number, 
    topK: number = 10
  ) {
    if (!this.table) await this.initialize();

    try {
      // Get query embedding and execute search
      const queryEmbedding = await this.getEmbedding(query);
      let results = await this.table!.search(queryEmbedding).limit(topK * 3).execute();

      // Apply subject filter if specified
      if (subjectId !== undefined && subjectId !== null) {
        results = results.filter((r: any) => r.subjectId === subjectId);
      }

      // Separate results into categories for prioritization
      const temporaryDocs = results.filter((r: any) => 
        r.isTemporary === true && r.userId === userId && r.sessionId === sessionId
      );
      
      // Permanent docs: isTemporary=false OR (userId=0 and sessionId=0)
      const permanentDocs = results.filter((r: any) => 
        r.isTemporary === false || (r.userId === 0 && r.sessionId === 0)
      );
      
      const otherDocs = results.filter((r: any) => 
        r.isTemporary === true && (r.userId !== userId || r.sessionId !== sessionId)
      );
      
      // Handle fallback when no user context provided
      if (userId === undefined || sessionId === undefined) {
        const allDocs = [...temporaryDocs, ...permanentDocs, ...otherDocs];
        return allDocs.map(doc => ({ 
          ...doc, 
          category: 'permanent' as const, 
          score: 1 - (doc._distance || 0) + 5
        })).sort((a, b) => b.score - a.score).slice(0, topK);
      }

      // Optimized scoring function with temporal prioritization
      const scoreDocument = (doc: any, category: 'temporary' | 'permanent' | 'other') => {
        const semanticScore = 1 - (doc._distance || 0);
        const temporalScore = doc.createdAt ? 
          Math.max(0, 1 - (Date.now() - new Date(doc.createdAt).getTime()) / (2 * 60 * 60 * 1000)) : 0;

        switch (category) {
          case 'temporary':
            return (0.1 * semanticScore) + (0.9 * temporalScore) + 10;
          case 'permanent':
            return (0.5 * semanticScore) + (0.5 * temporalScore) + 5;
          default:
            return (0.8 * semanticScore) + (0.2 * temporalScore);
        }
      };

      // Score, sort and return top results
      const scoredResults = [
        ...temporaryDocs.map(doc => ({ ...doc, category: 'temporary' as const, score: scoreDocument(doc, 'temporary') })),
        ...permanentDocs.map(doc => ({ ...doc, category: 'permanent' as const, score: scoreDocument(doc, 'permanent') })),
        ...otherDocs.map(doc => ({ ...doc, category: 'other' as const, score: scoreDocument(doc, 'other') }))
      ];

      return scoredResults.sort((a, b) => b.score - a.score).slice(0, topK);
    } catch (error) {
      console.error("Vector search failed:", error);
      throw error;
    }
  }



  async searchDocuments(query: string, subjectId?: number, topK: number = 5) {
    return this.searchDocumentsWithContext(query, subjectId, undefined, undefined, topK);
  }

  // Generate answer using retrieved context with user/session prioritization
  async generateAnswerWithContext(
    query: string, 
    subjectId?: number, 
    userId?: number, 
    sessionId?: number
  ) {
    try {
      // Search for relevant documents with user/session context
      const searchResults = await this.searchDocumentsWithContext(query, subjectId, userId, sessionId, 5);
      
      // Transform search results to legacy format for compatibility
      const relevantDocs = await Promise.all(
        searchResults.map(async (result: any) => {
          // Check if it's a temporary document and fetch from correct table
          let document;
          if (result.isTemporary) {
            document = await storage.getTemporaryDocument(result.documentId);
          } else {
            document = await storage.getDocument(result.documentId);
          }
          
          return {
            content: result.text,
            score: result._distance || result.score || 0,
            documentId: result.documentId,
            chunkIndex: result.chunkIndex,
            documentName: document?.name || "Unknown",
            documentType: document?.type || "unknown",
            subjectId: result.subjectId,
            category: result.category || 'other',
            isTemporary: result.isTemporary || false,
          };
        })
      );

      console.log("Generated context with prioritized documents:", relevantDocs.map(doc => ({
        name: doc.documentName,
        category: doc.category,
        isTemporary: doc.isTemporary,
        score: doc.score
      })));
      
      // Build context from relevant documents with prioritization info
      const context = relevantDocs
        .map((doc, index) => {
          const categoryLabel = doc.category === 'temporary' ? '[Tài liệu tạm thời]' : 
                               doc.category === 'permanent' ? '[Tài liệu cố định]' : '[Tài liệu bên ngoài]';
          return `[Tài liệu ${index + 1}: ${doc.documentName} - ${doc.documentType === 'theory' ? 'Lý thuyết' : 'Bài tập'} ${categoryLabel}]\n${doc.content}`;
        })
        .join("\n\n");

      // Build prompt with context
      const systemPrompt = `Bạn là giáo viên. Dựa vào tài liệu dưới đây để trả lời:

${context}

Chào học sinh rồi giải thích tự nhiên dựa trên tài liệu. Xuống dòng nhiều để dễ đọc. Giải bài tập chi tiết từng bước. Có thể đưa ví dụ thêm.

Ưu tiên tài liệu người dùng tải lên. Nói chuyện bình thường, đừng dùng tiêu đề "Phần này", "Phần kia".`;

      return {
        systemPrompt,
        relevantDocs,
        context,
      };
    } catch (error) {
      console.error("Failed to generate answer with context:", error);
      throw error;
    }
  }

  // Delete vectors by document ID
  async deleteVectorsByDocumentId(documentId: number) {
    if (!this.table) {
      await this.initialize();
    }

    try {
      // Deleting vectors for document
      
      // Get current record count
      const beforeCount = await this.table!.countRows();
      
      // Delete vectors with matching document ID (use double quotes for case-sensitive column names)
      await this.table!.delete(`"documentId" = ${documentId}`);
      
      const afterCount = await this.table!.countRows();
      const deletedCount = beforeCount - afterCount;
      
      // Deleted vectors successfully
      return deletedCount;
    } catch (error) {
      console.error(`Failed to delete vectors for document ${documentId}:`, error);
      throw error;
    }
  }

  // Delete vectors by user and session (for temporary documents)
  async deleteVectorsByUserSession(userId: number, sessionId: number) {
    if (!this.table) {
      await this.initialize();
    }

    try {
      console.log(`Deleting temporary vectors for user ${userId}, session ${sessionId}`);
      
      const beforeCount = await this.table!.countRows();
      
      // Delete vectors with matching user and session (use double quotes for case-sensitive column names)
      await this.table!.delete(`"userId" = ${userId} AND "sessionId" = ${sessionId} AND "isTemporary" = true`);
      
      const afterCount = await this.table!.countRows();
      const deletedCount = beforeCount - afterCount;
      
      console.log(`Deleted ${deletedCount} temporary vectors for user ${userId}, session ${sessionId}`);
      return deletedCount;
    } catch (error) {
      console.error(`Failed to delete temporary vectors for user ${userId}, session ${sessionId}:`, error);
      throw error;
    }
  }

  // Clean up expired temporary documents (older than 2 hours)
  async cleanupExpiredTemporaryVectors() {
    if (!this.table) {
      await this.initialize();
    }

    try {
      console.log("Cleaning up expired temporary vectors...");
      
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const cutoffDate = twoHoursAgo.toISOString();
      
      const beforeCount = await this.table!.countRows();
      
      // Delete temporary vectors older than 2 hours (use double quotes for case-sensitive column names)
      await this.table!.delete(`"isTemporary" = true AND "createdAt" < '${cutoffDate}'`);
      
      const afterCount = await this.table!.countRows();
      const deletedCount = beforeCount - afterCount;
      
      console.log(`Cleaned up ${deletedCount} expired temporary vectors`);
      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup expired temporary vectors:", error);
      throw error;
    }
  }

  // Delete all vectors (for complete cleanup)
  async deleteAllVectors() {
    if (!this.table || !this.videoTable) {
      await this.initialize();
    }

    try {
      console.log("Deleting all vectors...");
      
      let totalDeleted = 0;
      
      // Delete all document vectors
      try {
        const docsBefore = await this.table!.countRows();
        await this.table!.delete("1 = 1");
        const docsAfter = await this.table!.countRows();
        const docsDeleted = docsBefore - docsAfter;
        totalDeleted += docsDeleted;
        console.log(`Deleted ${docsDeleted} document vectors`);
      } catch (err) {
        console.error("Error deleting document vectors:", err);
      }
      
      // Delete all video vectors - use proper cleanup approach
      try {
        const videoBefore = await this.videoTable!.countRows();
        // Get all video vectors and delete each one
        const allVideoRecords = await this.videoTable!.search([0].concat(Array(1535).fill(0))).limit(10000).execute();
        
        let videoDeleted = 0;
        for (const record of allVideoRecords) {
          try {
            await this.videoTable!.delete(`vector = [${record.vector.join(',')}]`);
            videoDeleted++;
          } catch (deleteErr) {
            console.error('Failed to delete individual video vector:', deleteErr);
          }
        }
        
        totalDeleted += videoDeleted;
        console.log(`Deleted ${videoDeleted} video vectors`);
      } catch (err) {
        console.error("Error deleting video vectors:", err);
      }
      
      console.log(`Deleted ${totalDeleted} vectors in total`);
      return totalDeleted;
    } catch (error) {
      console.error("Failed to delete all vectors:", error);
      throw error;
    }
  }

  // Get vector statistics
  async getVectorStats() {
    if (!this.table) {
      await this.initialize();
    }

    try {
      const totalCount = await this.table!.countRows();
      
      // Get all records to analyze
      const allRecords = await this.table!.search([0].concat(Array(1535).fill(0))).limit(10000).execute();
      
      // Debug first few records to see structure
      console.log("Sample vector records:", allRecords.slice(0, 3).map(r => ({
        documentId: r.documentId,
        isTemporary: r.isTemporary,
        userId: r.userId,
        sessionId: r.sessionId,
        createdAt: r.createdAt,
        subjectId: r.subjectId,
        keys: Object.keys(r)
      })));
      
      const temporaryCount = allRecords.filter(r => r.isTemporary === true).length;
      const permanentCount = allRecords.filter(r => r.isTemporary === false || (r.userId === 0 && r.sessionId === 0)).length;
      
      // Count expired temporary vectors
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const cutoffDate = twoHoursAgo.toISOString();
      
      const expiredCount = allRecords.filter(r => 
        r.isTemporary === true && 
        r.createdAt && 
        new Date(r.createdAt) < twoHoursAgo
      ).length;

      return {
        totalCount,
        temporaryCount,
        permanentCount,
        expiredCount,
        cutoffDate
      };
    } catch (error) {
      console.error("Failed to get vector stats:", error);
      throw error;
    }
  }

  // ==================== VIDEO TRANSCRIPT VECTOR METHODS ====================

  // Process video transcript chunks into vectors
  async processVideoTranscriptChunks(videoId: number, subjectId: number, transcriptChunks: any[]) {
    if (!this.videoTable) await this.initialize();

    try {
      const vectorData = [];
      
      for (const chunk of transcriptChunks) {
        if (chunk.text && chunk.text.trim().length > 0) {
          const embedding = await this.getEmbedding(chunk.text);
          
          vectorData.push({
            vector: embedding,
            text: chunk.text,
            videoId: videoId,
            chunkId: chunk.id || chunk.chunkIndex,
            startTime: 0, // Not used anymore but kept for schema compatibility
            endTime: 0,  // Not used anymore but kept for schema compatibility
            subjectId: subjectId,
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (vectorData.length > 0) {
        await this.videoTable!.add(vectorData);
        console.log(`Added ${vectorData.length} video transcript vectors for video ${videoId}`);
      }
      
      return vectorData.length;
    } catch (error) {
      console.error("Failed to process video transcript chunks:", error);
      throw error;
    }
  }

  // Search video transcripts using semantic similarity
  async searchVideoTranscripts(query: string, subjectId?: number, topK: number = 5) {
    if (!this.videoTable) await this.initialize();

    try {
      const queryEmbedding = await this.getEmbedding(query);
      let results: any[] = [];

      if (subjectId) {
        // Search with subject filter - use double quotes for case-sensitive column names
        results = await this.videoTable!
          .search(queryEmbedding)
          .where(`"subjectId" = ${subjectId}`)
          .limit(topK)
          .execute();
      } else {
        // Search all videos
        results = await this.videoTable!
          .search(queryEmbedding)
          .limit(topK)
          .execute();
      }

      // Transform results with relevance scores (timestamps removed)
      return results.map(r => ({
        text: r.text,
        videoId: r.videoId,
        chunkId: r.chunkId,
        subjectId: r.subjectId,
        score: r._distance || 0,
      }));
    } catch (error) {
      console.error("Video transcript search failed:", error);
      throw error;
    }
  }

  // Delete video vectors by video ID - optimized
  async deleteVideoVectors(videoId: number) {
    if (!this.videoTable) await this.initialize();

    try {
      // Optimization: Create new table without the specific video's vectors
      const allRecords = await this.videoTable!.search([0].concat(Array(1535).fill(0))).limit(10000).execute();
      const recordsToKeep = allRecords.filter(r => r.videoId !== videoId);
      const recordsToDelete = allRecords.filter(r => r.videoId === videoId);
      
      if (recordsToDelete.length === 0) {
        console.log(`No video vectors found for video ${videoId}`);
        return 0;
      }
      
      // If we're deleting all records, just recreate empty table
      if (recordsToKeep.length === 0) {
        await this.db!.dropTable('video_transcripts');
        // Create with initial data for schema
        this.videoTable = await this.db!.createTable('video_transcripts', [
          {
            vector: Array(1536).fill(0),
            text: "init",
            videoId: 0,
            chunkId: 0,
            startTime: 0,
            endTime: 0,
            subjectId: 0,
            createdAt: new Date().toISOString(),
          }
        ]);
        // Delete the init record immediately
        try {
          await this.videoTable!.delete(`"text" = 'init'`);
        } catch (e) {
          // Ignore
        }
        console.log(`Deleted all ${recordsToDelete.length} video vectors by recreating table`);
        return recordsToDelete.length;
      }
      
      // Otherwise delete individual records
      let deletedCount = 0;
      for (const record of recordsToDelete) {
        try {
          await this.videoTable!.delete(`vector = [${record.vector.join(',')}]`);
          deletedCount++;
        } catch (err) {
          console.error('Failed to delete individual video vector:', err);
        }
      }
      
      console.log(`Deleted ${deletedCount} video vectors for video ${videoId}`);
      return deletedCount;
    } catch (error) {
      console.error(`Failed to delete video vectors for video ${videoId}:`, error);
      return 0;
    }
  }

  // Get video vector statistics
  async getVideoVectorStats() {
    if (!this.videoTable) await this.initialize();

    try {
      const totalCount = await this.videoTable!.countRows();
      
      // Get all records to analyze
      const allRecords = await this.videoTable!.search([0].concat(Array(1535).fill(0))).limit(10000).execute();
      
      // Count by subject
      const subjectCounts = allRecords.reduce((acc, record) => {
        acc[record.subjectId] = (acc[record.subjectId] || 0) + 1;
        return acc;
      }, {});

      // Count unique videos
      const uniqueVideos = [...new Set(allRecords.map(r => r.videoId))].length;

      return {
        totalChunks: totalCount,
        uniqueVideos,
        subjectCounts,
        avgChunksPerVideo: uniqueVideos > 0 ? Math.round(totalCount / uniqueVideos) : 0
      };
    } catch (error) {
      console.error("Failed to get video vector stats:", error);
      throw error;
    }
  }

  // Clean up all video vectors (for maintenance)
  async cleanupAllVideoVectors() {
    if (!this.videoTable) await this.initialize();

    try {
      // Drop and recreate the table
      await this.db!.dropTable('video_transcripts');
      this.videoTable = await this.db!.createTable('video_transcripts', this.getVideoSchema(), { mode: 'overwrite' });
      
      console.log('Cleaned up all video vectors by recreating table');
      return { deletedCount: 'all', message: 'Video transcript table recreated' };
    } catch (error) {
      console.error('Failed to cleanup video vectors:', error);
      throw error;
    }
  }

  // Combined search for video Q&A: searches both video transcripts AND permanent documents
  // Priority: 70% permanent documents, 30% video transcripts
  // If currentVideoId is provided, prioritize transcripts from that video
  async searchCombinedForVideoQA(query: string, subjectId?: number, topK: number = 5, currentVideoId?: number) {
    try {
      // Calculate distribution: 70% documents, 30% transcripts
      const docCount = Math.ceil(topK * 0.7);  // 70% for documents
      const videoCount = Math.floor(topK * 0.3); // 30% for transcripts
      
      // Search permanent documents only (no temporary docs for video Q&A)
      const docResults = await this.searchDocuments(query, subjectId, docCount);
      
      // Search video transcripts with priority for current video
      let videoResults = await this.searchVideoTranscripts(query, subjectId, videoCount + 3); // Get extra to filter
      
      // If currentVideoId is provided, boost results from that video
      if (currentVideoId) {
        // Separate results from current video and others
        const currentVideoResults = videoResults.filter(r => r.videoId === currentVideoId);
        const otherVideoResults = videoResults.filter(r => r.videoId !== currentVideoId);
        
        // Boost scores for current video transcripts
        currentVideoResults.forEach(r => {
          r.score = r.score * 0.5; // Lower score means better match in distance metrics
        });
        
        // Combine and sort, then take only videoCount results
        videoResults = [...currentVideoResults, ...otherVideoResults]
          .sort((a, b) => a.score - b.score)
          .slice(0, videoCount);
      } else {
        // No current video, just take top results
        videoResults = videoResults.slice(0, videoCount);
      }
      
      // Combine results with priority weighting
      const combinedResults = {
        videos: videoResults,
        documents: docResults,
        totalSources: videoResults.length + docResults.length,
        currentVideoId: currentVideoId
      };
      
      return combinedResults;
      
    } catch (error) {
      console.error('Combined video Q&A search error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const vectorService = new VectorService();