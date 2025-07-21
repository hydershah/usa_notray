import fetch from 'node-fetch';
import { db } from '../db.js';
import { users, kbaSessions } from '../../shared/schema.js';
import { eq, and, gte } from 'drizzle-orm';

interface EVSKBAQuestion {
  text: string;
  questionType: number;
  answers: Array<{
    text: string;
    isCorrect: boolean;
  }>;
}

interface KBASessionData {
  sessionId: string;
  userId: number;
  questions: EVSKBAQuestion[];
  status: 'active' | 'completed' | 'failed' | 'expired' | 'locked';
  attempts: number;
  expiresAt: Date;
  lockedUntil?: Date;
}

interface KBASubmission {
  sessionId: string;
  userId: number;
  answers: Array<{
    questionIndex: number;
    selectedAnswerIndex: number;
  }>;
}

interface KBAResult {
  success: boolean;
  status: 'passed' | 'failed' | 'locked' | 'expired';
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  attemptsRemaining: number;
  lockedUntil?: Date;
  canRetry: boolean;
}

class EnhancedKBAService {
  private readonly PASSING_SCORE = 80; // 4 out of 5 questions (80%)
  private readonly MAX_ATTEMPTS = 2;
  private readonly LOCKOUT_HOURS = 24;
  private readonly SESSION_TIMEOUT_MINUTES = 10;
  private readonly QUESTIONS_PER_SESSION = 5;

  /**
   * Initialize KBA session with questions from EVS verification
   */
  async initializeKBAFromEVSQuestions(
    userId: number, 
    evsKBAQuestions: EVSKBAQuestion[]
  ): Promise<KBASessionData> {
    console.log(`🧠 Initializing KBA session for user ${userId} with EVS questions`);

    // Check if user is currently locked out
    const lockStatus = await this.checkUserLockStatus(userId);
    if (lockStatus.isLocked) {
      throw new Error(`User is locked out until ${lockStatus.lockedUntil?.toISOString()}`);
    }

    // Select 5 random questions from the EVS response
    const selectedQuestions = this.selectRandomQuestions(evsKBAQuestions, this.QUESTIONS_PER_SESSION);
    
    const sessionId = `kba_${Date.now()}_${userId}`;
    const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_MINUTES * 60 * 1000);

    // Get current attempt count
    const attemptCount = await this.getUserAttemptCount(userId);

    // Create session record
    await db.insert(kbaSessions).values({
      sessionId,
      userId,
      status: 'initialized',
      questionsCount: selectedQuestions.length,
      questionsAnswered: 0,
      correctAnswers: 0,
      score: 0,
      provider: 'evs',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const sessionData: KBASessionData = {
      sessionId,
      userId,
      questions: selectedQuestions,
      status: 'active',
      attempts: attemptCount,
      expiresAt
    };

    console.log(`✅ KBA session ${sessionId} created with ${selectedQuestions.length} questions`);
    return sessionData;
  }

  /**
   * Submit KBA answers and calculate results
   */
  async submitKBAAnswers(submission: KBASubmission): Promise<KBAResult> {
    console.log(`📝 Processing KBA submission for session ${submission.sessionId}`);

    // Get session data
    const [session] = await db
      .select()
      .from(kbaSessions)
      .where(eq(kbaSessions.sessionId, submission.sessionId))
      .limit(1);

    if (!session) {
      throw new Error('KBA session not found');
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      await this.updateSessionStatus(submission.sessionId, 'expired');
      return {
        success: false,
        status: 'expired',
        score: 0,
        correctAnswers: 0,
        totalQuestions: session.questionsCount,
        attemptsRemaining: 0,
        canRetry: false
      };
    }

    // Get the original questions (in production, you'd store these in session)
    // For now, we'll need to pass them or retrieve them from cache
    const questions = await this.getSessionQuestions(submission.sessionId);
    
    // Calculate score
    let correctAnswers = 0;
    submission.answers.forEach((answer, index) => {
      if (questions[answer.questionIndex]?.answers[answer.selectedAnswerIndex]?.isCorrect) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = score >= this.PASSING_SCORE;

    // Update session
    await db
      .update(kbaSessions)
      .set({
        questionsAnswered: submission.answers.length,
        correctAnswers,
        score,
        status: passed ? 'completed' : 'failed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(kbaSessions.sessionId, submission.sessionId));

    // Update user KBA status if passed
    if (passed) {
      await db
        .update(users)
        .set({
          kbaVerified: true,
          kbaVerificationDate: new Date(),
          kbaScore: score,
          kbaProvider: 'evs',
          kbaSessionsCompleted: db.$count(),
          updatedAt: new Date()
        })
        .where(eq(users.id, submission.userId));

      console.log(`✅ User ${submission.userId} passed KBA with score ${score}%`);
    } else {
      // Handle failure and potential lockout
      await this.handleKBAFailure(submission.userId);
    }

    const attemptCount = await this.getUserAttemptCount(submission.userId);
    const attemptsRemaining = Math.max(0, this.MAX_ATTEMPTS - attemptCount);
    const canRetry = attemptsRemaining > 0 && !passed;

    return {
      success: passed,
      status: passed ? 'passed' : 'failed',
      score,
      correctAnswers,
      totalQuestions: questions.length,
      attemptsRemaining,
      canRetry
    };
  }

  /**
   * Select random questions from EVS response
   */
  private selectRandomQuestions(allQuestions: EVSKBAQuestion[], count: number): EVSKBAQuestion[] {
    if (allQuestions.length <= count) {
      return allQuestions;
    }

    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Check if user is currently locked out
   */
  private async checkUserLockStatus(userId: number): Promise<{isLocked: boolean, lockedUntil?: Date}> {
    const [user] = await db
      .select({
        kbaLockedUntil: users.kbaLockedUntil,
        kbaAttemptsUsed: users.kbaAttemptsUsed
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { isLocked: false };
    }

    if (user.kbaLockedUntil && new Date() < user.kbaLockedUntil) {
      return { 
        isLocked: true, 
        lockedUntil: user.kbaLockedUntil 
      };
    }

    return { isLocked: false };
  }

  /**
   * Get user's current attempt count
   */
  private async getUserAttemptCount(userId: number): Promise<number> {
    const [user] = await db
      .select({ kbaAttemptsUsed: users.kbaAttemptsUsed })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.kbaAttemptsUsed || 0;
  }

  /**
   * Handle KBA failure and potential lockout
   */
  private async handleKBAFailure(userId: number): Promise<void> {
    const currentAttempts = await this.getUserAttemptCount(userId);
    const newAttemptCount = currentAttempts + 1;

    console.log(`❌ User ${userId} failed KBA attempt ${newAttemptCount}/${this.MAX_ATTEMPTS}`);

    if (newAttemptCount >= this.MAX_ATTEMPTS) {
      // Lock user for 24 hours
      const lockedUntil = new Date(Date.now() + this.LOCKOUT_HOURS * 60 * 60 * 1000);
      
      await db
        .update(users)
        .set({
          kbaAttemptsUsed: newAttemptCount,
          kbaLockedUntil: lockedUntil,
          kbaLockoutReason: 'Too many failed attempts',
          kbaLastAttemptDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      console.log(`🔒 User ${userId} locked out until ${lockedUntil.toISOString()}`);
    } else {
      // Just increment attempt count
      await db
        .update(users)
        .set({
          kbaAttemptsUsed: newAttemptCount,
          kbaLastAttemptDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    }
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    await db
      .update(kbaSessions)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(kbaSessions.sessionId, sessionId));
  }

  /**
   * Get questions for a session (mock implementation - in production store in cache/db)
   */
  private async getSessionQuestions(sessionId: string): Promise<EVSKBAQuestion[]> {
    // In production, you would store questions in Redis/database during session creation
    // For now, return mock questions matching the EVS format
    return [
      {
        text: "Which address is associated with you?",
        questionType: 1,
        answers: [
          { text: "456 MAIN ST", isCorrect: true },
          { text: "123 Oak Ave", isCorrect: false },
          { text: "789 Pine Rd", isCorrect: false },
          { text: "None of the above", isCorrect: false }
        ]
      }
    ];
  }

  /**
   * Get user's current KBA status
   */
  async getUserKBAStatus(userId: number): Promise<{
    verified: boolean;
    locked: boolean;
    attemptsRemaining: number;
    lockedUntil?: Date;
    lastAttempt?: Date;
  }> {
    const [user] = await db
      .select({
        kbaVerified: users.kbaVerified,
        kbaAttemptsUsed: users.kbaAttemptsUsed,
        kbaLockedUntil: users.kbaLockedUntil,
        kbaLastAttemptDate: users.kbaLastAttemptDate
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    const isLocked = user.kbaLockedUntil && new Date() < user.kbaLockedUntil;
    const attemptsUsed = user.kbaAttemptsUsed || 0;
    const attemptsRemaining = Math.max(0, this.MAX_ATTEMPTS - attemptsUsed);

    return {
      verified: user.kbaVerified || false,
      locked: !!isLocked,
      attemptsRemaining,
      lockedUntil: user.kbaLockedUntil || undefined,
      lastAttempt: user.kbaLastAttemptDate || undefined
    };
  }
}

export const enhancedKBAService = new EnhancedKBAService();
export type { EVSKBAQuestion, KBASessionData, KBASubmission, KBAResult }; 