import type { Express } from "express";
import { feeCalculationService } from "./fee-calculation-service";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { 
  users, 
  feeConfigurations,
  accountTransactions,
  contractorPayments,
  jobFeeBreakdowns 
} from "@shared/schema";

// Middleware to verify JWT token (assuming it exists in routes.ts)
const verifyToken = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export function registerFeeRoutes(app: Express) {

  // Get fee configurations (admin only)
  app.get('/api/fees/configurations', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const configurations = await db
        .select()
        .from(feeConfigurations)
        .orderBy(feeConfigurations.feeType);

      res.json(configurations);
    } catch (error) {
      console.error('Get fee configurations error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update fee configuration (admin only)
  app.put('/api/fees/configurations/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const configId = parseInt(req.params.id);
      const { amount, isActive, description } = req.body;

      const [updatedConfig] = await db
        .update(feeConfigurations)
        .set({ 
          amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents
          isActive,
          description,
          updatedAt: new Date()
        })
        .where(eq(feeConfigurations.id, configId))
        .returning();

      if (!updatedConfig) {
        return res.status(404).json({ message: 'Fee configuration not found' });
      }

      res.json(updatedConfig);
    } catch (error) {
      console.error('Update fee configuration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Calculate job fees
  app.post('/api/fees/calculate', verifyToken, async (req: any, res) => {
    try {
      const {
        jobId,
        notaryId,
        closingType,
        signerCount = 1,
        documentCount = 1,
        sessionDuration = 20,
        idVerificationCount = 1,
        witnessProvided = false,
        clientProvidesWitness = false
      } = req.body;

      // Get notary type
      const [notary] = await db
        .select({ notaryType: users.notaryType })
        .from(users)
        .where(eq(users.id, notaryId))
        .limit(1);

      if (!notary || !notary.notaryType) {
        return res.status(400).json({ message: 'Notary not found or notary type not set' });
      }

      const feeResult = await feeCalculationService.calculateJobFees(
        jobId,
        notary.notaryType,
        {
          closingType,
          signerCount,
          documentCount,
          sessionDuration,
          idVerificationCount,
          witnessProvided,
          clientProvidesWitness
        }
      );

      res.json(feeResult);
    } catch (error) {
      console.error('Calculate job fees error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get account summary for a user
  app.get('/api/account/summary', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const summary = await feeCalculationService.getAccountSummary(userId);
      
      // Convert cents to dollars for frontend
      const formattedSummary = {
        ...summary,
        accountBalance: summary.accountBalance / 100,
        minimumBalance: summary.minimumBalance / 100,
        availableBalance: summary.availableBalance / 100,
        pendingBalance: summary.pendingBalance / 100,
        totalEarnings: summary.totalEarnings / 100,
        totalSpent: summary.totalSpent / 100,
        recentTransactions: summary.recentTransactions.map(tx => ({
          ...tx,
          amount: tx.amount / 100,
          balanceBefore: tx.balanceBefore / 100,
          balanceAfter: tx.balanceAfter / 100
        }))
      };

      res.json(formattedSummary);
    } catch (error) {
      console.error('Get account summary error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Process subscriber fee deduction
  app.post('/api/fees/deduct-subscriber', verifyToken, async (req: any, res) => {
    try {
      const { jobId, sessionDuration, idVerificationCount, witnessProvided } = req.body;
      
      // Only subscriber notaries can have fees deducted
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user || user.role !== 'notary' || user.notaryType !== 'subscriber') {
        return res.status(403).json({ message: 'Only subscriber notaries can have fees deducted' });
      }

      const subscriberFees = await feeCalculationService.calculateSubscriberFees(
        jobId,
        sessionDuration,
        idVerificationCount,
        witnessProvided
      );

      const success = await feeCalculationService.deductSubscriberFees(
        req.user.id,
        jobId,
        subscriberFees
      );

      if (success) {
        res.json({ 
          success: true, 
          feesDeducted: subscriberFees.totalFees / 100, // Convert to dollars
          breakdown: subscriberFees
        });
      } else {
        res.status(400).json({ message: 'Failed to deduct fees' });
      }
    } catch (error) {
      console.error('Deduct subscriber fees error:', error);
      if (error.message === 'Insufficient account balance') {
        res.status(400).json({ message: 'Insufficient account balance' });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Setup contractor payment
  app.post('/api/fees/setup-contractor-payment', verifyToken, async (req: any, res) => {
    try {
      const { 
        jobId, 
        contractorId, 
        closingType, 
        signerCount, 
        documentCount, 
        witnessProvided, 
        clientProvidesWitness 
      } = req.body;

      // Check permissions - admin, title company, or the contractor themselves
      if (req.user.role !== 'admin' && 
          req.user.role !== 'title_company' && 
          req.user.id !== contractorId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const contractorFees = await feeCalculationService.calculateContractorFees(
        jobId,
        closingType,
        signerCount,
        documentCount,
        witnessProvided,
        clientProvidesWitness
      );

      const success = await feeCalculationService.setupContractorPayment(
        contractorId,
        jobId,
        contractorFees
      );

      if (success) {
        res.json({ 
          success: true, 
          paymentSetup: {
            ...contractorFees,
            totalJobFee: contractorFees.totalJobFee / 100, // Convert to dollars
            contractorAmount: contractorFees.contractorAmount / 100,
            platformFee: contractorFees.platformFee / 100
          }
        });
      } else {
        res.status(400).json({ message: 'Failed to setup contractor payment' });
      }
    } catch (error) {
      console.error('Setup contractor payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get account transactions for a user
  app.get('/api/account/transactions', verifyToken, async (req: any, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const transactions = await db
        .select()
        .from(accountTransactions)
        .where(eq(accountTransactions.userId, req.user.id))
        .orderBy(desc(accountTransactions.createdAt))
        .limit(parseInt(limit as string))
        .offset(offset);

      // Convert cents to dollars
      const formattedTransactions = transactions.map(tx => ({
        ...tx,
        amount: tx.amount / 100,
        balanceBefore: tx.balanceBefore / 100,
        balanceAfter: tx.balanceAfter / 100
      }));

      res.json(formattedTransactions);
    } catch (error) {
      console.error('Get account transactions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get contractor payments for a contractor
  app.get('/api/contractor/payments', verifyToken, async (req: any, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Only allow contractors to see their own payments, or admins to see all
      let whereClause;
      if (req.user.role === 'admin') {
        whereClause = undefined; // Admin can see all
      } else {
        whereClause = eq(contractorPayments.contractorId, req.user.id);
      }

      const payments = await db
        .select()
        .from(contractorPayments)
        .where(whereClause)
        .orderBy(desc(contractorPayments.createdAt))
        .limit(parseInt(limit as string))
        .offset(offset);

      // Convert cents to dollars
      const formattedPayments = payments.map(payment => ({
        ...payment,
        totalJobFee: payment.totalJobFee / 100,
        contractorAmount: payment.contractorAmount / 100,
        platformFee: payment.platformFee / 100
      }));

      res.json(formattedPayments);
    } catch (error) {
      console.error('Get contractor payments error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Add funds to subscriber account (admin only for now - in production would integrate with Stripe)
  app.post('/api/account/add-funds', verifyToken, async (req: any, res) => {
    try {
      const { userId, amount, description = 'Manual fund addition' } = req.body;

      // Admin only for manual fund addition
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const amountInCents = Math.round(amount * 100);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const newBalance = user.accountBalance + amountInCents;

      // Update user balance
      await db
        .update(users)
        .set({ 
          accountBalance: newBalance,
          availableBalance: newBalance // Assuming no pending transactions for simplicity
        })
        .where(eq(users.id, userId));

      // Record transaction
      await db.insert(accountTransactions).values({
        userId: userId,
        transactionType: 'deposit',
        amount: amountInCents,
        balanceBefore: user.accountBalance,
        balanceAfter: newBalance,
        description: description,
        status: 'completed',
        processedAt: new Date()
      });

      res.json({ 
        success: true, 
        newBalance: newBalance / 100,
        amountAdded: amount
      });
    } catch (error) {
      console.error('Add funds error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get fee breakdown for a specific job
  app.get('/api/jobs/:jobId/fee-breakdown', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);

      const [breakdown] = await db
        .select()
        .from(jobFeeBreakdowns)
        .where(eq(jobFeeBreakdowns.jobId, jobId))
        .limit(1);

      if (!breakdown) {
        return res.status(404).json({ message: 'Fee breakdown not found' });
      }

      // Convert cents to dollars
      const formattedBreakdown = {
        ...breakdown,
        basePlatformFee: breakdown.basePlatformFee / 100,
        additionalIdFees: breakdown.additionalIdFees / 100,
        extendedTimeFees: breakdown.extendedTimeFees / 100,
        totalSubscriberFees: breakdown.totalSubscriberFees / 100,
        witnessFee: breakdown.witnessFee / 100
      };

      res.json(formattedBreakdown);
    } catch (error) {
      console.error('Get fee breakdown error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
} 