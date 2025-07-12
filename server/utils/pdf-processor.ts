import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import natural from 'natural';
import mammoth from 'mammoth';
import { VideoProcessor } from '../video/VideoProcessor.js';

const execAsync = promisify(exec);

interface PDFProcessResult {
  text: string;
  chunks: string[];
  pageCount: number;
}

interface DocumentProcessResult {
  text: string;
  chunks: string[];
  pageCount: number;
}

interface VideoProcessResult {
  success: boolean;
  duration?: number;
  transcript?: string;
  error?: string;
}

// Extract subject from folder path like "ly/Lý thuyết về mạch điện" -> physics  
// Returns subject ID based on detected subject
function detectSubjectFromPath(filePath: string): number {
  const pathLower = filePath.toLowerCase();
  
  // Subject IDs based on database order
  if (pathLower.includes('toan') || pathLower.includes('math')) return 1;       // Toán học
  if (pathLower.includes('van') || pathLower.includes('ngu') || pathLower.includes('literature')) return 2; // Ngữ văn
  if (pathLower.includes('anh') || pathLower.includes('english')) return 3;     // Tiếng Anh
  if (pathLower.includes('su') || pathLower.includes('history')) return 4;      // Lịch sử
  if (pathLower.includes('dia') || pathLower.includes('geography')) return 5;   // Địa lý
  if (pathLower.includes('sinh') || pathLower.includes('biology')) return 6;    // Sinh học
  if (pathLower.includes('ly') || pathLower.includes('physics')) return 7;      // Vật lý
  if (pathLower.includes('hoa') || pathLower.includes('chemistry')) return 8;   // Hóa học
  
  return 1; // Default to Math
}

// Detect document type from path
function detectDocumentType(filePath: string): 'theory' | 'exercise' {
  const pathLower = filePath.toLowerCase();
  
  if (pathLower.includes('bai tap') || pathLower.includes('exercise') || pathLower.includes('practice')) {
    return 'exercise';
  }
  
  return 'theory';
}

// Check if file is a video format
function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'].includes(ext);
}

// Process video files with transcript extraction
export async function processVideo(filePath: string): Promise<VideoProcessResult> {
  if (!isVideoFile(filePath)) {
    return { success: false, error: 'Not a video file' };
  }
  
  try {
    const result = await VideoProcessor.processVideo(filePath);
    return result;
  } catch (error) {
    console.error('Error processing video:', error);
    return { success: false, error: error.message };
  }
}

// Process PDF with OCR if needed
export async function processPDF(filePath: string): Promise<PDFProcessResult> {
  try {
    let text = '';
    let pageCount = 1;
    
    // First try to extract text using pdf-parse dynamically to avoid loading error
    try {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse.default(dataBuffer);
      text = pdfData.text;
      pageCount = pdfData.numpages || 1;
    } catch (pdfError) {
      console.log('PDF parsing failed, using OCR directly');
    }
    
    // If text is too short or pdf parsing failed, try OCR
    if (text.trim().length < 100) {
      console.log('PDF has minimal text, attempting OCR...');
      text = await performOCR(filePath);
    }
    
    // Chunk the text using spaCy-like approach
    const chunks = chunkText(text);
    
    console.log(`Text length: ${text.length}, Number of chunks: ${chunks.length}`);
    
    return {
      text,
      chunks,
      pageCount
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

// Process DOCX files
export async function processDOCX(filePath: string): Promise<DocumentProcessResult> {
  try {
    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    // Chunk the text using the same approach as PDF
    const chunks = chunkText(text);
    
    // Estimate page count (roughly 3000 chars per page)
    const pageCount = Math.max(1, Math.ceil(text.length / 3000));
    
    console.log(`DOCX processed - Text length: ${text.length}, Number of chunks: ${chunks.length}`);
    
    return {
      text,
      chunks,
      pageCount
    };
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw error;
  }
}

// Process any document (PDF or DOCX)
export async function processDocument(filePath: string): Promise<DocumentProcessResult> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.docx') {
    return processDOCX(filePath);
  } else if (ext === '.pdf') {
    return processPDF(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

// Use Tesseract OCR to extract text from scanned PDFs
async function performOCR(pdfPath: string): Promise<string> {
  console.log('Performing OCR with Tesseract...');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // First, try using pdftoppm (from poppler) to convert PDF to images
    const tempDir = path.join('/tmp', `ocr_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // Use pdftoppm to convert PDF to PNG images
      const ppmCommand = `pdftoppm -png -r 150 "${pdfPath}" "${tempDir}/page"`;
      console.log('Converting PDF to images with pdftoppm...');
      await execAsync(ppmCommand);
    } catch (ppmError) {
      console.log('pdftoppm not available, trying ImageMagick...');
      // Fallback to ImageMagick convert
      const convertCommand = `convert -density 150 "${pdfPath}" "${tempDir}/page-%03d.png"`;
      await execAsync(convertCommand);
    }
    
    // Get all generated images
    const files = await fs.readdir(tempDir);
    const imageFiles = files.filter(f => f.endsWith('.png')).sort();
    
    if (imageFiles.length === 0) {
      throw new Error('No images generated from PDF');
    }
    
    console.log(`Generated ${imageFiles.length} images from PDF`);
    
    // Perform OCR on each image using Tesseract
    const texts = [];
    

    
    // Process max 5 pages to avoid timeout
    const maxPages = Math.min(imageFiles.length, 5);
    
    for (let i = 0; i < maxPages; i++) {
      const imagePath = path.join(tempDir, imageFiles[i]);
      console.log(`Running OCR on ${imageFiles[i]}...`);
      
      try {
        console.log(`Starting OCR for ${imageFiles[i]}, file size: ${(await fs.stat(imagePath)).size} bytes`);
        
        // Use command line tesseract directly for better reliability
        const outputPath = path.join(tempDir, `ocr_output_${i}`);
        const tesseractCommand = `tesseract "${imagePath}" "${outputPath}" -l vie+eng --oem 1 --psm 3`;
        console.log(`Running command: ${tesseractCommand}`);
        
        await execAsync(tesseractCommand);
        
        // Read the output text file
        const text = await fs.readFile(`${outputPath}.txt`, 'utf-8');
        console.log(`OCR result length: ${text ? text.length : 0} characters`);
        
        if (text && text.trim().length > 0) {
          texts.push(text.trim());
        }
      } catch (ocrError) {
        console.error(`OCR error on ${imageFiles[i]}:`, ocrError);
      }
    }
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    
    if (texts.length === 0) {
      throw new Error('No text could be extracted from any page');
    }
    
    console.log(`Successfully extracted text from ${texts.length} pages`);
    return texts.join('\n\n--- Trang mới ---\n\n');
    
  } catch (error) {
    console.error('OCR processing error:', error);
    
    // Clean up temp directory on error
    try {
      if (tempDir && tempDir.startsWith('/tmp/')) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    // Return meaningful error message
    const filename = path.basename(pdfPath);
    return `[${filename}]\n\nKhông thể thực hiện OCR cho file này.\nLỗi: ${error.message}\n\nVui lòng đảm bảo:\n1. File PDF không bị hỏng\n2. File có thể đọc được`;
  }
}

// Chunk text using natural language processing with spaCy-like approach
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  // If text is too short, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const tokenizer = new natural.SentenceTokenizer();
  const sentences = tokenizer.tokenize(text);
  
  if (!sentences || sentences.length === 0) {
    // Fallback: split by lines if no sentences detected
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 1) {
      return chunkByLines(lines, maxChunkSize);
    }
    return [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  let currentLength = 0;
  
  // Group sentences into semantic chunks
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = sentence.length;
    
    // Check if adding this sentence would exceed the limit
    if (currentLength + sentenceLength > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentLength = sentenceLength;
    } else {
      // Add sentence to current chunk
      if (currentChunk.length > 0) {
        currentChunk += ' ';
        currentLength += 1;
      }
      currentChunk += sentence;
      currentLength += sentenceLength;
      
      // Look for natural break points (paragraphs, sections)
      if (sentence.match(/[.!?]\s*$/) && i < sentences.length - 1) {
        const nextSentence = sentences[i + 1];
        // Check if next sentence starts a new paragraph/section
        if (nextSentence.match(/^[A-Z0-9\u00C0-\u1EF9]/) || 
            nextSentence.match(/^(Câu|Bài|Phần|Chương|I{1,3}V?|V?I{1,3}|[0-9]+[.)])/)) {
          // Natural break point found
          if (currentLength >= maxChunkSize * 0.5) { // Only break if chunk is at least half full
            chunks.push(currentChunk.trim());
            currentChunk = '';
            currentLength = 0;
          }
        }
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`Chunking complete: ${chunks.length} chunks created from ${sentences.length} sentences`);
  return chunks;
}

// Helper function to chunk by lines when sentence tokenization fails
function chunkByLines(lines: string[], maxChunkSize: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n';
      }
      currentChunk += line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export { detectSubjectFromPath, detectDocumentType };