import { PDFDocument, PDFPage, rgb, PDFFont, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { documentTags, jobDocuments, documentVersions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { TAG_TYPES } from '../../shared/schema';

export interface ProcessedDocument {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  pageCount: number;
}

export interface TagPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  content?: string;
  contentData?: string;
  contentType?: string;
  tagType: string;
  isCompleted?: boolean;
}

export class PDFProcessorService {
  private static instance: PDFProcessorService;

  public static getInstance(): PDFProcessorService {
    if (!PDFProcessorService.instance) {
      PDFProcessorService.instance = new PDFProcessorService();
    }
    return PDFProcessorService.instance;
  }

  /**
   * Process completed tagging session and generate final PDF with tags applied
   */
  async processCompletedDocument(sessionId: string): Promise<ProcessedDocument> {
    try {
      console.log(`🔄 Processing completed document for session: ${sessionId}`);

      // Get all tags for this session
      const tags = await this.getSessionTags(sessionId);
      console.log(`📌 Found ${tags.length} tags to apply`);

      if (tags.length === 0) {
        throw new Error('No tags found for session');
      }

      // Get original document
      const originalDocument = await this.getOriginalDocument(sessionId);
      console.log(`📄 Original document: ${originalDocument.fileName}`);

      // Load PDF
      const pdfBuffer = await this.loadDocumentBuffer(originalDocument.filePath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      // Apply tags to PDF
      await this.applyTagsToPDF(pdfDoc, tags);
      
      // Generate final PDF buffer
      const finalPdfBuffer = await pdfDoc.save();
      const finalBuffer = Buffer.from(finalPdfBuffer);

      console.log(`✅ Generated final PDF: ${finalBuffer.length} bytes`);

      return {
        buffer: finalBuffer,
        fileName: `completed_${originalDocument.fileName}`,
        fileSize: finalBuffer.length,
        pageCount: pdfDoc.getPageCount()
      };

    } catch (error) {
      console.error('❌ Failed to process completed document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply tags to PDF document
   */
  private async applyTagsToPDF(pdfDoc: PDFDocument, tags: TagPosition[]): Promise<void> {
    try {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Group tags by page
      const tagsByPage = this.groupTagsByPage(tags);
      
      for (const [pageNum, pageTags] of Array.from(tagsByPage.entries())) {
        const page = pdfDoc.getPage(pageNum - 1); // PDF pages are 0-indexed
        const { height: pageHeight } = page.getSize();
        
        console.log(`📄 Processing page ${pageNum} with ${pageTags.length} tags`);
        
        for (const tag of pageTags) {
          await this.applyTagToPage(page, tag, font, boldFont, pageHeight);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to apply tags to PDF:', error);
      throw error;
    }
  }

  /**
   * Apply individual tag to PDF page
   */
  private async applyTagToPage(
    page: PDFPage, 
    tag: TagPosition, 
    font: PDFFont, 
    boldFont: PDFFont,
    pageHeight: number
  ): Promise<void> {
    try {
      // Convert coordinates (PDF origin is bottom-left, but tags are positioned from top-left)
      const pdfY = pageHeight - tag.y - tag.height;
      
      const tagInfo = TAG_TYPES[tag.tagType as keyof typeof TAG_TYPES];
      
      // Parse contentData if available
      let contentData: any = null;
      if (tag.contentData) {
        try {
          contentData = typeof tag.contentData === 'string' ? JSON.parse(tag.contentData) : tag.contentData;
        } catch (e) {
          console.log('Could not parse contentData, using raw value');
          contentData = { type: 'text', value: tag.contentData };
        }
      }
      
      // Determine actual content to apply
      const content = contentData?.value || tag.content || `[${tagInfo?.name || tag.tagType}]`;
      
      // Determine styling based on tag type
      const isNotaryTag = ['N', 'X', 'O', 'E'].includes(tag.tagType);
      const currentFont = isNotaryTag ? boldFont : font;
      const fontSize = this.getFontSize(tag.tagType, tag.width, tag.height);
      const textColor = this.getTagColor(tag.tagType);
      
      // Handle special tag types
      switch (tag.tagType) {
        case 'E': // Notary seal
          // Enhanced seal image detection
          const sealImageContent = await this.extractImageContent(contentData, content);
          if (sealImageContent) {
            // Draw actual seal image
            await this.drawSignatureImage(page, tag.x, pdfY, tag.width, tag.height, sealImageContent);
          } else {
            // Draw placeholder seal
            await this.drawNotarySeal(page, tag.x, pdfY, tag.width, tag.height, content);
          }
          break;
          
        case 'W': // Whiteout
          this.drawWhiteout(page, tag.x, pdfY, tag.width, tag.height);
          break;
          
        case 'S': // Signature
        case 'I': // Initials
          // Enhanced image detection logic
          const imageContent = await this.extractImageContent(contentData, content);
          if (imageContent) {
            // Draw actual signature image
            await this.drawSignatureImage(page, tag.x, pdfY, tag.width, tag.height, imageContent);
          } else {
            // Draw text signature/initials
            this.drawTextField(page, tag.x, pdfY, tag.width, tag.height, content, currentFont, fontSize, textColor);
          }
          break;
          
        default: // Text fields
          this.drawTextField(page, tag.x, pdfY, tag.width, tag.height, content, currentFont, fontSize, textColor);
          break;
      }
      
      console.log(`✅ Applied tag ${tag.tagType} at (${tag.x}, ${tag.y}) with content: ${tag.isCompleted ? 'COMPLETED' : 'placeholder'}`);
      
    } catch (error) {
      console.error(`❌ Failed to apply tag ${tag.tagType}:`, error);
      // Don't throw - continue with other tags
    }
  }

  /**
   * Draw text field on PDF
   */
  private drawTextField(
    page: PDFPage, 
    x: number, 
    y: number, 
    width: number, 
    height: number,
    text: string,
    font: PDFFont,
    fontSize: number,
    color: any
  ): void {
    // No background rectangle - transparent background for clean appearance
    
    // Draw text with black color for consistency
    page.drawText(text, {
      x: x + 4,
      y: y + (height / 2) - (fontSize / 2),
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0), // Force black text color
    });
  }

  /**
   * Draw signature placeholder
   */
  private drawSignaturePlaceholder(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    font: PDFFont,
    fontSize: number
  ): void {
    // Draw signature line
    page.drawLine({
      start: { x: x, y: y + height - 5 },
      end: { x: x + width, y: y + height - 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Draw X to indicate signature location
    page.drawText('X', {
      x: x + 5,
      y: y + 5,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0), // Changed from gray to black for consistency
    });
  }

  /**
   * Draw whiteout rectangle
   */
  private drawWhiteout(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    page.drawRectangle({
      x: x,
      y: y,
      width: width,
      height: height,
      color: rgb(1, 1, 1), // White
    });
  }

  /**
   * Extract image content from contentData or content field
   */
  private async extractImageContent(contentData: any, content: string): Promise<string | null> {
    try {
      // Check if contentData has image content (new structured format)
      if (contentData?.value && typeof contentData.value === 'string') {
        const value = contentData.value;
        
        // Check if it's already base64 data
        if (value.startsWith('data:image/')) {
          return value;
        }
        
        // Check if it's a Vultr URL or regular URL
        if (value.startsWith('http') || value.includes('vultrobjects.com')) {
          console.log('🌐 Downloading image from URL for PDF (structured):', value.substring(0, 100));
          return await PDFProcessorService.downloadImageFromUrl(value);
        }
        
        // Check if it's just base64 without the data: prefix
        if (this.isBase64String(value)) {
          // Try to determine format and add proper prefix
          return `data:image/png;base64,${value}`;
        }
      }
      
      // FALLBACK: Handle legacy format where contentData might be a direct URL string
      if (typeof contentData === 'string' && contentData.length > 0) {
        // Check if contentData itself is a URL (legacy format)
        if (contentData.startsWith('http') || contentData.includes('vultrobjects.com')) {
          console.log('🌐 Downloading image from URL for PDF (legacy contentData):', contentData.substring(0, 100));
          return await PDFProcessorService.downloadImageFromUrl(contentData);
        }
        
        // Check if it's base64 data
        if (contentData.startsWith('data:image/')) {
          return contentData;
        }
        
        if (this.isBase64String(contentData)) {
          return `data:image/png;base64,${contentData}`;
        }
      }
      
      // Check content field as fallback
      if (content && typeof content === 'string') {
        if (content.startsWith('data:image/')) {
          return content;
        }
        
        if (content.startsWith('http') || content.includes('vultrobjects.com')) {
          console.log('🌐 Downloading image from URL for PDF (fallback):', content.substring(0, 100));
          return await PDFProcessorService.downloadImageFromUrl(content);
        }
        
        if (this.isBase64String(content)) {
          return `data:image/png;base64,${content}`;
        }
      }
      
      // Check if contentData type indicates it should be an image
      if (contentData?.type && ['signature', 'initials', 'seal', 'stamp'].includes(contentData.type)) {
        console.log('⚠️ Content type indicates image but no valid image data found:', {
          type: contentData.type,
          hasValue: !!contentData.value,
          valueType: typeof contentData.value,
          valuePreview: typeof contentData.value === 'string' ? contentData.value.substring(0, 50) : contentData.value
        });
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Failed to extract image content:', error);
      return null;
    }
  }

  /**
   * Download image from URL and convert to base64
   */
  private static async downloadImageFromUrl(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'USA-Notary-PDF-Processor/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Check if this is a 403 error (expired signed URL) from Vultr
        if (response.status === 403 && url.includes('vultrobjects.com')) {
          console.warn('🔑 Vultr signed URL expired (403), attempting to regenerate...');
                     return await PDFProcessorService.regenerateVultrUrl(url);
        }
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      console.log(`✅ Downloaded image from URL: ${buffer.length} bytes, type: ${contentType}`);
      return `data:${contentType};base64,${base64}`;
      
    } catch (error) {
      console.error('❌ Failed to download image from URL:', error);
      return null;
    }
  }

  /**
   * Regenerate expired Vultr signed URL and retry download
   */
  private static async regenerateVultrUrl(expiredUrl: string): Promise<string | null> {
    try {
      // Extract file key from expired Vultr URL
      // Format: https://usanotary.ewr1.vultrobjects.com/development/signature/...?X-Amz-...
      const urlParts = expiredUrl.split('vultrobjects.com/')[1];
      if (!urlParts) {
        throw new Error('Cannot extract file key from Vultr URL');
      }
      
      const fileKey = urlParts.split('?')[0]; // Remove query parameters
      console.log('🔑 Extracted file key from expired URL:', fileKey);
      
      // Generate fresh signed URL using cloud storage service
      const { cloudStorage } = await import('../lib/cloud-storage-service');
      const freshUrl = await cloudStorage.getSignedUrl(fileKey, 3600); // 1 hour expiry
      
      console.log('✨ Generated fresh signed URL for expired image');
      
      // Retry download with fresh URL
      return await PDFProcessorService.downloadImageFromUrl(freshUrl);
      
    } catch (error) {
      console.error('❌ Failed to regenerate Vultr URL:', error);
      return null;
    }
  }

  /**
   * Check if string is valid base64
   */
  private isBase64String(str: string): boolean {
    try {
      // Basic base64 validation
      if (!str || str.length === 0) return false;
      
      // Check if it's a reasonable length and format
      if (str.length < 100 || str.length > 1000000) return false; // Too short or too long
      
      // Check for base64 characters
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(str)) return false;
      
      // Try to decode
      Buffer.from(str, 'base64');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Draw signature image on PDF
   */
  private async drawSignatureImage(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: string
  ): Promise<void> {
    try {
      console.log('🖼️ Drawing signature image:', {
        x, y, width, height,
        dataType: imageData.startsWith('data:') ? 'data URL' : 'raw base64',
        dataLength: imageData.length,
        preview: imageData.substring(0, 100)
      });
      
      // Extract base64 data if it's a data URL
      let base64Data = imageData;
      if (imageData.includes('base64,')) {
        base64Data = imageData.split('base64,')[1];
      }
      
      // Validate base64 data
      if (!base64Data || base64Data.length < 100) {
        throw new Error('Invalid or too short base64 data');
      }
      
      const imageBytes = Buffer.from(base64Data, 'base64');
      console.log(`📐 Image buffer size: ${imageBytes.length} bytes`);
      
      // Try to embed as PNG first, then JPG, then WEBP
      let image;
      let imageFormat = 'unknown';
      
      try {
        image = await page.doc.embedPng(imageBytes);
        imageFormat = 'PNG';
      } catch (pngError) {
        try {
          image = await page.doc.embedJpg(imageBytes);
          imageFormat = 'JPG';
        } catch (jpgError) {
          // Try as WEBP (if supported in future)
          console.error('Failed to embed image as PNG or JPG:', { 
            pngError: pngError.message, 
            jpgError: jpgError.message,
            bufferSize: imageBytes.length,
            first20Bytes: Array.from(imageBytes.slice(0, 20)).map(b => b.toString(16)).join(' ')
          });
          
          // Fallback to text
          this.drawTextField(page, x, y, width, height, '[Image Error]', 
            await page.doc.embedFont(StandardFonts.Helvetica), 12, rgb(0.7, 0, 0));
          return;
        }
      }
      
      console.log(`✅ Successfully embedded image as ${imageFormat}`);
      
      // Calculate aspect ratio to fit within bounds
      const imgDims = image.scale(1);
      const scaleX = width / imgDims.width;
      const scaleY = height / imgDims.height;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding
      
      const scaledWidth = imgDims.width * scale;
      const scaledHeight = imgDims.height * scale;
      
      // Center the image within the bounds
      const centerX = x + (width - scaledWidth) / 2;
      const centerY = y + (height - scaledHeight) / 2;
      
      console.log(`📏 Image scaling: original=${imgDims.width}x${imgDims.height}, scaled=${scaledWidth}x${scaledHeight}, position=${centerX},${centerY}`);
      
      page.drawImage(image, {
        x: centerX,
        y: centerY,
        width: scaledWidth,
        height: scaledHeight,
      });
      
      console.log('✅ Image drawn successfully on PDF');
      
    } catch (error) {
      console.error('❌ Failed to draw signature image:', error);
      // Fallback to text with error indication
      this.drawTextField(page, x, y, width, height, '[Image Failed]', 
        await page.doc.embedFont(StandardFonts.Helvetica), 12, rgb(0.7, 0, 0));
    }
  }

  /**
   * Draw notary seal placeholder
   */
  private async drawNotarySeal(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    sealContent?: string
  ): Promise<void> {
    // Draw circular seal outline
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 2 - 2;
    
    // Draw circle (approximate with rectangle for now)
    page.drawRectangle({
      x: x + 2,
      y: y + 2,
      width: width - 4,
      height: height - 4,
      borderColor: rgb(0, 0, 0),
      borderWidth: 2,
    });
    
    // Add seal text
    page.drawText('NOTARY SEAL', {
      x: centerX - 25,
      y: centerY - 5,
      size: 8,
      color: rgb(0, 0, 0),
    });
  }

  /**
   * Get appropriate font size for tag
   */
  private getFontSize(tagType: string, width: number, height: number): number {
    const baseSize = Math.min(width / 8, height * 0.6);
    
    switch (tagType) {
      case 'S': // Signature
      case 'I': // Initials
        return Math.max(10, Math.min(baseSize, 14));
      case 'E': // Seal
        return Math.max(6, Math.min(baseSize * 0.7, 10));
      default:
        return Math.max(8, Math.min(baseSize, 12));
    }
  }

  /**
   * Get color for tag type
   */
  private getTagColor(tagType: string): any {
    // Always return black color for consistent, professional appearance
    return rgb(0, 0, 0);
  }

  /**
   * Group tags by page number
   */
  private groupTagsByPage(tags: TagPosition[]): Map<number, TagPosition[]> {
    const grouped = new Map<number, TagPosition[]>();
    
    for (const tag of tags) {
      const pageNum = tag.pageNumber;
      if (!grouped.has(pageNum)) {
        grouped.set(pageNum, []);
      }
      grouped.get(pageNum)!.push(tag);
    }
    
    return grouped;
  }

  /**
   * Get session tags from database
   */
  private async getSessionTags(sessionId: string): Promise<TagPosition[]> {
    try {
      const { editorSessions } = await import('../../shared/schema');
      
      // First get the session to get the actual session ID
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
        
      if (!session) {
        throw new Error('Session not found');
      }
      
      const tags = await db
        .select()
        .from(documentTags)
        .where(eq(documentTags.sessionId, session.id));

      return tags.map(tag => ({
        x: tag.xPosition,
        y: tag.yPosition,
        width: tag.width,
        height: tag.height,
        pageNumber: tag.pageNumber,
        content: tag.content || undefined,
        contentData: tag.contentData || undefined,
        contentType: tag.contentType || undefined,
        tagType: tag.tagType,
        isCompleted: tag.isCompleted || false
      }));
      
    } catch (error) {
      console.error('Failed to get session tags:', error);
      throw error;
    }
  }

  /**
   * Get original document info
   */
  private async getOriginalDocument(sessionId: string): Promise<any> {
    try {
      // First get the session to find the job ID
      const { editorSessions } = await import('../../shared/schema');
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);

      if (!session) {
        throw new Error('Session not found');
      }

      // Get the first document for this session's job
      const [document] = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, session.jobId))
        .limit(1);

      if (!document) {
        throw new Error('No document found for session job');
      }

      return document;
      
    } catch (error) {
      console.error('Failed to get original document:', error);
      throw error;
    }
  }

  /**
   * Load document buffer from file system or Vultr cloud storage
   */
  private async loadDocumentBuffer(filePath: string): Promise<Buffer> {
    try {
      console.log(`📄 Loading document from: ${filePath}`);
      
      // Check if this is a Vultr file (doesn't start with / or contain file system path separators)
      const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
      
      if (isVultrFile) {
        // Handle Vultr cloud storage
        console.log('☁️ Downloading document from Vultr cloud storage');
        
        const { cloudStorage } = await import('../lib/cloud-storage-service');
        
        // Check if file exists in Vultr
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          throw new Error(`Document not found in cloud storage: ${filePath}`);
        }
        
        // Get signed URL to download the file content
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 300); // 5 minutes for processing
        
        // Fetch the file content from Vultr with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for PDF processing
        
        try {
          const response = await fetch(signedUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'USA-Notary-PDF-Processor/1.0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to download PDF from Vultr: ${response.status} ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log(`✅ Downloaded document from Vultr: ${buffer.length} bytes`);
          return buffer;
          
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
        
      } else {
        // Local file
        console.log('📁 Loading document from local file system');
        const fullPath = path.resolve(filePath);
        const buffer = await fs.readFile(fullPath);
        console.log(`✅ Loaded local document: ${buffer.length} bytes`);
        return buffer;
      }
      
    } catch (error) {
      console.error('❌ Failed to load document buffer:', error);
      throw error;
    }
  }
}
