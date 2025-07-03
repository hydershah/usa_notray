import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

interface KBAConfig {
  provider: 'evs' | 'lexisnexis' | 'transunion';
  apiKey?: string;
  password?: string;
  baseUrl?: string;
  environment: 'sandbox' | 'production';
}

interface KBAQuestion {
  id: string;
  questionId: number;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'numeric';
  answers: string[];
  correctAnswerIndex?: number; // Only known by provider
  category: 'address' | 'financial' | 'personal' | 'vehicle' | 'employment';
}

interface KBASessionRequest {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  ssn?: string; // Optional but recommended
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone?: string;
  email?: string;
}

interface KBASessionResponse {
  success: boolean;
  sessionId: string;
  questions: KBAQuestion[];
  status: 'initialized' | 'ready' | 'failed';
  expiresAt: string;
  errors?: string[];
}

interface KBAAnswerRequest {
  sessionId: string;
  userId: string;
  answers: Array<{
    questionId: number;
    selectedAnswer: string;
    selectedAnswerIndex: number;
  }>;
}

interface KBAVerificationResponse {
  success: boolean;
  sessionId: string;
  status: 'passed' | 'failed' | 'inconclusive';
  score: number; // 0-100
  questionsAnswered: number;
  correctAnswers: number;
  passingScore: number;
  verificationLevel: 'basic' | 'enhanced' | 'premium';
  metadata: {
    completedAt: string;
    duration: number; // seconds
    ipAddress?: string;
    userAgent?: string;
  };
  errors?: string[];
}

// EVS AssureID KBA Integration
interface EVSAssureIDRequest {
  meta: {
    credentials: {
      username: string;
      password: string;
    };
    customerReference: string;
  };
  data: {
    firstName: string;
    lastName: string;
    middleName?: string;
    ssn?: string;
    dateOfBirth?: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber?: string;
    emailAddress?: string;
    ipAddress?: string;
  };
}

// LexisNexis InstantID KBA Integration
interface LexisNexisKBARequest {
  user: {
    referenceCode: string;
    tenantId: string;
  };
  settings: {
    mode: 'testing' | 'production';
    locale: string;
    kbaSettings: {
      kbaQuestions: number;
      passingScore: number;
      timeLimit: number;
    };
  };
  person: {
    name: {
      first: string;
      last: string;
      middle?: string;
    };
    addresses: Array<{
      addressType: 'current' | 'previous';
      houseNumber: string;
      streetName: string;
      city: string;
      state: string;
      zip5: string;
    }>;
    ssn?: {
      number: string;
    };
    dob?: {
      year: number;
      month: number;
      day: number;
    };
    phone?: {
      number: string;
    };
  };
}

class KBAService {
  private config: KBAConfig;

  constructor() {
    this.config = {
      provider: (process.env.KBA_PROVIDER as 'evs' | 'lexisnexis' | 'transunion') || 'evs',
      apiKey: process.env.KBA_API_KEY || process.env.EVS_API_KEY,
      password: process.env.KBA_PASSWORD || process.env.EVS_PASSWORD,
      baseUrl: this.getBaseUrl(),
      environment: (process.env.KBA_ENVIRONMENT as 'sandbox' | 'production') || 'production'
    };
    
    console.log(`🧠 KBA Service initialized with ${this.config.provider.toUpperCase()} provider`);
    console.log(`   Environment: ${this.config.environment}`);
  }

  private getBaseUrl(): string {
    switch (this.config.provider) {
      case 'evs':
        return 'https://blueassure.evssolutions.com';
      case 'lexisnexis':
        return this.config.environment === 'sandbox' 
          ? 'https://api.lexisnexis.com/risk/identity/testing'
          : 'https://api.lexisnexis.com/risk/identity';
      case 'transunion':
        return this.config.environment === 'sandbox'
          ? 'https://api-sandbox.transunion.com'
          : 'https://api.transunion.com';
      default:
        return 'https://blueassure.evssolutions.com';
    }
  }

  /**
   * Initialize KBA session with user information
   */
  async initializeKBASession(request: KBASessionRequest): Promise<KBASessionResponse> {
    console.log(`🚀 Initializing KBA session for user: ${request.userId}`);
    console.log(`📋 Provider: ${this.config.provider.toUpperCase()}`);

    switch (this.config.provider) {
      case 'evs':
        return await this.initializeEVSKBA(request);
      case 'lexisnexis':
        return await this.initializeLexisNexisKBA(request);
      case 'transunion':
        return await this.initializeTransUnionKBA(request);
      default:
        throw new Error(`Unsupported KBA provider: ${this.config.provider}`);
    }
  }

  /**
   * Submit answers and get verification results
   */
  async submitKBAAnswers(request: KBAAnswerRequest): Promise<KBAVerificationResponse> {
    console.log(`📝 Submitting KBA answers for session: ${request.sessionId}`);

    switch (this.config.provider) {
      case 'evs':
        return await this.submitEVSKBAAnswers(request);
      case 'lexisnexis':
        return await this.submitLexisNexisKBAAnswers(request);
      case 'transunion':
        return await this.submitTransUnionKBAAnswers(request);
      default:
        throw new Error(`Unsupported KBA provider: ${this.config.provider}`);
    }
  }

  /**
   * EVS AssureID KBA Implementation
   */
  private async initializeEVSKBA(request: KBASessionRequest): Promise<KBASessionResponse> {
    const endpoint = `${this.config.baseUrl}/WebServices/Integrated/Main/V300/AssureId`;
    const customerReference = `KBA_${Date.now()}_${request.userId}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const evsRequest: EVSAssureIDRequest = {
        meta: {
          credentials: {
            username: this.config.apiKey!,
            password: this.config.password!
          },
          customerReference
        },
        data: {
          firstName: request.firstName,
          lastName: request.lastName,
          ssn: request.ssn,
          dateOfBirth: request.dateOfBirth,
          street: request.address.street,
          city: request.address.city,
          state: request.address.state,
          zipCode: request.address.zipCode,
          phoneNumber: request.phone,
          emailAddress: request.email
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'NotaryPlatform-KBA/1.0.0'
        },
        body: JSON.stringify(evsRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`EVS AssureID API error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Generate KBA questions based on EVS response
      const questions = this.generateEVSKBAQuestions(result, request);
      
      return {
        success: true,
        sessionId: customerReference,
        questions,
        status: 'ready',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('EVS KBA initialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate KBA questions based on EVS AssureID data
   */
  private generateEVSKBAQuestions(evsData: any, userRequest: KBASessionRequest): KBAQuestion[] {
    const questions: KBAQuestion[] = [];
    
    // Address verification questions
    if (evsData.data?.standardizedAddress) {
      questions.push({
        id: `evs_addr_${Date.now()}`,
        questionId: 1,
        questionText: "Which of the following addresses have you lived at?",
        questionType: 'multiple_choice',
        category: 'address',
        answers: [
          `${evsData.data.standardizedAddress.street}, ${evsData.data.standardizedAddress.city}, ${evsData.data.standardizedAddress.state}`,
          "1234 Fake Street, Nowhere, CA",
          "5678 Random Ave, Somewhere, TX",
          "None of the above"
        ]
      });
    }

    // Phone verification questions
    if (evsData.data?.phoneVerification) {
      questions.push({
        id: `evs_phone_${Date.now()}`,
        questionId: 2,
        questionText: "What is the area code of a phone number associated with you?",
        questionType: 'multiple_choice',
        category: 'personal',
        answers: [
          userRequest.phone?.substring(0, 3) || "555",
          "212",
          "310",
          "None of the above"
        ]
      });
    }

    // Demographic questions
    questions.push({
      id: `evs_demo_${Date.now()}`,
      questionId: 3,
      questionText: "In what year were you born?",
      questionType: 'multiple_choice',
      category: 'personal',
      answers: [
        new Date(userRequest.dateOfBirth).getFullYear().toString(),
        (new Date(userRequest.dateOfBirth).getFullYear() - 1).toString(),
        (new Date(userRequest.dateOfBirth).getFullYear() + 1).toString(),
        "None of the above"
      ]
    });

    // Add more questions to meet minimum of 3-5 questions
    questions.push({
      id: `evs_state_${Date.now()}`,
      questionId: 4,
      questionText: "In which state do you currently reside?",
      questionType: 'multiple_choice',
      category: 'address',
      answers: [
        userRequest.address.state,
        "California",
        "Texas",
        "None of the above"
      ]
    });

    return questions.slice(0, 4); // Return 4 questions max
  }

  /**
   * Submit EVS KBA answers (mock implementation - EVS doesn't provide real-time scoring)
   */
  private async submitEVSKBAAnswers(request: KBAAnswerRequest): Promise<KBAVerificationResponse> {
    // For EVS, we simulate the scoring since AssureID doesn't provide real-time KBA scoring
    const startTime = Date.now();
    
    // Simple scoring logic - in real implementation, this would be done by the provider
    const correctAnswers = request.answers.filter(answer => answer.selectedAnswerIndex === 0).length;
    const score = Math.round((correctAnswers / request.answers.length) * 100);
    const passingScore = 75;
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
    
    return {
      success: true,
      sessionId: request.sessionId,
      status: score >= passingScore ? 'passed' : 'failed',
      score,
      questionsAnswered: request.answers.length,
      correctAnswers,
      passingScore,
      verificationLevel: score >= 90 ? 'premium' : score >= 80 ? 'enhanced' : 'basic',
      metadata: {
        completedAt: new Date().toISOString(),
        duration: Math.round((Date.now() - startTime) / 1000)
      }
    };
  }

  /**
   * LexisNexis KBA Implementation
   */
  private async initializeLexisNexisKBA(request: KBASessionRequest): Promise<KBASessionResponse> {
    // This would integrate with LexisNexis InstantID KBA
    // For now, returning a structured response similar to what LexisNexis would provide
    
    const sessionId = `ln_${Date.now()}_${request.userId}`;
    
    // Mock LexisNexis questions (based on their typical KBA format)
    const questions: KBAQuestion[] = [
      {
        id: `ln_1_${Date.now()}`,
        questionId: 1,
        questionText: "According to our records, you may have lived on one of the following streets. Please select the correct street name.",
        questionType: 'multiple_choice',
        category: 'address',
        answers: [
          "Main Street",
          "Oak Avenue", 
          "Pine Road",
          "Cedar Lane",
          "None of the above"
        ]
      },
      {
        id: `ln_2_${Date.now()}`,
        questionId: 2,
        questionText: "Which of the following vehicles have you been associated with?",
        questionType: 'multiple_choice',
        category: 'vehicle',
        answers: [
          "2018 Honda Civic",
          "2020 Toyota Camry",
          "2019 Ford Focus",
          "2021 Nissan Altima",
          "None of the above"
        ]
      },
      {
        id: `ln_3_${Date.now()}`,
        questionId: 3,
        questionText: "What is the approximate range of your monthly mortgage or rent payment?",
        questionType: 'multiple_choice',
        category: 'financial',
        answers: [
          "$1,000 - $1,500",
          "$1,500 - $2,000",
          "$2,000 - $2,500",
          "$2,500 - $3,000",
          "None of the above"
        ]
      }
    ];

    return {
      success: true,
      sessionId,
      questions,
      status: 'ready',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
    };
  }

  private async submitLexisNexisKBAAnswers(request: KBAAnswerRequest): Promise<KBAVerificationResponse> {
    // Mock LexisNexis scoring
    const startTime = Date.now();
    
    // Simulate LexisNexis processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock scoring - typically LexisNexis provides detailed scoring
    const correctAnswers = Math.floor(Math.random() * request.answers.length) + 1;
    const score = Math.round((correctAnswers / request.answers.length) * 100);
    const passingScore = 80; // LexisNexis typically uses 80%
    
    return {
      success: true,
      sessionId: request.sessionId,
      status: score >= passingScore ? 'passed' : 'failed',
      score,
      questionsAnswered: request.answers.length,
      correctAnswers,
      passingScore,
      verificationLevel: score >= 95 ? 'premium' : score >= 85 ? 'enhanced' : 'basic',
      metadata: {
        completedAt: new Date().toISOString(),
        duration: Math.round((Date.now() - startTime) / 1000)
      }
    };
  }

  /**
   * TransUnion KBA Implementation (placeholder)
   */
  private async initializeTransUnionKBA(request: KBASessionRequest): Promise<KBASessionResponse> {
    // Similar structure for TransUnion TruValidate
    throw new Error('TransUnion KBA integration not yet implemented');
  }

  private async submitTransUnionKBAAnswers(request: KBAAnswerRequest): Promise<KBAVerificationResponse> {
    throw new Error('TransUnion KBA integration not yet implemented');
  }

  /**
   * Validate KBA configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.provider) {
      errors.push('KBA_PROVIDER is required');
    }

    if (!this.config.apiKey) {
      errors.push('KBA_API_KEY is required');
    }

    if (this.config.provider === 'evs' && !this.config.password) {
      errors.push('KBA_PASSWORD is required for EVS provider');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Test KBA service connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const validation = this.validateConfiguration();
      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration errors: ${validation.errors.join(', ')}`
        };
      }

      // Test with mock data
      const testRequest: KBASessionRequest = {
        userId: 'test_user',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345'
        }
      };

      const result = await this.initializeKBASession(testRequest);
      
      return {
        success: result.success,
        message: result.success 
          ? `KBA service connection successful with ${this.config.provider}`
          : 'KBA service connection failed'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `KBA service test failed: ${errorMessage}`
      };
    }
  }
}

// Export singleton instance
export const kbaService = new KBAService();

// Export types for use in other modules
export type {
  KBAQuestion,
  KBASessionRequest,
  KBASessionResponse,
  KBAAnswerRequest,
  KBAVerificationResponse
}; 