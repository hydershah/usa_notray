import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { 
  users,
  jobs,
  jobFeeBreakdowns,
  feeConfigurations,
  accountTransactions,
  contractorPayments,
  type User,
  type Job
} from "@shared/schema";

export interface FeeCalculationResult {
  subscriberFees?: {
    basePlatformFee: number;
    additionalIdFees: number;
    extendedTimeFees: number;
    witnessFee: number;
    totalFees: number;
  };
  contractorFees?: {
    totalJobFee: number;
    contractorPercentage: number;
    contractorAmount: number;
    platformFee: number;
  };
  breakdown: {
    feeType: string;
    amount: number;
    description: string;
  }[];
}

export class FeeCalculationService {
  // Get active fee configurations
  async getFeeConfiguration(feeType: string): Promise<number> {
    const [config] = await db
      .select()
      .from(feeConfigurations)
      .where(and(
        eq(feeConfigurations.feeType, feeType),
        eq(feeConfigurations.isActive, true)
      ))
      .limit(1);

    return config?.amount || 0;
  }

  // Calculate subscriber fees (deducted from their account)
  async calculateSubscriberFees(
    jobId: number,
    sessionDuration: number = 20, // minutes
    idVerificationCount: number = 1,
    witnessProvided: boolean = false
  ): Promise<FeeCalculationResult['subscriberFees']> {
    
    const basePlatformFee = await this.getFeeConfiguration('platform_base'); // $10.00
    
    // Additional ID verification fees (beyond the first one included)
    const additionalIdCount = Math.max(0, idVerificationCount - 1);
    const additionalIdFees = additionalIdCount * await this.getFeeConfiguration('additional_id');
    
    // Extended time fees (beyond 20 minutes)
    const extendedMinutes = Math.max(0, sessionDuration - 20);
    const extendedTimeSlots = Math.ceil(extendedMinutes / 10); // Round up to 10-minute increments
    const extendedTimeFees = extendedTimeSlots * await this.getFeeConfiguration('extended_time');
    
    // Witness fees
    const witnessFee = witnessProvided ? await this.getFeeConfiguration('witness_provided') : 0;
    
    const totalFees = basePlatformFee + additionalIdFees + extendedTimeFees + witnessFee;
    
    return {
      basePlatformFee,
      additionalIdFees,
      extendedTimeFees,
      witnessFee,
      totalFees
    };
  }

  // Calculate contractor fees (55% of job fee)
  async calculateContractorFees(
    jobId: number,
    closingType: string,
    signerCount: number = 1,
    documentCount: number = 1,
    witnessProvided: boolean = false,
    clientProvidesWitness: boolean = false
  ): Promise<FeeCalculationResult['contractorFees']> {
    
    let totalJobFee = 0;
    
    // Base job fee based on closing type
    switch (closingType.toLowerCase()) {
      case 'title closing - seller side':
        totalJobFee = await this.getFeeConfiguration('title_closing_seller');
        break;
      case 'title closing - buyer side':
        totalJobFee = await this.getFeeConfiguration('title_closing_buyer');
        break;
      case 'title closing - buyer side with loans':
        totalJobFee = await this.getFeeConfiguration('title_closing_buyer_loans');
        break;
      case 'single document':
        totalJobFee = await this.getFeeConfiguration('single_document');
        break;
      default:
        totalJobFee = await this.getFeeConfiguration('single_document'); // fallback
    }
    
    // Additional document fees (if more than 2 documents)
    if (documentCount > 2) {
      const additionalDocFee = await this.getFeeConfiguration('additional_document');
      totalJobFee += (documentCount - 2) * additionalDocFee;
    }
    
    // Additional signer fees (beyond first signer)
    if (signerCount > 1) {
      const additionalSignerFee = closingType.toLowerCase().includes('title') 
        ? await this.getFeeConfiguration('additional_signer_title')
        : await this.getFeeConfiguration('additional_signer_single');
      totalJobFee += (signerCount - 1) * additionalSignerFee;
    }
    
    // Witness fees
    if (witnessProvided && !clientProvidesWitness) {
      totalJobFee += await this.getFeeConfiguration('witness_provided');
    } else if (witnessProvided && clientProvidesWitness) {
      totalJobFee += await this.getFeeConfiguration('witness_client_provided');
    }
    
    // Contractor gets 55% of total job fee
    const contractorPercentage = 55;
    const contractorAmount = Math.round((totalJobFee * contractorPercentage) / 100);
    const platformFee = totalJobFee - contractorAmount;
    
    return {
      totalJobFee,
      contractorPercentage,
      contractorAmount,
      platformFee
    };
  }

  // Calculate complete fee breakdown for a job
  async calculateJobFees(
    jobId: number,
    notaryType: 'subscriber' | 'contractor',
    options: {
      closingType: string;
      signerCount?: number;
      documentCount?: number;
      sessionDuration?: number;
      idVerificationCount?: number;
      witnessProvided?: boolean;
      clientProvidesWitness?: boolean;
    }
  ): Promise<FeeCalculationResult> {
    
    const breakdown: FeeCalculationResult['breakdown'] = [];
    
    if (notaryType === 'subscriber') {
      const subscriberFees = await this.calculateSubscriberFees(
        jobId,
        options.sessionDuration,
        options.idVerificationCount,
        options.witnessProvided
      );
      
      // Build breakdown
      breakdown.push({
        feeType: 'platform_base',
        amount: subscriberFees.basePlatformFee,
        description: 'Base platform fee (includes 1 ID verification and 20 minutes)'
      });
      
      if (subscriberFees.additionalIdFees > 0) {
        breakdown.push({
          feeType: 'additional_id',
          amount: subscriberFees.additionalIdFees,
          description: `Additional ID verification fees`
        });
      }
      
      if (subscriberFees.extendedTimeFees > 0) {
        breakdown.push({
          feeType: 'extended_time',
          amount: subscriberFees.extendedTimeFees,
          description: 'Extended session time fees'
        });
      }
      
      if (subscriberFees.witnessFee > 0) {
        breakdown.push({
          feeType: 'witness',
          amount: subscriberFees.witnessFee,
          description: 'Witness service fee'
        });
      }
      
      return { subscriberFees, breakdown };
      
    } else { // contractor
      const contractorFees = await this.calculateContractorFees(
        jobId,
        options.closingType,
        options.signerCount,
        options.documentCount,
        options.witnessProvided,
        options.clientProvidesWitness
      );
      
      breakdown.push({
        feeType: 'job_fee',
        amount: contractorFees.totalJobFee,
        description: `${options.closingType} fee`
      });
      
      breakdown.push({
        feeType: 'contractor_share',
        amount: contractorFees.contractorAmount,
        description: `Contractor share (${contractorFees.contractorPercentage}%)`
      });
      
      breakdown.push({
        feeType: 'platform_fee',
        amount: contractorFees.platformFee,
        description: 'Platform fee'
      });
      
      return { contractorFees, breakdown };
    }
  }

  // Process subscriber fee deduction
  async deductSubscriberFees(
    subscriberId: number,
    jobId: number,
    feeBreakdown: FeeCalculationResult['subscriberFees']
  ): Promise<boolean> {
    
    if (!feeBreakdown) return false;
    
    const [subscriber] = await db
      .select()
      .from(users)
      .where(eq(users.id, subscriberId))
      .limit(1);
    
    if (!subscriber || subscriber.accountBalance < feeBreakdown.totalFees) {
      throw new Error('Insufficient account balance');
    }
    
    const newBalance = subscriber.accountBalance - feeBreakdown.totalFees;
    
    // Update subscriber balance
    await db
      .update(users)
      .set({ 
        accountBalance: newBalance,
        totalSpent: subscriber.totalSpent + feeBreakdown.totalFees
      })
      .where(eq(users.id, subscriberId));
    
    // Record transaction
    await db.insert(accountTransactions).values({
      userId: subscriberId,
      transactionType: 'fee_deduction',
      amount: -feeBreakdown.totalFees,
      balanceBefore: subscriber.accountBalance,
      balanceAfter: newBalance,
      description: `Job ${jobId} - Platform fees deducted`,
      jobId: jobId,
      status: 'completed',
      processedAt: new Date()
    });
    
    // Record fee breakdown
    await db.insert(jobFeeBreakdowns).values({
      jobId: jobId,
      subscriberNotaryId: subscriberId,
      basePlatformFee: feeBreakdown.basePlatformFee,
      additionalIdFees: feeBreakdown.additionalIdFees,
      extendedTimeFees: feeBreakdown.extendedTimeFees,
      totalSubscriberFees: feeBreakdown.totalFees,
      witnessProvided: feeBreakdown.witnessFee > 0,
      witnessFee: feeBreakdown.witnessFee,
      deductedAt: new Date()
    });
    
    return true;
  }

  // Process contractor payment setup
  async setupContractorPayment(
    contractorId: number,
    jobId: number,
    feeBreakdown: FeeCalculationResult['contractorFees']
  ): Promise<boolean> {
    
    if (!feeBreakdown) return false;
    
    // Create contractor payment record
    await db.insert(contractorPayments).values({
      contractorId: contractorId,
      jobId: jobId,
      totalJobFee: feeBreakdown.totalJobFee,
      contractorPercentage: feeBreakdown.contractorPercentage,
      contractorAmount: feeBreakdown.contractorAmount,
      platformFee: feeBreakdown.platformFee,
      paymentStatus: 'pending' // Will be updated when client pays
    });
    
    return true;
  }

  // Get account balance and spending summary for a user
  async getAccountSummary(userId: number) {
    const [user] = await db
      .select({
        accountBalance: users.accountBalance,
        minimumBalance: users.minimumBalance,
        availableBalance: users.availableBalance,
        pendingBalance: users.pendingBalance,
        totalEarnings: users.totalEarnings,
        totalSpent: users.totalSpent,
        notaryType: users.notaryType,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(accountTransactions)
      .where(eq(accountTransactions.userId, userId))
      .orderBy(accountTransactions.createdAt)
      .limit(10);

    return {
      ...user,
      recentTransactions,
      canTakeJobs: user.notaryType === 'subscriber' 
        ? user.accountBalance >= user.minimumBalance 
        : true // Contractors can always take jobs
    };
  }
}

export const feeCalculationService = new FeeCalculationService(); 