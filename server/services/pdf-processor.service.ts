import { PDFDocument, PDFPage, rgb, PDFFont, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { documentTags, jobDocuments, documentVersions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { TAG_TYPES } from '../../shared/schema';
import { DigitalSignatureService } from './digital-signature-service';

export interface ProcessedDocument {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  pageCount: number;
  digitalSignatures?: SignatureInfo[];
  isDigitallySigned?: boolean;
  originalDocumentId?: string;
  originalFileName?: string;
}

export interface SignatureInfo {
  signerName: string;
  signerEmail: string;
  signatureTime: Date;
  certificateId: string;
  signatureHash: string;
  signatureType: 'user' | 'notary';
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
  async processCompletedDocument(sessionId: string): Promise<ProcessedDocument[]> {
    try {
      console.log(`🔄 Processing completed document for session: ${sessionId}`);

      // Get session info first
      const sessionInfo = await this.getSessionInfo(sessionId);
      if (!sessionInfo) {
        throw new Error('Session not found');
      }

      // Get all documents for this session's job
      const documents = await this.getAllSessionDocuments(sessionInfo.jobId);
      console.log(`📄 Found ${documents.length} documents to process`);

      if (documents.length === 0) {
        throw new Error('No documents found for session');
      }

      // Process each document separately to maintain individual signed documents
      const processedDocuments = await this.processDocumentsSeparately(sessionId, documents, sessionInfo);
      
      return processedDocuments;

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
      const fontSize = this.getFontSize(tag.tagType, tag.width, tag.height, contentData);
      const textColor = this.getTagColor(tag.tagType, contentData);
      
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
      console.log('🔍 extractImageContent called with:', {
        hasContentData: !!contentData,
        contentDataType: contentData?.type,
        hasContentDataValue: !!contentData?.value,
        contentDataValueType: typeof contentData?.value,
        hasContent: !!content,
        contentType: typeof content,
        contentPreview: typeof content === 'string' ? content.substring(0, 100) + '...' : content
      });

      // Check contentData.value first
      if (contentData?.value) {
        if (typeof contentData.value === 'string') {
          if (contentData.value.startsWith('data:image/')) {
            console.log('✅ Found data URL in contentData.value');
            return contentData.value;
          }
          
          if (contentData.value.startsWith('http') || contentData.value.includes('vultrobjects.com')) {
            console.log('🌐 Downloading image from URL in contentData.value:', contentData.value.substring(0, 100));
            const downloadResult = await PDFProcessorService.downloadImageFromUrl(contentData.value);
            if (downloadResult) {
              console.log('✅ Successfully downloaded image from contentData.value URL');
              return downloadResult;
            } else {
              console.error('❌ Failed to download image from contentData.value URL');
            }
          }
          
          if (this.isBase64String(contentData.value)) {
            console.log('✅ Found base64 string in contentData.value');
            return `data:image/png;base64,${contentData.value}`;
          }
        }
      }

      // Check content field as fallback
      if (content && typeof content === 'string') {
        if (content.startsWith('data:image/')) {
          console.log('✅ Found data URL in content field');
          return content;
        }
        
        if (content.startsWith('http') || content.includes('vultrobjects.com')) {
          console.log('🌐 Downloading image from URL for PDF (fallback):', content.substring(0, 100));
          const downloadResult = await PDFProcessorService.downloadImageFromUrl(content);
          if (downloadResult) {
            console.log('✅ Successfully downloaded image from content field URL');
            return downloadResult;
          } else {
            console.error('❌ Failed to download image from content field URL');
          }
        }
        
        if (this.isBase64String(content)) {
          console.log('✅ Found base64 string in content field');
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

      console.log('❌ No valid image content found');
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
                        pngError: (pngError as Error).message,
            jpgError: (jpgError as Error).message,
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
  private getFontSize(tagType: string, width: number, height: number, contentData?: any): number {
    // If user has set a custom fontSize in contentData, use that
    if (contentData?.fontSize && typeof contentData.fontSize === 'number') {
      // Ensure font size is within reasonable bounds
      const customFontSize = Math.max(6, Math.min(contentData.fontSize, 72));
      console.log(`🎨 Using custom font size ${customFontSize} for tag type ${tagType}`);
      return customFontSize;
    }
    
    // Otherwise, calculate based on tag dimensions (existing logic)
    const baseSize = Math.min(width / 8, height * 0.6);
    
    let calculatedFontSize: number;
    switch (tagType) {
      case 'S': // Signature
      case 'I': // Initials
        calculatedFontSize = Math.max(10, Math.min(baseSize, 14));
        break;
      case 'E': // Seal
        calculatedFontSize = Math.max(6, Math.min(baseSize * 0.7, 10));
        break;
      default:
        calculatedFontSize = Math.max(8, Math.min(baseSize, 12));
        break;
    }
    
    console.log(`📏 Calculated font size ${calculatedFontSize} for tag type ${tagType} (dimensions: ${width}x${height})`);
    return calculatedFontSize;
  }

  /**
   * Get color for tag type
   */
  private getTagColor(tagType: string, contentData?: any): any {
    // If user has set a custom textColor in contentData, use that
    if (contentData?.textColor && typeof contentData.textColor === 'string') {
      try {
        // Parse hex color to RGB
        const hex = contentData.textColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        return rgb(r, g, b);
      } catch (e) {
        console.log('Could not parse custom text color, using default black');
      }
    }
    
    // Always return black color for consistent, professional appearance (default)
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
   * Get session information including job ID
   */
  private async getSessionInfo(sessionId: string): Promise<any> {
    try {
      const { editorSessions } = await import('../../shared/schema');
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);

      console.log(`🔍 DEBUG: getSessionInfo for sessionId ${sessionId}:`, {
        found: !!session,
        sessionData: session,
        hasJobId: !!session?.jobId
      });

      return session;
    } catch (error) {
      console.error('Failed to get session info:', error);
      return null;
    }
  }

  /**
   * Get original document info
   */
  private async getOriginalDocument(sessionId: string): Promise<any> {
    try {
      // First get the session to find the job ID
      const sessionInfo = await this.getSessionInfo(sessionId);

      if (!sessionInfo) {
        throw new Error('Session not found');
      }

      // Get the first document for this session's job
      const [document] = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, sessionInfo.jobId))
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

  /**
   * Get all documents for a session's job
   */
  private async getAllSessionDocuments(jobId: number): Promise<any[]> {
    try {
      const documents = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, jobId))
        .orderBy(jobDocuments.createdAt);

      return documents;
    } catch (error) {
      console.error('Failed to get session documents:', error);
      throw error;
    }
  }

  /**
   * Process and merge multiple documents with their respective tags
   */
  private async processAndMergeDocuments(sessionId: string, documents: any[]): Promise<PDFDocument> {
    try {
      const mergedDoc = await PDFDocument.create();
      
      // Get all tags for this session with document IDs
      const allTags = await this.getSessionTagsWithDocumentId(sessionId);
      
      // Group tags by document ID
      const tagsByDocument = new Map<number, TagPosition[]>();
      for (const tag of allTags) {
        const documentTags = tagsByDocument.get(tag.documentId) || [];
        documentTags.push(tag);
        tagsByDocument.set(tag.documentId, documentTags);
      }

      let totalPageOffset = 0;
      const allAdjustedTags: TagPosition[] = [];
      
      // First pass: merge all documents and collect adjusted tags
      for (const document of documents) {
        const documentTags = tagsByDocument.get(document.id) || [];
        console.log(`📄 Processing document ${document.fileName} with ${documentTags.length} tags`);
        
        // Load the document
        const pdfBuffer = await this.loadDocumentBuffer(document.filePath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        // Adjust tag page numbers for merged document
        const adjustedTags = documentTags.map(tag => ({
          ...tag,
          pageNumber: tag.pageNumber + totalPageOffset
        }));
        
        // Collect all adjusted tags for final application
        allAdjustedTags.push(...adjustedTags);
        
        // Copy pages to merged document
        const pages = await mergedDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach(page => mergedDoc.addPage(page));
        
        totalPageOffset += pdfDoc.getPageCount();
      }
      
      // Second pass: apply all tags to the merged document
      if (allAdjustedTags.length > 0) {
        console.log(`📝 Applying ${allAdjustedTags.length} tags to merged document with ${mergedDoc.getPageCount()} pages`);
        await this.applyTagsToPDF(mergedDoc, allAdjustedTags);
      }
      
      return mergedDoc;
    } catch (error) {
      console.error('❌ Failed to process and merge documents:', error);
      throw error;
    }
  }

  /**
   * Process each document separately to create individual signed documents
   */
  private async processDocumentsSeparately(
    sessionId: string, 
    documents: any[], 
    sessionInfo: any
  ): Promise<ProcessedDocument[]> {
    const processedDocs: ProcessedDocument[] = [];
    
    // Get all tags for this session and group by document
    const allTags = await this.getSessionTagsWithDocumentId(sessionId);
    const tagsByDocument = new Map<number, (TagPosition & { documentId: number })[]>();
    
    // Group tags by document ID
    for (const tag of allTags) {
      const documentTags = tagsByDocument.get(tag.documentId) || [];
      documentTags.push(tag);
      tagsByDocument.set(tag.documentId, documentTags);
    }
    
    console.log(`📄 Processing ${documents.length} documents separately`);
    
    for (const document of documents) {
      const documentTags = tagsByDocument.get(document.id) || [];
      console.log(`📄 Processing document ${document.fileName} with ${documentTags.length} tags`);
      
      if (documentTags.length === 0) {
        console.log(`⚠️ No tags found for document ${document.fileName}, skipping`);
        continue;
      }
      
      try {
        // Load the document
        const pdfBuffer = await this.loadDocumentBuffer(document.filePath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        // Apply tags to this document
        await this.applyTagsToPDF(pdfDoc, documentTags);
        
        // Generate PDF with visual content applied
        const visuallyCompletePdfBuffer = await pdfDoc.save();
        const visualBuffer = Buffer.from(visuallyCompletePdfBuffer);
        
        console.log(`✅ Generated signed PDF for ${document.fileName}: ${visualBuffer.length} bytes`);
        
        // Apply digital signatures to this document
        let finalBuffer = visualBuffer;
        let digitalSignatures: SignatureInfo[] = [];
        let isDigitallySigned = false;
        
        console.log(`🔍 DEBUG: sessionInfo for digital signatures:`, {
          sessionInfo: sessionInfo,
          hasJobId: !!sessionInfo?.jobId,
          jobId: sessionInfo?.jobId
        });
        
        if (sessionInfo?.jobId) {
          console.log(`🔐 Applying digital signatures for ${document.fileName}`);
          
          try {
            const digitalSignatureService = DigitalSignatureService.getInstance();
            console.log(`🔍 DEBUG: About to call signCompletedDocument with jobId: ${sessionInfo.jobId}, sessionId: ${sessionId}`);
            
            const signatureResult = await digitalSignatureService.signCompletedDocument(
              visualBuffer,
              sessionInfo.jobId,
              sessionId
            );
            
            console.log(`🔍 DEBUG: signCompletedDocument result:`, signatureResult);
            
            if (signatureResult.success && signatureResult.signedPdfBuffer) {
              finalBuffer = signatureResult.signedPdfBuffer;
              digitalSignatures = signatureResult.signatures || [];
              isDigitallySigned = true;
              
              console.log(`✅ Digital signatures applied to ${document.fileName}: ${digitalSignatures.length} signatures`);
            } else {
              console.warn(`⚠️ Digital signature application failed for ${document.fileName}: ${signatureResult.error}`);
            }
          } catch (digitalSignatureError) {
            console.error(`❌ Exception during digital signature application for ${document.fileName}:`, digitalSignatureError);
          }
        } else {
          console.log(`⚠️ Skipping digital signatures: sessionInfo.jobId is ${sessionInfo?.jobId}`);
        }
        
        // Create processed document
        const processedDoc: ProcessedDocument = {
          buffer: finalBuffer,
          fileName: `${document.fileName.replace('.pdf', '')}_signed_${Date.now()}.pdf`,
          fileSize: finalBuffer.length,
          pageCount: pdfDoc.getPageCount(),
          digitalSignatures,
          isDigitallySigned,
          originalDocumentId: document.id,
          originalFileName: document.fileName
        };
        
        processedDocs.push(processedDoc);
        
      } catch (error) {
        console.error(`❌ Failed to process document ${document.fileName}:`, error);
        // Continue with other documents instead of failing completely
      }
    }
    
    console.log(`✅ Successfully processed ${processedDocs.length} individual documents`);
    return processedDocs;
  }

  /**
   * Get session tags with document IDs included
   */
  private async getSessionTagsWithDocumentId(sessionId: string): Promise<(TagPosition & { documentId: number })[]> {
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
        isCompleted: tag.isCompleted || false,
        documentId: tag.documentId
      }));
      
    } catch (error) {
      console.error('Failed to get session tags with document ID:', error);
      throw error;
    }
  }
}
