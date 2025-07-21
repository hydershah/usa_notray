import express from 'express';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq, and, gte } from 'drizzle-orm';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

interface EVSKBAQuestion {
  text: string;
  questionType: number;
  answers: Array<{
    text: string;
    isCorrect: boolean;
  }>;
}

// Check if user is KBA locked
router.get('/status/:userId', verifyToken, async (req: any, res) => {
  try {
    const { userId } = req.params;
    
    const user = await db
      .select({
        kbaAttemptsUsed: users.kbaAttemptsUsed,
        kbaLockedUntil: users.kbaLockedUntil,
        kbaVerified: users.kbaVerified,
        kbaLastAttemptDate: users.kbaLastAttemptDate
      })
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = user[0];
    const now = new Date();
    
    // Check if user is currently locked
    const isLocked = userData.kbaLockedUntil && new Date(userData.kbaLockedUntil) > now;
    
    res.json({
      success: true,
      status: {
        isVerified: userData.kbaVerified,
        isLocked,
        attemptsUsed: userData.kbaAttemptsUsed || 0,
        lockedUntil: userData.kbaLockedUntil,
        canAttempt: !isLocked && (userData.kbaAttemptsUsed || 0) < 2 && !userData.kbaVerified
      }
    });
  } catch (error) {
    console.error('❌ KBA status check error:', error);
    res.status(500).json({ success: false, message: 'Failed to check KBA status' });
  }
});

// Initialize KBA session with EVS questions
router.post('/initialize', verifyToken, async (req: any, res) => {
  try {
    const { userId, firstName, lastName, dateOfBirth, ssn, address, phone, email } = req.body;
    
    if (!userId || !firstName || !lastName || !dateOfBirth || !address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: userId, firstName, lastName, dateOfBirth, address' 
      });
    }

    // Check if user is locked or already verified
    const user = await db
      .select({
        kbaAttemptsUsed: users.kbaAttemptsUsed,
        kbaLockedUntil: users.kbaLockedUntil,
        kbaVerified: users.kbaVerified
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = user[0];
    const now = new Date();
    
    // Check if user is locked
    if (userData.kbaLockedUntil && new Date(userData.kbaLockedUntil) > now) {
      const hoursRemaining = Math.ceil((new Date(userData.kbaLockedUntil).getTime() - now.getTime()) / (1000 * 60 * 60));
      return res.status(423).json({ 
        success: false, 
        message: `KBA verification is locked. Try again in ${hoursRemaining} hours.`,
        lockedUntil: userData.kbaLockedUntil
      });
    }

    // Check if already verified
    if (userData.kbaVerified) {
      return res.json({
        success: true,
        alreadyVerified: true,
        message: 'KBA verification already completed'
      });
    }

    // Check if exceeded attempts
    if ((userData.kbaAttemptsUsed || 0) >= 2) {
      return res.status(423).json({ 
        success: false, 
        message: 'Maximum KBA attempts exceeded. Please contact support.'
      });
    }

    // Call EVS for KBA questions
    const evsResponse = await fetch('https://api.assureid.net/v1/kba/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EVS_API_KEY}`
      },
      body: JSON.stringify({
        firstName,
        lastName,
        dateOfBirth,
        ssn: ssn?.replace(/\D/g, ''), // Remove non-digits
        address: {
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode
        },
        phone: phone?.replace(/\D/g, ''),
        email
      })
    });

    if (!evsResponse.ok) {
      console.error('❌ EVS KBA request failed:', await evsResponse.text());
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve KBA questions' 
      });
    }

    const evsData = await evsResponse.json();
    
    if (!evsData.success || !evsData.kbaQuestions || evsData.kbaQuestions.length === 0) {
      return res.status(500).json({ 
        success: false, 
        message: 'No KBA questions available' 
      });
    }

    // Select 5 random questions
    const allQuestions = evsData.kbaQuestions;
    const selectedQuestions = [];
    const usedIndices = new Set();
    
    while (selectedQuestions.length < 5 && selectedQuestions.length < allQuestions.length) {
      const randomIndex = Math.floor(Math.random() * allQuestions.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        selectedQuestions.push(allQuestions[randomIndex]);
      }
    }

    // Generate session ID
    const sessionId = `kba_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session in memory (you could also use Redis or database)
    global.kbaSessions = global.kbaSessions || new Map();
    global.kbaSessions.set(sessionId, {
      userId,
      questions: selectedQuestions,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes
    });

    // Return questions without correct answers
    const questionsForClient = selectedQuestions.map(q => ({
      text: q.text,
      questionType: q.questionType,
      answers: q.answers.map(a => ({ text: a.text })) // Remove isCorrect flag
    }));

    res.json({
      success: true,
      sessionId,
      questions: questionsForClient,
      attemptsRemaining: 2 - (userData.kbaAttemptsUsed || 0),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000)
    });

  } catch (error) {
    console.error('❌ KBA initialization error:', error);
    res.status(500).json({ success: false, message: 'Failed to initialize KBA session' });
  }
});

// Submit KBA answers
router.post('/submit', verifyToken, async (req: any, res) => {
  try {
    const { sessionId, userId, answers } = req.body;
    
    if (!sessionId || !userId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: sessionId, userId, answers' 
      });
    }

    // Get session data
    global.kbaSessions = global.kbaSessions || new Map();
    const sessionData = global.kbaSessions.get(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({ 
        success: false, 
        message: 'KBA session not found or expired' 
      });
    }

    // Check if session is expired
    if (new Date() > sessionData.expiresAt) {
      global.kbaSessions.delete(sessionId);
      return res.status(408).json({ 
        success: false, 
        message: 'KBA session expired' 
      });
    }

    // Validate userId matches
    if (sessionData.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid session for this user' 
      });
    }

    // Calculate score
    let correctAnswers = 0;
    const { questions } = sessionData;
    
    answers.forEach((answer: any, index: number) => {
      if (index < questions.length && typeof answer.selectedAnswerIndex === 'number') {
        const question = questions[index];
        const selectedAnswer = question.answers[answer.selectedAnswerIndex];
        if (selectedAnswer && selectedAnswer.isCorrect) {
          correctAnswers++;
        }
      }
    });

    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = correctAnswers >= 4; // Need 4 out of 5 correct (80%)

    // Get current user data
    const user = await db
      .select({
        kbaAttemptsUsed: users.kbaAttemptsUsed,
        kbaVerified: users.kbaVerified
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = user[0];
    const currentAttempts = (userData.kbaAttemptsUsed || 0) + 1;

    if (passed) {
      // User passed - mark as verified
      await db
        .update(users)
        .set({
          kbaVerified: true,
          kbaVerificationDate: new Date(),
          kbaScore: score,
          kbaProvider: 'evs',
          kbaAttemptsUsed: currentAttempts,
          kbaLastAttemptDate: new Date(),
          kbaLockedUntil: null, // Clear any existing lockout
          kbaLockoutReason: null
        })
        .where(eq(users.id, userId));

      // Clean up session
      global.kbaSessions.delete(sessionId);

      res.json({
        success: true,
        passed: true,
        score,
        correctAnswers,
        totalQuestions: questions.length,
        message: 'KBA verification completed successfully!'
      });

    } else {
      // User failed
      const isLastAttempt = currentAttempts >= 2;
      const now = new Date();
      const lockoutUntil = isLastAttempt ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null; // 24 hours

      await db
        .update(users)
        .set({
          kbaAttemptsUsed: currentAttempts,
          kbaLastAttemptDate: now,
          kbaLockedUntil: lockoutUntil,
          kbaLockoutReason: isLastAttempt ? 'Failed KBA verification twice' : null
        })
        .where(eq(users.id, userId));

      // Clean up session
      global.kbaSessions.delete(sessionId);

      if (isLastAttempt) {
        res.status(423).json({
          success: false,
          passed: false,
          score,
          correctAnswers,
          totalQuestions: questions.length,
          locked: true,
          lockedUntil: lockoutUntil,
          message: 'KBA verification failed. Account locked for 24 hours due to multiple failed attempts.'
        });
      } else {
        res.json({
          success: false,
          passed: false,
          score,
          correctAnswers,
          totalQuestions: questions.length,
          attemptsRemaining: 2 - currentAttempts,
          message: `KBA verification failed. You have ${2 - currentAttempts} attempt remaining.`
        });
      }
    }

  } catch (error) {
    console.error('❌ KBA submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to process KBA submission' });
  }
});

// Reset KBA lockout (admin only)
router.post('/reset-lockout/:userId', verifyToken, async (req: any, res) => {
  try {
    const { userId } = req.params;
    
    // TODO: Add admin role check here
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }
    
    await db
      .update(users)
      .set({
        kbaAttemptsUsed: 0,
        kbaLockedUntil: null,
        kbaLockoutReason: null,
        kbaVerified: false
      })
      .where(eq(users.id, parseInt(userId)));

    res.json({
      success: true,
      message: 'KBA lockout reset successfully'
    });

  } catch (error) {
    console.error('❌ KBA lockout reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset KBA lockout' });
  }
});

export default router; 