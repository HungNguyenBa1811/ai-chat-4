import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertUserSettingsSchema,
  documents,
  temporaryDocuments,
} from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import {
  processPDF,
  processDocument,
  processVideo,
  detectSubjectFromPath,
  detectDocumentType,
} from "./utils/pdf-processor";
import { VideoService } from "./video/VideoService";
import { createClient } from "webdav";
import { registerVideoRoutes } from "./video/VideoRoutes";
import * as path from "path";
import * as fs from "fs/promises";
import { vectorService } from "./services/vectorService";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize default subjects only if database is available
  try {
    await initializeDefaultSubjects();
  } catch (error) {
    console.error("Failed to initialize subjects:", error);
    // Continue without database if initialization fails
  }
  
  // Initialize vector service
  try {
    await vectorService.initialize();
    console.log("Vector service initialized successfully");
    
    // Vectors are now preserved across restarts
    // Only delete when explicitly requested or on database failure
    console.log("Vector data preserved across server restarts");

    // Set up periodic cleanup of expired temporary documents and vectors (every hour)
    setInterval(async () => {
      try {
        // Clean up expired temporary documents (this will also clean up their vectors)
        const deletedDocuments = await storage.cleanupExpiredTemporaryDocuments();
        if (deletedDocuments > 0) {
          console.log(`Periodic cleanup: Removed ${deletedDocuments} expired temporary documents`);
        }

        // Clean up any remaining orphaned vectors
        const deletedVectors = await vectorService.cleanupExpiredTemporaryVectors();
        if (deletedVectors > 0) {
          console.log(`Periodic cleanup: Removed ${deletedVectors} orphaned temporary vectors`);
        }
      } catch (error) {
        console.error("Periodic cleanup error:", error);
      }
    }, 60 * 60 * 1000); // 1 hour in milliseconds
    
    console.log("Periodic cleanup scheduled for expired temporary vectors");
  } catch (error) {
    console.error("Failed to initialize vector service:", error);
    // Continue without vector service if initialization fails
  }

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, name, avatar, firebaseUid } = req.body;

      let user = await storage.getUserByFirebaseUid(firebaseUid);

      if (!user) {
        user = await storage.createUser({
          email,
          name,
          avatar,
          firebaseUid,
        });

        // Create default settings
        await storage.createUserSettings({
          userId: user.id,
          theme: "light",
          gptModel: "gpt-4o",
        });
      }

      res.json({ user });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });



  app.get("/api/user/:firebaseUid", async (req, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.params.firebaseUid);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Subject routes
  app.get("/api/subjects", async (req, res) => {
    try {
      const subjects = await storage.getAllSubjects();
      res.json({ subjects });
    } catch (error) {
      // If database fails, return default subjects
      const defaultSubjectsData = [
        {
          id: 1,
          name: "Toán học",
          slug: "math",
          icon: "Calculator",
          color: "from-pink-500 to-pink-600",
          description: "Giải toán, tính toán nhanh, học xA",
        },
        {
          id: 2,
          name: "Ngữ văn",
          slug: "literature",
          icon: "BookOpen",
          color: "from-purple-500 to-purple-600",
          description: "Văn học, ngữ pháp, từ vựng, tiếng việt",
        },
        {
          id: 3,
          name: "Tiếng Anh",
          slug: "english",
          icon: "MessageCircle",
          color: "from-blue-500 to-blue-600",
          description: "Từ vựng, ngữ pháp, luyện thi, giao tiếp",
        },
        {
          id: 4,
          name: "Lịch sử",
          slug: "history",
          icon: "Clock",
          color: "from-orange-500 to-orange-600",
          description: "Lịch sử Việt Nam & thế giới, sử cổ",
        },
        {
          id: 5,
          name: "Địa lý",
          slug: "geography",
          icon: "Globe",
          color: "from-teal-500 to-teal-600",
          description: "Địa lý tự nhiên và kinh tế xã hội",
        },
        {
          id: 6,
          name: "Sinh học",
          slug: "biology",
          icon: "Dna",
          color: "from-green-500 to-green-600",
          description: "Sinh học cơ thể và tế bào, thực vật",
        },
        {
          id: 7,
          name: "Vật lý",
          slug: "physics",
          icon: "Zap",
          color: "from-indigo-500 to-indigo-600",
          description: "Cơ học, điện học, nhiệt học",
        },
        {
          id: 8,
          name: "Hóa học",
          slug: "chemistry",
          icon: "Flask",
          color: "from-violet-500 to-violet-600",
          description: "Hóa hữu cơ, hóa vô cơ, hóa phân tích",
        },
      ];
      console.log("Database unavailable, using default subjects");
      res.json({ subjects: defaultSubjectsData });
    }
  });

  // Chat routes
  app.get("/api/chat/sessions/:userId", async (req, res) => {
    try {
      const sessions = await storage.getChatSessions(
        parseInt(req.params.userId),
      );
      res.json({ sessions });
    } catch (error) {
      console.error("Error getting chat sessions:", error);
      res.status(500).json({ message: "Failed to get sessions" });
    }
  });



  app.post("/api/chat/sessions", async (req, res) => {
    try {
      const sessionData = insertChatSessionSchema.parse(req.body);

      // Create session with temporary title if not provided
      if (!sessionData.title) {
        const subject = await storage.getSubject(sessionData.subjectId);
        sessionData.title = `${subject?.name || "Chat"} - Chưa có câu hỏi`;
      }

      const session = await storage.createChatSession(sessionData);
      res.json({ session });
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.delete("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      await storage.deleteChatSession(sessionId);
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting chat session:", error);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  app.get("/api/chat/messages/:sessionId", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(
        parseInt(req.params.sessionId),
      );
      res.json({ messages });
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post("/api/chat/messages", async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      res.json({ message });
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.post("/api/chat/send", async (req, res) => {
    try {
      const { sessionId, content, userId } = req.body;
      console.log("Chat send request:", { sessionId, content: content.substring(0, 50), userId });

      // Get session and subject info for context
      const session = await storage.getChatSession(sessionId);
      const subject = session ? await storage.getSubject(session.subjectId) : null;



      // Save user message
      await storage.createChatMessage({
        sessionId,
        role: "user",
        content,
      });

      // Get previous messages for context
      const messages = await storage.getChatMessages(sessionId);
      const conversationHistory = [];
      messages.forEach(msg => {
        conversationHistory.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      });

      // Update session title if this is the first user message
      if (
        session &&
        conversationHistory.length === 1 &&
        conversationHistory[0].role === "user"
      ) {
        const truncatedContent =
          content.length > 50 ? content.substring(0, 50) : content;
        await storage.updateChatSession(sessionId, {
          title: truncatedContent,
        });
      }

      // Get context from vector search
      let systemPrompt = `Bạn là giáo viên môn ${subject?.name || "học tập"}. Trả lời như khi nói chuyện trực tiếp với học sinh, tự nhiên và thân thiện.

Chào học sinh rồi giải thích vấn đề một cách dễ hiểu. Xuống dòng nhiều để dễ đọc. Nếu có bài tập thì giải chi tiết từng bước. Có thể đưa thêm ví dụ tương tự.

Nói chuyện bình thường bằng tiếng Việt, đừng chia thành các "phần" hay dùng tiêu đề cứng nhắc.

🎯 QUY TẮC BÀI TẬP - KHÔNG LỘ ĐÁP ÁN NGAY:
- Khi học sinh yêu cầu bài tập (VD: "cho tôi 5 câu bài tập", "lấy bài tập phần A"):
  → CHỈ hiển thị câu hỏi, KHÔNG giải ngay
  → Đợi học sinh làm xong hoặc yêu cầu chữa mới giải
- Ngoại lệ: Nếu là ví dụ minh họa trong lý thuyết thì giải luôn
- Ví dụ phản hồi: "Đây là 5 câu bài tập về [chủ đề]:
  1. [Câu hỏi 1]
  2. [Câu hỏi 2]
  ...
  Em hãy thử làm trước, sau đó cô sẽ chữa bài giúp em nhé!"

🧠 NHẬN DIỆN THÔNG MINH - TỰ ĐỘNG TÌM BÀI TẬP:
- Khi học sinh nói "làm bài tập của phần đó/phần vừa học":
  → Tự nhận diện đang nói về chủ đề nào từ context trước
  → Tự động tìm bài tập liên quan trong tài liệu
  → Không hỏi lại "phần nào?" mà hiểu ngay từ ngữ cảnh
- Ví dụ: Vừa học về phương trình bậc 2 → "cho bài tập phần đó" → tự hiểu là bài tập phương trình bậc 2

🚨 QUY TẮC BẢNG - LUÔN LUÔN TUÂN THỦ:
Khi câu hỏi chứa bất kỳ từ nào sau đây, BẮT BUỘC phải tạo bảng:
- "so sánh", "đối chiếu", "khác nhau", "giống nhau" 
- "các loại", "phân loại", "danh sách", "liệt kê"
- "bảng", "tạo bảng", "làm bảng"
- "ưu điểm", "nhược điểm", "thuận lợi", "khó khăn"
- "đặc điểm", "tính chất", "đặc trưng"
- "giai đoạn", "thời kỳ", "các bước"

QUY TRÌNH TẠO BẢNG CHI TIẾT:
1. GIỚI THIỆU ĐẦY ĐỦ (3-5 câu):
   - Giải thích nguồn gốc, lịch sử hình thành
   - Nêu hoàn cảnh, bối cảnh ra đời
   - Giới thiệu vai trò, tầm quan trọng
   - Mô tả khái quát các yếu tố sẽ so sánh

2. TẠO BẢNG THÔNG TIN:
   - Format: | Cột 1 | Cột 2 | Cột 3 |
   - Đảm bảo đầy đủ thông tin chi tiết
   - Sắp xếp logic, dễ theo dõi

3. KẾT LUẬN SAU BẢNG (2-3 câu):
   - Tổng hợp điểm nổi bật từ bảng
   - Nêu ý nghĩa, ứng dụng thực tiễn
   - Đưa ra nhận xét về ưu/nhược điểm
   - Gợi ý cách ghi nhớ hoặc áp dụng

4. CÂU HỎI GỢI Ý CUỐI CÙNG (bắt buộc):
   - Luôn kết thúc bằng 1 trong các câu hỏi sau:
   - "Bạn có muốn biết thêm về cách học [chủ đề này] hiệu quả không?"
   - "Bạn có muốn tìm hiểu thêm về [chủ đề liên quan]?" (tự tìm chủ đề phù hợp)
   - Nếu câu hỏi thiên về lý thuyết: "Bạn muốn làm thêm bài tập về [chủ đề] này không?"

Ví dụ chi tiết:
- "so sánh quang hợp và hô hấp" → 
  "Quang hợp và hô hấp là hai quá trình sinh học quan trọng, được phát hiện từ thế kỷ 17-18. Quang hợp do nhà khoa học Joseph Priestley phát hiện năm 1771, còn hô hấp tế bào được Antoine Lavoisier nghiên cứu chi tiết vào năm 1775. Hai quá trình này có mối quan hệ mật thiết, tạo nên chu trình vật chất và năng lượng trong tự nhiên. Chúng diễn ra trong các bào quan khác nhau của tế bào và có vai trò ngược nhau nhưng bổ sung cho nhau."
  
  | Tiêu chí | Quang hợp | Hô hấp |
  |----------|-----------|---------|
  | Nơi diễn ra | Lục lạp | Ti thể |
  | Nguyên liệu | CO₂ + H₂O + ánh sáng | C₆H₁₂O₆ + O₂ |
  | Sản phẩm | C₆H₁₂O₆ + O₂ | CO₂ + H₂O + ATP |
  
  "Từ bảng so sánh, ta thấy quang hợp và hô hấp là hai quá trình đối lập nhưng cần thiết cho sự sống. Quang hợp tạo ra thức ăn và oxy cho hầu hết sinh vật, còn hô hấp giải phóng năng lượng từ thức ăn. Học sinh có thể nhớ đơn giản: quang hợp 'xây dựng' còn hô hấp 'phá vỡ' để lấy năng lượng."

KHÔNG viết danh sách dài khi có thể dùng bảng. Luôn có phần giới thiệu và kết luận đầy đủ!

📌 QUAN TRỌNG - LUÔN KẾT THÚC MỖI CÂU TRẢ LỜI BẰNG CÂU HỎI GỢI Ý:
Dù có tạo bảng hay không, LUÔN kết thúc bằng 1 trong các câu hỏi:
- "Bạn có muốn biết thêm về cách học [chủ đề vừa nói] hiệu quả không?"
- "Bạn có muốn tìm hiểu thêm về [chủ đề liên quan]?" (ví dụ: hỏi về photosynthesis → gợi ý cellular respiration)
- Nếu câu hỏi về lý thuyết → "Bạn muốn làm thêm bài tập về [chủ đề] này không?"
- Nếu câu hỏi về bài tập → "Bạn muốn xem thêm lý thuyết về [chủ đề] này không?"

Ví dụ kết thúc:
- "...đó là cách phân biệt động từ và tính từ. Bạn có muốn làm thêm bài tập về phân loại từ loại không?"
- "...công thức tính diện tích là S = πr². Bạn có muốn tìm hiểu thêm về cách tính chu vi hình tròn không?"
- "...vậy là em đã hiểu về quang hợp rồi. Bạn có muốn biết thêm về cách học chu trình Calvin hiệu quả không?"`;
      
      try {
        console.log("Attempting vector search for:", content.substring(0, 50), "Subject ID:", session?.subjectId, "User ID:", userId, "Session ID:", sessionId);
        const contextData = await vectorService.generateAnswerWithContext(
          content,
          session?.subjectId,
          userId,
          sessionId
        );
        
        console.log("Vector search results:", {
          docsFound: contextData.relevantDocs.length,
          docs: contextData.relevantDocs.map(doc => ({ 
            name: doc.documentName, 
            type: doc.documentType,
            score: doc.score,
            content: doc.content.substring(0, 100)
          }))
        });
        
        if (contextData.relevantDocs.length > 0) {
          systemPrompt = contextData.systemPrompt;
          console.log("Using RAG context for response");
        } else {
          console.log("No relevant documents found, using default prompt");
        }
      } catch (vectorError) {
        console.error("Failed to get vector context:", vectorError);
        // Continue with default system prompt if vector search fails
      }

      // Generate AI response
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversationHistory,
          {
            role: "user",
            content,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const aiResponse = response.choices[0].message.content;

      // Save AI response
      const aiMessage = await storage.createChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse || "Xin lỗi, tôi không thể trả lời câu hỏi này.",
      });
      res.json({ message: aiMessage });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });


  // Settings routes
  app.get("/api/settings/:userId", async (req, res) => {
    try {
      const settings = await storage.getUserSettings(
        parseInt(req.params.userId),
      );
      res.json({ settings });
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = insertUserSettingsSchema.parse(req.body);
      const settings = await storage.createUserSettings(settingsData);
      res.json({ settings });
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  app.patch("/api/settings/:userId", async (req, res) => {
    try {
      const { theme, gptModel } = req.body;
      const settings = await storage.updateUserSettings(
        parseInt(req.params.userId),
        {
          theme,
          gptModel,
        },
      );
      res.json({ settings });
    } catch (error) {
      console.error("Failed to update settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Document upload routes
  const upload = multer({ dest: "/tmp/uploads/" });

  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { subjectId, docType, userId, sessionId, isTemporary } = req.body;
      const isTemp = isTemporary === 'true' || isTemporary === true;

      // Get file extension from original name
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      
      // Rename uploaded file to include extension
      const newPath = req.file.path + fileExt;
      await fs.rename(req.file.path, newPath);

      // Process document (PDF or DOCX)
      const result = await processDocument(newPath);

      let document: any;
      let documentId: number;
      
      if (isTemp) {
        // Store temporary document
        document = await storage.createTemporaryDocument({
          userId: parseInt(userId),
          sessionId: parseInt(sessionId),
          subjectId: parseInt(subjectId),
          name: req.file.originalname,
          type: docType as "theory" | "exercise",
          content: result.text,
          chunks: JSON.stringify(result.chunks),
          pageCount: result.pageCount,
        });
        documentId = document.id;

        // Store temporary chunks
        const tempChunksToInsert = result.chunks.map((chunk, index) => ({
          temporaryDocumentId: document.id,
          userId: parseInt(userId),
          sessionId: parseInt(sessionId),
          chunkIndex: index,
          content: chunk,
        }));

        await storage.createTemporaryDocumentChunks(tempChunksToInsert);
      } else {
        // Store permanent document
        document = await storage.createDocument({
          subjectId: parseInt(subjectId),
          name: req.file.originalname,
          type: docType as "theory" | "exercise",
          content: result.text,
          chunks: JSON.stringify(result.chunks),
          pageCount: result.pageCount,
        });
        documentId = document.id;

        // Store permanent chunks
        const chunksToInsert = result.chunks.map((chunk, index) => ({
          documentId: document.id,
          chunkIndex: index,
          content: chunk,
        }));

        await storage.createDocumentChunks(chunksToInsert);
      }

      // Process chunks with vector embeddings
      try {
        if (isTemp) {
          await vectorService.processTemporaryDocumentChunks(
            document.id,
            parseInt(userId),
            parseInt(sessionId),
            parseInt(subjectId),
            result.chunks
          );
        } else {
          await vectorService.processDocumentChunks(
            document.id,
            parseInt(subjectId),
            result.chunks
          );
        }
      } catch (vectorError) {
        console.error("Failed to process vector embeddings:", vectorError);
        // Continue even if vector processing fails
      }

      // Clean up temp file (use newPath instead of req.file.path)
      await fs.unlink(newPath);

      res.json({ document });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ message: "Failed to process document" });
    }
  });

  app.post("/api/documents/webdav-sync", async (req, res) => {
    try {
      const { webdavUrl, username, password, folderPath, subjectId, docType } =
        req.body;

      console.log("WebDAV sync request:", {
        webdavUrl,
        folderPath,
        subjectId,
        docType,
      });

      // Create WebDAV client
      const client = createClient(webdavUrl, {
        username,
        password,
      });

      // List files in the folder
      console.log("Fetching directory contents for:", folderPath);
      const items = await client.getDirectoryContents(folderPath);
      console.log("Found items:", items.length);
      const processedDocs = [];
      const failedDocs = [];

      for (const item of items) {
        console.log("Processing item:", item.basename, item.type);
        

        
        // Check if it's a PDF file or video file
        const isPDF = item.type === "file" && item.basename.toLowerCase().endsWith(".pdf");
        const isDOCX = item.type === "file" && item.basename.toLowerCase().endsWith(".docx");
        const isDocument = isPDF || isDOCX;
        const isVideo = item.type === "file" && 
          /\.(mp4|avi|mov|mkv|wmv|flv|webm|m4v)$/i.test(item.basename);
        
        if (isDocument || isVideo) {
          // Download file to temp location
          const fullPath = path.join(folderPath, item.basename);
          const tempPath = path.join(
            "/tmp",
            `webdav_${Date.now()}_${item.basename}`,
          );
          console.log(`Downloading ${isPDF ? 'PDF' : 'video'}:`, fullPath, "to", tempPath);
          const stream = client.createReadStream(fullPath);
          const writeStream = (await import("fs")).createWriteStream(tempPath);

          await new Promise((resolve, reject) => {
            stream.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
          });

          // Detect subject and type from filename (not full path)
          const detectedSubject = detectSubjectFromPath(fullPath);
          const detectedType = detectDocumentType(item.basename);
          console.log(
            `Document type detection: ${item.basename} -> ${detectedType}`,
          );

          // Process PDF or video
          let result;
          try {
            if (isDocument) {
              result = await processDocument(tempPath);
            } else if (isVideo) {
              const videoResult = await processVideo(tempPath);
              if (!videoResult.success) {
                throw new Error(videoResult.error || "Video processing failed");
              }
              // Convert video processing result to document format
              result = {
                text: videoResult.transcript || "",
                chunks: videoResult.transcript ? 
                  [videoResult.transcript] : [],
                pageCount: 1,
                duration: videoResult.duration || 0,
              };
            }
          } catch (processingError) {
            console.error(`${isDocument ? 'Document' : 'Video'} processing error:`, processingError);
            // Skip this file if processing fails
            failedDocs.push({
              name: item.basename,
              error: processingError.message || `${isDocument ? 'Document' : 'Video'} processing failed`,
            });
            // Clean up temp file
            await fs.unlink(tempPath).catch(() => {});
            continue;
          }

          // Store in database based on file type
          if (isDocument) {
            // Store as document
            const document = await storage.createDocument({
              subjectId: parseInt(subjectId),
              name: item.basename,
              type: detectedType, // Always use detected type based on filename
              content: result.text,
              chunks: JSON.stringify(result.chunks),
              pageCount: result.pageCount,
            });
            
            // Store chunks in separate table
            const chunksToInsert = result.chunks.map((chunk, index) => ({
              documentId: document.id,
              chunkIndex: index,
              content: chunk,
            }));
            
            await storage.createDocumentChunks(chunksToInsert);
            
            // Process chunks with vector embeddings
            try {
              await vectorService.processDocumentChunks(
                document.id,
                parseInt(subjectId),
                result.chunks
              );
              console.log(`Processed vector embeddings for document ${document.name}`);
            } catch (vectorError) {
              console.error("Failed to process vector embeddings:", vectorError);
              // Continue even if vector processing fails
            }
            
            processedDocs.push(document);
            console.log(
              `Successfully processed document: ${document.name} (${detectedType})`,
            );
            console.log(`Created ${result.chunks.length} chunks for document`);
          } else if (isVideo) {
            // Store as video
            const video = await VideoService.createVideoWithChunks({
              subjectId: parseInt(subjectId),
              title: item.basename,
              fileName: item.basename,
              filePath: tempPath,
              webdavUrl: fullPath,
              duration: result.duration,
              transcript: result.text,
            });
            
            processedDocs.push(video);
            console.log(
              `Successfully processed video: ${video.title}`,
            );
            console.log(`Duration: ${video.duration} seconds`);
          }



          // Clean up temp file
          await fs.unlink(tempPath);
        }
      }

      console.log("Total processed documents:", processedDocs.length);
      console.log("Failed documents:", failedDocs.length);

      res.json({
        message: `Đã đồng bộ ${processedDocs.length} tài liệu${failedDocs.length > 0 ? `, ${failedDocs.length} tài liệu thất bại` : ""}`,
        documents: processedDocs,
        failed: failedDocs,
      });
    } catch (error: any) {
      console.error("WebDAV sync error:", error);
      res.status(500).json({
        message: "Failed to sync from WebDAV",
        error: error.message || "Unknown error",
      });
    }
  });

  // Document deletion route
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      
      // Delete vectors first
      try {
        await vectorService.deleteVectorsByDocumentId(documentId);
      } catch (vectorError) {
        console.error("Failed to delete vectors:", vectorError);
        // Continue even if vector deletion fails
      }
      
      // Delete document from database
      await storage.deleteDocument(documentId);
      
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Document deletion error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });



  // Vector management routes
  app.post("/api/vectors/cleanup-expired", async (req, res) => {
    try {
      const deletedCount = await vectorService.cleanupExpiredTemporaryVectors();
      res.json({ 
        message: `Cleaned up ${deletedCount} expired temporary vectors`,
        deletedCount 
      });
    } catch (error) {
      console.error("Vector cleanup error:", error);
      res.status(500).json({ message: "Failed to cleanup expired vectors" });
    }
  });

  app.post("/api/vectors/delete-all", async (req, res) => {
    try {
      const deletedCount = await vectorService.deleteAllVectors();
      res.json({ 
        message: `Deleted ${deletedCount} vectors in total`,
        deletedCount 
      });
    } catch (error) {
      console.error("Vector deletion error:", error);
      res.status(500).json({ message: "Failed to delete all vectors" });
    }
  });

  app.get("/api/vectors/stats", async (req, res) => {
    try {
      const stats = await vectorService.getVectorStats();
      res.json(stats);
    } catch (error) {
      console.error("Vector stats error:", error);
      res.status(500).json({ message: "Failed to get vector statistics" });
    }
  });

  app.delete("/api/vectors/user-session/:userId/:sessionId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const sessionId = parseInt(req.params.sessionId);
      
      const deletedCount = await vectorService.deleteVectorsByUserSession(userId, sessionId);
      res.json({ 
        message: `Deleted ${deletedCount} temporary vectors for user ${userId}, session ${sessionId}`,
        deletedCount 
      });
    } catch (error) {
      console.error("Vector deletion error:", error);
      res.status(500).json({ message: "Failed to delete vectors for user session" });
    }
  });

  // Temporary document management routes
  app.post("/api/documents/cleanup-expired", async (req, res) => {
    try {
      const deletedCount = await storage.cleanupExpiredTemporaryDocuments();
      res.json({ 
        message: `Cleaned up ${deletedCount} expired temporary documents`,
        deletedCount 
      });
    } catch (error) {
      console.error("Document cleanup error:", error);
      res.status(500).json({ message: "Failed to cleanup expired documents" });
    }
  });

  app.get("/api/documents/temporary/:userId/:sessionId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const sessionId = parseInt(req.params.sessionId);
      
      const documents = await storage.getTemporaryDocuments(userId, sessionId);
      res.json({ documents });
    } catch (error) {
      console.error("Error getting temporary documents:", error);
      res.status(500).json({ message: "Failed to get temporary documents" });
    }
  });

  app.get("/api/documents/stats", async (req, res) => {
    try {
      const permanentDocs = await db.select().from(documents);
      const temporaryDocs = await db.select().from(temporaryDocuments);
      
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      
      const expiredDocs = temporaryDocs.filter(doc => 
        doc.createdAt && new Date(doc.createdAt) < twoHoursAgo
      );

      res.json({
        totalCount: permanentDocs.length + temporaryDocs.length,
        temporaryCount: temporaryDocs.length,
        permanentCount: permanentDocs.length,
        expiredCount: expiredDocs.length,
        cutoffDate: twoHoursAgo.toISOString(),
        permanentDocuments: permanentDocs.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: 'permanent',
          createdAt: doc.createdAt
        })),
        temporaryDocuments: temporaryDocs.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: 'temporary',
          userId: doc.userId,
          sessionId: doc.sessionId,
          createdAt: doc.createdAt
        }))
      });
    } catch (error) {
      console.error("Error getting document stats:", error);
      res.status(500).json({ message: "Failed to get document statistics" });
    }
  });

  app.get("/api/documents/:subjectId", async (req, res) => {
    try {
      const documents = await storage.getDocuments(
        parseInt(req.params.subjectId),
      );
      res.json({ documents });
    } catch (error) {
      res.status(500).json({ message: "Failed to get documents" });
    }
  });

  // Vector search test endpoint
  app.post("/api/vector/search", async (req, res) => {
    try {
      const { query, subjectId } = req.body;
      
      const results = await vectorService.searchDocuments(
        query,
        subjectId ? parseInt(subjectId) : undefined,
        5
      );

      res.json({ results });
    } catch (error) {
      console.error("Vector search error:", error);
      res.status(500).json({ message: "Failed to perform vector search" });
    }
  });

  // Reprocess existing documents to create vectors
  app.post("/api/vectors/reprocess-all", async (req, res) => {
    try {
      await vectorService.deleteAllVectors();
      
      // Process permanent documents
      const permanentDocs = await storage.getAllDocuments();
      let permanentCount = 0;
      
      for (const doc of permanentDocs) {
        try {
          const chunks = JSON.parse(doc.chunks || '[]');
          if (chunks.length > 0) {
            await vectorService.processDocumentChunks(doc.id, doc.subjectId, chunks, 0, 0, false);
            permanentCount++;
          }
        } catch (error) {
          console.error(`Failed to reprocess permanent document ${doc.id}:`, error);
        }
      }
      
      // Process temporary documents
      const tempDocs = await db.select().from(temporaryDocuments);
      let temporaryCount = 0;
      
      for (const doc of tempDocs) {
        try {
          const chunks = JSON.parse(doc.chunks || '[]');
          if (chunks.length > 0) {
            await vectorService.processTemporaryDocumentChunks(
              doc.id, doc.userId, doc.sessionId, doc.subjectId, chunks
            );
            temporaryCount++;
          }
        } catch (error) {
          console.error(`Failed to reprocess temporary document ${doc.id}:`, error);
        }
      }
      
      const stats = await vectorService.getVectorStats();
      res.json({ 
        message: "All documents reprocessed successfully", 
        permanentCount,
        temporaryCount,
        vectorStats: stats
      });
    } catch (error) {
      console.error("Reprocessing error:", error);
      res.status(500).json({ message: "Failed to reprocess documents" });
    }
  });


  

  // Vector management endpoints
  app.get("/api/vectors/stats", async (req, res) => {
    try {
      const stats = await vectorService.getVectorStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get vector stats" });
    }
  });

  app.get("/api/vectors/video-stats", async (req, res) => {
    try {
      const stats = await vectorService.getVideoVectorStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get video vector stats" });
    }
  });

  // Clean up all video vectors
  app.delete("/api/vectors/video-cleanup", async (req, res) => {
    try {
      const result = await vectorService.cleanupAllVideoVectors();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to clean up video vectors" });
    }
  });
  
  // Register video routes
  registerVideoRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}

const defaultSubjects = [
  {
    name: "Toán học",
    slug: "math",
    icon: "Calculator",
    color: "from-pink-500 to-pink-600",
    description: "Giải toán, tính toán nhanh, học xA",
  },
  {
    name: "Ngữ văn",
    slug: "literature",
    icon: "BookOpen",
    color: "from-purple-500 to-purple-600",
    description: "Văn học, ngữ pháp, từ vựng, tiếng việt",
  },
  {
    name: "Tiếng Anh",
    slug: "english",
    icon: "MessageCircle",
    color: "from-blue-500 to-blue-600",
    description: "Từ vựng, ngữ pháp, luyện thi, giao tiếp",
  },
  {
    name: "Lịch sử",
    slug: "history",
    icon: "Clock",
    color: "from-orange-500 to-orange-600",
    description: "Lịch sử Việt Nam & thế giới, sử cổ",
  },
  {
    name: "Địa lý",
    slug: "geography",
    icon: "Globe",
    color: "from-teal-500 to-teal-600",
    description: "Địa lý tự nhiên và kinh tế xã hội",
  },
  {
    name: "Sinh học",
    slug: "biology",
    icon: "Dna",
    color: "from-green-500 to-green-600",
    description: "Sinh học cơ thể và tế bào, thực vật",
  },
  {
    name: "Vật lý",
    slug: "physics",
    icon: "Zap",
    color: "from-indigo-500 to-indigo-600",
    description: "Cơ học, điện học, nhiệt học",
  },
  {
    name: "Hóa học",
    slug: "chemistry",
    icon: "Flask",
    color: "from-violet-500 to-violet-600",
    description: "Hóa hữu cơ, hóa vô cơ, hóa phân tích",
  },
];

async function initializeDefaultSubjects() {
  try {
    const existingSubjects = await storage.getAllSubjects();
    if (existingSubjects.length === 0) {
      for (const subject of defaultSubjects) {
        await storage.createSubject(subject);
      }
    }
  } catch (error) {
    console.error("Failed to initialize subjects:", error);
  }
}
