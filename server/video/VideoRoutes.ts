import { Express, Request, Response } from 'express';
import multer from 'multer';
import { VideoProcessor } from './VideoProcessor.js';
import { VideoService } from './VideoService.js';
import { videoStorage } from './VideoStorage.js';
import { vectorService } from '../services/vectorService.js';
import OpenAI from 'openai';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/x-matroska', 'video/quicktime', 'application/octet-stream'];
    const ext = file.originalname.toLowerCase();
    const isVideoExtension = ext.endsWith('.mp4') || ext.endsWith('.avi') || ext.endsWith('.mov') || ext.endsWith('.mkv');
    
    if (allowedTypes.includes(file.mimetype) || isVideoExtension) {
      cb(null, true);
    } else {
      console.log('Rejected file:', file.originalname, 'mimetype:', file.mimetype);
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

export function registerVideoRoutes(app: Express) {
  // Initialize video processor
  VideoProcessor.initialize().catch(error => {
    console.error('Failed to initialize video processor:', error);
  });





  // Upload and process video
  app.post('/api/videos/upload', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const { subjectId, title } = req.body;
      if (!subjectId || !title) {
        return res.status(400).json({ error: 'Subject ID and title are required' });
      }

      // Save video file
      const filePath = await VideoProcessor.saveVideoFile(req.file);
      
      // Process video (extract transcript)
      const processResult = await VideoProcessor.processVideo(filePath);
      
      if (!processResult.success) {
        await VideoProcessor.deleteVideo(filePath);
        return res.status(500).json({ error: processResult.error });
      }

      // Save to database and create chunks
      const video = await VideoService.createVideoWithChunks({
        subjectId: parseInt(subjectId),
        title,
        fileName: req.file.originalname,
        filePath,
        duration: processResult.duration,
        transcript: processResult.transcript,
      });

      res.json({ 
        message: 'Video uploaded and processed successfully',
        video 
      });
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Get videos by subject
  app.get('/api/videos/subject/:subjectId', async (req: Request, res: Response) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      const videos = await VideoService.getVideosBySubject(subjectId);
      
      res.json({ videos });
    } catch (error) {
      console.error('Get videos error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Get video details with chunks
  app.get('/api/videos/:id', async (req: Request, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const video = await VideoService.getVideoWithChunks(videoId);
      
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ video });
    } catch (error) {
      console.error('Get video error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Delete video
  app.delete('/api/videos/:id', async (req: Request, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      await VideoService.deleteVideo(videoId);
      
      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Search video transcripts
  app.post('/api/videos/search', async (req: Request, res: Response) => {
    try {
      const { query, subjectId } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const results = await VideoService.searchTranscripts(query, subjectId);
      
      res.json({ results });
    } catch (error) {
      console.error('Video search error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Video intent detection endpoint
  app.post('/api/videos/intent', async (req: Request, res: Response) => {
    try {
      const { query, subjectId } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Query is required' });
      }
      
      // Check if query contains video-related keywords
      const videoKeywords = [
        'xem', 'cho xem', 'muốn xem', 'tôi xem', 'cho tôi xem',
        'xem video', 'video về', 'bài giảng', 'video bài',
        'học qua video', 'video bài học', 'clip học', 'video giải thích',
        'có video nào', 'video giảng', 'xem bài', 'xem phần',
        'mở video', 'phát video', 'chạy video', 'play video'
      ];
      
      const hasVideoIntent = videoKeywords.some(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (hasVideoIntent) {
        // Search for relevant videos
        const videoResults = await VideoService.searchTranscripts(
          query, 
          subjectId ? parseInt(subjectId) : undefined
        );
        
        res.json({ 
          hasVideoIntent: true, 
          videos: videoResults 
        });
      } else {
        res.json({ 
          hasVideoIntent: false, 
          videos: [] 
        });
      }
    } catch (error) {
      console.error('Video intent detection error:', error);
      res.status(500).json({ message: 'Failed to detect video intent' });
    }
  });

  // Video Q&A chat endpoint - combines video transcripts and permanent documents
  app.post('/api/videos/chat', async (req: Request, res: Response) => {
    try {
      const { message, subjectId, videoId } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      if (!subjectId) {
        return res.status(400).json({ error: 'Subject ID is required' });
      }
      
      // Use combined search for video Q&A with priority model
      // 70% permanent documents, 30% video transcripts
      // Pass videoId to prioritize transcripts from current video
      const searchResults = await vectorService.searchCombinedForVideoQA(
        message, 
        parseInt(subjectId), 
        7, // Total results: ~5 documents + ~2 transcripts
        videoId ? parseInt(videoId) : undefined // Current video ID for prioritization
      );
      
      // Build context from both video and document results
      let context = '';
      
      if (searchResults.videos.length > 0) {
        context += 'Từ video transcripts:\n';
        
        // Group by video and mark current video
        const videoGroups = new Map();
        
        // First get video titles from database
        const videoIds = [...new Set(searchResults.videos.map(r => r.videoId))];
        const videoTitles = new Map();
        
        for (const vid of videoIds) {
          const video = await videoStorage.getVideo(vid);
          if (video) {
            videoTitles.set(vid, video.title);
          }
        }
        
        searchResults.videos.forEach((result) => {
          const isCurrentVideo = videoId && result.videoId === parseInt(videoId);
          const key = result.videoId;
          
          if (!videoGroups.has(key)) {
            videoGroups.set(key, {
              title: videoTitles.get(key) || `Video ${result.videoId}`,
              chunks: [],
              isCurrentVideo
            });
          }
          
          videoGroups.get(key).chunks.push(result.text);
        });
        
        // Output current video first
        for (const [videoId, videoData] of videoGroups) {
          if (videoData.isCurrentVideo) {
            context += `[VIDEO ĐANG XEM] ${videoData.title}:\n`;
            videoData.chunks.forEach(chunk => {
              context += `- ${chunk}\n`;
            });
          }
        }
        
        // Then other videos
        for (const [videoId, videoData] of videoGroups) {
          if (!videoData.isCurrentVideo) {
            context += `${videoData.title}:\n`;
            videoData.chunks.forEach(chunk => {
              context += `- ${chunk}\n`;
            });
          }
        }
        
        context += '\n';
      }
      
      if (searchResults.documents.length > 0) {
        context += 'Từ tài liệu:\n';
        searchResults.documents.forEach((doc, index) => {
          context += `Tài liệu "${doc.documentName}": ${doc.content}\n`;
        });
      }
      
      if (context.trim() === '') {
        context = 'Không tìm thấy thông tin liên quan trong video và tài liệu.';
      }
      
      // Generate response using OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Bạn là trợ lý AI học tập thông minh, giúp học sinh vừa xem video vừa học bài. Trả lời như khi nói chuyện trực tiếp với học sinh, tự nhiên và thân thiện.

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
- "...vậy là em đã hiểu về quang hợp rồi. Bạn có muốn biết thêm về cách học chu trình Calvin hiệu quả không?"

🎥 ĐẶC BIỆT CHO VIDEO - Nhận diện ý định xem:
- Khi học sinh dùng các từ như "xem", "cho tôi xem", "muốn xem", "có video nào", "video về":
  → Gợi ý họ tìm và xem video phù hợp trong danh sách video của môn học
  → Giải thích ngắn gọn nội dung video đó nói về gì
- Ví dụ: "Tôi muốn xem video về Ngô Quyền" → "Video 'Lịch sử Việt Nam phần 1' có phần về Ngô Quyền đánh thắng quân Nam Hán..."

📚 SỬ DỤNG NGUỒN TÀI LIỆU:
- MỨC ĐỘ ƯU TIÊN: 70% từ tài liệu permanent, 30% từ video transcripts
- QUAN TRỌNG: Nếu có [VIDEO ĐANG XEM], ưu tiên sử dụng thông tin từ video này trước các video khác
- Khi trả lời, ưu tiên trích dẫn từ tài liệu trước, sau đó bổ sung từ video đang xem

📐 ĐỊNH DẠNG VÀ CÔNG THỨC:
- Sử dụng **text** cho in đậm, *text* cho in nghiêng
- Công thức toán: $...$ (inline) và $$...$$ (display)
- Phân tử hóa học: $CH_4$, $H_2O$, $CO_2$
- Phương trình: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
- Ma trận: $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$

Nếu thiếu thông tin, hướng dẫn chung và gợi ý xem thêm video/tài liệu.
Không đề cập đến thời gian cụ thể trong video, chỉ tập trung vào nội dung.`
          },
          {
            role: "user",
            content: `Câu hỏi: ${message}

Thông tin có sẵn:
${context}

Hãy trả lời câu hỏi dựa trên thông tin trên.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });
      
      res.json({ 
        response: response.choices[0].message.content,
        sources: {
          videos: searchResults.videos.length,
          documents: searchResults.documents.length
        }
      });
      
    } catch (error) {
      console.error('Video chat error:', error);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  });

  // Video streaming endpoint
  app.get('/api/videos/stream/:id', async (req: Request, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const video = await VideoService.getVideoById(videoId);
      
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      // Stream the video file
      const fs = await import('fs');
      const path = await import('path');
      const videoPath = path.resolve(video.filePath);
      
      if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }
      
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error('Video streaming error:', error);
      res.status(500).json({ error: 'Failed to stream video' });
    }
  });
}