import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

interface EVSConfig {
  username: string;
  password: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface EVSDocumentRequest {
  documentType: 'drivers_license' | 'passport' | 'state_id' | 'id_card' | 'emirates_id' | 'national_id';
  frontImage: Buffer;
  backImage?: Buffer;
  selfieImage: Buffer;
  userId: string;
}

interface EVSVerificationResponse {
  success: boolean;
  transactionId?: string;
  status: 'approved' | 'denied' | 'review' | 'error';
  confidence: number;
  document?: {
    type: string;
    extractedData: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      documentNumber: string;
      expirationDate: string;
      issueDate: string;
      address?: string;
    };
  };
  biometric?: {
    faceMatch: boolean;
    confidence: number;
    livenessScore: number;
  };
  errors?: string[];
  warnings?: string[];
}

// BlueAssure Platform API v3.0.0 Types
interface BlueAssureRequest {
  meta: {
    credentials: {
      username: string;
      password: string;
    };
    customerReference: string;
  };
  data: {
    [key: string]: any;
  };
}

interface BlueAssureResponse {
  meta: {
    transactionId?: number;
    transactionDate: string;
    productName: string;
    productVersion: string;
    customerReference: string;
    dataProviderDuration: string;
    totalDuration: string;
    warnings?: string[];
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
  data?: {
    workflowOutcome?: {
      code: string;
      description: string;
    };
    assureCard?: any;
    assureId?: any;
  };
}

class EVSService {
  private config: EVSConfig;

  constructor() {
    this.config = {
      username: process.env.EVS_API_KEY || 'E27235-CE567A22-0D31-474A-B551-252882763208',
      password: process.env.EVS_PASSWORD || '8aeWPi0XV#AyS#I',
      baseUrl: 'https://blueassure.evssolutions.com',
      environment: (process.env.EVS_ENVIRONMENT as 'sandbox' | 'production') || 'production'
    };
    
    console.log('🔧 EVS Service initialized with BlueAssure Platform API v3.0.0');
    console.log(`   Username: ${this.config.username.substring(0, 10)}...`);
    console.log(`   Environment: ${this.config.environment}`);
  }

  /**
   * Primary verification method using BlueAssure Platform API v3.0.0
   */
  async verifyDocument(request: EVSDocumentRequest): Promise<EVSVerificationResponse> {
          console.log(`🔍 Starting BlueAssure verification for user: ${request.userId}`);
      console.log(`📄 Document type: ${request.documentType}`);
      console.log(`📐 Image sizes - Front: ${request.frontImage?.length || 0} bytes, Back: ${request.backImage?.length || 0} bytes, Selfie: ${request.selfieImage?.length || 0} bytes`);
    
    const mappedDocumentType = this.mapDocumentType(request.documentType);

    if (mappedDocumentType === 'DriversLicense' && (!request.backImage || request.backImage.length === 0)) {
      console.log('❌ Validation failed: Back image is required for card-based documents.');
      return {
        success: false,
        status: 'denied',
        confidence: 0,
        errors: ['A back image is required for this document type. Please upload the back of your ID.'],
      };
    }
    
    try {
      // Validate image quality before sending to BlueAssure
      const qualityCheck = this.validateImageQuality(request);
      if (!qualityCheck.valid) {
        console.log('❌ Image quality validation failed:', qualityCheck.errors);
        return {
          success: false,
          status: 'denied',
          confidence: 0,
          errors: qualityCheck.errors,
          warnings: ['Please retake your photos with better lighting and ensure the entire document is visible']
        };
      }

      // Generate unique customer reference
      const customerReference = `NOTARY_${Date.now()}_${request.userId}`;
      
      // For document verification with photo matching, we'll use AssureCard
      // which includes document validation and biometric matching
      const response = await this.callAssureCard(request, customerReference, mappedDocumentType);
      
      console.log('✅ BlueAssure API call successful');
      return this.mapBlueAssureResponse(response, request);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ BlueAssure verification failed:', errorMessage);
      throw new Error(`EVS verification failed: ${errorMessage}`);
    }
  }

  /**
   * Call BlueAssure AssureCard API for document verification with biometric matching
   */
  private async callAssureCard(request: EVSDocumentRequest, customerReference: string, documentType: string): Promise<BlueAssureResponse> {
    const endpoint = `${this.config.baseUrl}/WebServices/Integrated/Main/V300/AssureCard`;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for image processing
    
    try {
      console.log(`📡 Calling BlueAssure AssureCard endpoint: ${endpoint}`);
      
      const data: any = {
        scanMode: 'DirectImageUpload',
        documentType: documentType,
        frontImage: request.frontImage.toString('base64'),
        portraitImage: request.selfieImage.toString('base64'),
        ssn: null, // AssureID option - not provided
        phoneNumber: '', // AssurePhone option - not provided
        emailAddress: null, // AssureID option - not provided
        ipAddress: null, // AssureID option - not provided
        similarityThreshold: null // AssureWatch option - not provided
      };

      if (request.backImage && request.backImage.length > 0) {
        data.backImage = request.backImage.toString('base64');
      }
      
      // Prepare the BlueAssure API v3.0.0 request
      const blueAssureRequest: BlueAssureRequest = {
        meta: {
          credentials: {
            username: this.config.username,
            password: this.config.password
          },
          customerReference: customerReference
        },
        data
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Host': 'blueassure.evssolutions.com:443',
          'User-Agent': 'NotaryPlatform-BlueAssure/3.0.0'
        },
        body: JSON.stringify(blueAssureRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BlueAssure API error ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as BlueAssureResponse;
      
      // Check for API-level errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `${e.code}: ${e.message}`).join(', ');
        throw new Error(`BlueAssure API errors: ${errorMessages}`);
      }

      console.log(`✅ BlueAssure AssureCard API call successful`);
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ BlueAssure AssureCard API call failed:`, errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Call BlueAssure AssureID API for identity verification (backup method)
   */
  private async callAssureId(userData: any, customerReference: string): Promise<BlueAssureResponse> {
    const endpoint = `${this.config.baseUrl}/WebServices/Integrated/Main/V300/AssureId`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      console.log(`📡 Calling BlueAssure AssureID endpoint: ${endpoint}`);
      
      const blueAssureRequest: BlueAssureRequest = {
        meta: {
          credentials: {
            username: this.config.username,
            password: this.config.password
          },
          customerReference: customerReference
        },
        data: {
          firstName: userData.firstName || '',
          middleName: userData.middleName || null,
          lastName: userData.lastName || '',
          generation: null,
          ssn: userData.ssn || null,
          street: userData.street || '',
          city: userData.city || '',
          state: userData.state || '',
          zipCode: userData.zipCode || '',
          dateOfBirth: userData.dateOfBirth || null, // Format: yyyy-MM-dd
          driverLicenseNumber: userData.driverLicenseNumber || null,
          driverLicenseState: userData.driverLicenseState || null,
          phoneNumber: userData.phoneNumber || null,
          emailAddress: userData.emailAddress || null,
          ipAddress: userData.ipAddress || null
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Host': 'blueassure.evssolutions.com:443',
          'User-Agent': 'NotaryPlatform-BlueAssure/3.0.0'
        },
        body: JSON.stringify(blueAssureRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BlueAssure AssureID API error ${response.status}: ${errorText}`);
      }

      const result = await response.json() as BlueAssureResponse;
      
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `${e.code}: ${e.message}`).join(', ');
        throw new Error(`BlueAssure AssureID errors: ${errorMessages}`);
      }

      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Map document types to BlueAssure format
   */
  private mapDocumentType(type: string): string {
    const typeMap: Record<string, string> = {
      'drivers_license': 'DriversLicense',
      'passport': 'PassportBook',
      'state_id': 'DriversLicense',
      'id_card': 'DriversLicense',
      'emirates_id': 'DriversLicense',
      'national_id': 'DriversLicense'
    };
    
    const mappedType = typeMap[type] || 'DriversLicense';
    console.log(`🔄 Document type mapping: ${type} → ${mappedType}`);
    return mappedType;
  }

  /**
   * Map BlueAssure response to our standard format
   */
  private mapBlueAssureResponse(blueAssureResponse: BlueAssureResponse, originalRequest: EVSDocumentRequest): EVSVerificationResponse {
    let status: 'approved' | 'denied' | 'review' | 'error' = 'denied';
    let confidence = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for presence of the data block
    if (!blueAssureResponse.data) {
        status = 'denied';
        confidence = 0;
        errors.push('The verification service did not return any processing data. This can happen if the document type is not supported by your current plan or if the image quality is too low for processing.');
        warnings.push('Please try again with a different document type (e.g., Passport) or ensure your images are high-quality.');
    } else if (blueAssureResponse.data.workflowOutcome) {
      const outcome = blueAssureResponse.data.workflowOutcome;
      switch (outcome.code) {
        case 'P':
          status = 'approved';
          confidence = 95; // High confidence for pass
          break;
        case 'F':
          status = 'denied';
          confidence = 20; // Low confidence for fail
          break;
        case 'R':
          status = 'review';
          confidence = 70; // Medium confidence for review
          break;
        default:
          status = 'denied'; // Map unknown codes to 'denied' instead of 'error'
          confidence = 0;
          errors.push('Unknown workflow outcome from BlueAssure');
      }
    } else {
      // Data block is present but no workflow outcome - likely image quality issues
      status = 'denied';
      confidence = 0;
      errors.push('Document images could not be processed. Please ensure your images are clear, well-lit, and show the entire document.');
      warnings.push('Common issues: Image too small, blurry, dark, or partially obscured');
      warnings.push('Recommended: Use good lighting, hold camera steady, ensure entire document is visible');
    }

    const response: EVSVerificationResponse = {
      success: status === 'approved',
      transactionId: blueAssureResponse.meta.transactionId?.toString(),
      status,
      confidence
    };

    // Extract document data from AssureCard response
    if (blueAssureResponse.data?.assureCard) {
      const cardData = blueAssureResponse.data.assureCard;
      
      // Check document validation result
      if (cardData.validationResult?.code === '0') {
        confidence = Math.max(confidence, cardData.totalConfidence || 0);
        response.confidence = confidence;
      } else {
        errors.push('Document validation failed');
      }

      // Extract document information
      if (cardData.documentName && cardData.documentInformation) {
        response.document = {
          type: originalRequest.documentType,
          extractedData: {
            firstName: cardData.documentName.firstName || '',
            lastName: cardData.documentName.familyName || cardData.documentName.lastName || '',
            dateOfBirth: this.formatDate(cardData.individualCharacteristics?.dateOfBirth),
            documentNumber: cardData.documentInformation.licenseNumber || '',
            expirationDate: cardData.documentInformation.expirationDate || '',
            issueDate: cardData.documentInformation.issueDate || '',
            address: this.formatAddress(cardData.documentAddress)
          }
        };
      }

      // For AssureCard, biometric matching is built into the validation
      if (cardData.totalConfidence) {
        response.biometric = {
          faceMatch: cardData.totalConfidence >= 70,
          confidence: cardData.totalConfidence,
          livenessScore: cardData.totalConfidence // Use overall confidence as liveness score
        };
      }
    }

    // Extract data from AssureID if available
    if (blueAssureResponse.data?.assureId) {
      const idData = blueAssureResponse.data.assureId;
      
      // Extract standardized address
      if (idData.standardizedAddress) {
        const addr = idData.standardizedAddress;
        response.document = {
          type: originalRequest.documentType,
          extractedData: {
            firstName: addr.firstName || '',
            lastName: addr.lastName || '',
            dateOfBirth: '', // Not typically in address data
            documentNumber: '',
            expirationDate: '',
            issueDate: '',
            address: this.formatStandardizedAddress(addr)
          }
        };
      }
    }

    // Add warnings from meta
    if (blueAssureResponse.meta.warnings) {
      warnings.push(...blueAssureResponse.meta.warnings);
    }

    // Add warnings for low confidence
    if (confidence > 0 && confidence < 85) {
      warnings.push(`Confidence score ${confidence}% is below optimal threshold`);
    }

    if (errors.length > 0) {
      response.errors = errors;
    }

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    return response;
  }

  /**
   * Format date from various BlueAssure formats
   */
  private formatDate(date: any): string {
    if (!date) return '';
    
    if (typeof date === 'string') {
      return date;
    }
    
    if (typeof date === 'object' && date.year && date.month && date.day) {
      const year = date.year.toString().padStart(4, '0');
      const month = date.month.toString().padStart(2, '0');
      const day = date.day.toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return '';
  }

  /**
   * Format address from BlueAssure document address
   */
  private formatAddress(address: any): string {
    if (!address) return '';
    
    const parts = [
      address.address || address.street,
      address.city,
      address.state,
      address.zipCode
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Format standardized address from AssureID
   */
  private formatStandardizedAddress(address: any): string {
    if (!address) return '';
    
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zipCode
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Validate EVS configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.username) {
      errors.push('EVS_API_KEY (username) is required');
    }

    if (!this.config.password) {
      errors.push('EVS_PASSWORD is required');
    }

    if (!this.config.baseUrl) {
      errors.push('EVS_BASE_URL is required');
    }

    if (!['sandbox', 'production'].includes(this.config.environment)) {
      errors.push('EVS_ENVIRONMENT must be either "sandbox" or "production"');
    }

    // Validate API key format (E27235-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)
    const apiKeyPattern = /^E\d{5}-[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i;
    if (this.config.username && !apiKeyPattern.test(this.config.username)) {
      errors.push('EVS_API_KEY format is invalid (should be E27235-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate image quality before sending to BlueAssure
   */
  private validateImageQuality(request: EVSDocumentRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const minImageSize = 50000; // 50KB minimum for realistic document photos
    const maxImageSize = 10 * 1024 * 1024; // 10MB maximum
    const recommendedMinSize = 200000; // 200KB recommended minimum

    // Check front image
    if (!request.frontImage || request.frontImage.length === 0) {
      errors.push('Front image of ID is required');
    } else if (request.frontImage.length < minImageSize) {
      errors.push('Front image is too small (less than 50KB). Please take a higher resolution photo with better lighting.');
    } else if (request.frontImage.length < recommendedMinSize) {
      errors.push('Front image quality may be too low (less than 200KB). For best results, ensure good lighting and hold camera steady.');
    } else if (request.frontImage.length > maxImageSize) {
      errors.push('Front image is too large - please compress the image');
    }

    // Check selfie image
    if (!request.selfieImage || request.selfieImage.length === 0) {
      errors.push('Selfie image is required');
    } else if (request.selfieImage.length < minImageSize) {
      errors.push('Selfie image is too small (less than 50KB). Please take a higher resolution photo with better lighting.');
    } else if (request.selfieImage.length < recommendedMinSize) {
      errors.push('Selfie quality may be too low (less than 200KB). For best results, ensure good lighting and face is clearly visible.');
    } else if (request.selfieImage.length > maxImageSize) {
      errors.push('Selfie image is too large - please compress the image');
    }

    // Check back image if provided (optional for some document types)
    if (request.backImage) {
      if (request.backImage.length > maxImageSize) {
        errors.push('Back image is too large - please compress the image');
      } else if (request.backImage.length < minImageSize) {
        errors.push('Back image is too small (less than 50KB). Please take a higher resolution photo.');
      }
    }

    // Additional format validation
    if (request.frontImage && request.frontImage.length > 0) {
      const frontHeader = request.frontImage.subarray(0, 4);
      if (!this.isValidImageFormat(frontHeader)) {
        errors.push('Front image format not supported. Please use JPEG or PNG format.');
      }
    }

    if (request.selfieImage && request.selfieImage.length > 0) {
      const selfieHeader = request.selfieImage.subarray(0, 4);
      if (!this.isValidImageFormat(selfieHeader)) {
        errors.push('Selfie image format not supported. Please use JPEG or PNG format.');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if buffer starts with valid image format headers
   */
  private isValidImageFormat(header: Buffer): boolean {
    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return true;
    }
    // PNG: 89 50 4E 47
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return true;
    }
    return false;
  }

  /**
   * Identity verification method (main public interface)
   */
  async verifyIdentity(request: EVSDocumentRequest): Promise<EVSVerificationResponse> {
    return this.verifyDocument(request);
  }

  /**
   * Test API connection with current credentials
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      console.log('🔧 Testing BlueAssure Platform API connection...');
      
      const validation = this.validateConfiguration();
      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration errors: ${validation.errors.join(', ')}`
        };
      }

      // Test with a minimal AssureID request (just credentials)
      const testEndpoint = `${this.config.baseUrl}/WebServices/Integrated/Main/V300/AssureId`;
      const testPayload: BlueAssureRequest = {
        meta: {
          credentials: {
            username: this.config.username,
            password: this.config.password
          },
          customerReference: `HEALTH_CHECK_${Date.now()}`
        },
        data: {
          firstName: 'Test',
          lastName: 'Connection',
          street: '123 Test St',
          zipCode: '12345'
        }
      };

      const response = await fetch(testEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Host': 'blueassure.evssolutions.com:443',
          'User-Agent': 'NotaryPlatform-BlueAssure/3.0.0'
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          success: true,
          message: `BlueAssure Platform API connection successful (${response.status})`
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: `BlueAssure API authentication failed (${response.status}). Check your credentials.`
        };
      } else {
        return {
          success: false,
          message: `BlueAssure API responded with status ${response.status}: ${response.statusText}`
        };
      }

    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
        return {
          success: false,
          message: `Network error: Cannot reach BlueAssure servers. Check your internet connection.`
        };
      }
      
      return {
        success: false,
        message: `Connection test failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get verification status for a transaction (not directly supported by BlueAssure Platform API)
   */
  async getVerificationStatus(transactionId: string): Promise<EVSVerificationResponse | null> {
    console.log(`ℹ️ BlueAssure Platform API does not support direct status queries for transaction: ${transactionId}`);
    console.log('   Verification results are returned immediately with the initial request.');
    return null;
  }
}

export const evsService = new EVSService(); 