import { db } from "../db";
import { feeConfigurations, jobs, users, jobFeeBreakdowns } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

export interface FeeCalculationInput {
  jobType: 'platform_signing' | 'title_closing_seller' | 'title_closing_buyer' | 'title_closing_buyer_loans' | 'single_document' | 'multiple_documents';
  documentCount?: number;
  signerCount?: number;
  sessionDuration?: number; // in minutes
  idVerificationCount?: number;
  requiresWitness?: boolean;
  witnessProvidedByUSANotary?: boolean;
  additionalServices?: string[];
}

export interface FeeBreakdown {
  baseFee: number;
  additionalIdFees: number;
  extendedTimeFees: number;
  documentFees: number;
  signerFees: number;
  witnessFees: number;
  totalFees: number;
  breakdown: {
    description: string;
    amount: number;
    quantity?: number;
  }[];
}

export class FeeCalculationService {
  private feeCache: Map<string, number> = new Map();

  /**
   * Get fee configuration from database with caching
   */
  private async getFeeAmount(feeType: string): Promise<number> {
    if (this.feeCache.has(feeType)) {
      return this.feeCache.get(feeType)!;
    }

    const feeConfig = await db
      .select()
      .from(feeConfigurations)
      .where(and(eq(feeConfigurations.feeType, feeType), eq(feeConfigurations.isActive, true)))
      .limit(1);

    if (feeConfig.length === 0) {
      throw new Error(`Fee configuration not found for type: ${feeType}`);
    }

    const amount = feeConfig[0].amount;
    this.feeCache.set(feeType, amount);
    return amount;
  }

  /**
   * Calculate subscriber fees for platform signing
   */
  async calculateSubscriberFees(input: FeeCalculationInput): Promise<FeeBreakdown> {
    const breakdown: FeeBreakdown['breakdown'] = [];
    
    // Base platform fee - $10.00 (includes 1 ID verification and 20 minute session)
    const baseFee = await this.getFeeAmount('platform_base');
    breakdown.push({
      description: 'Platform base fee (includes 1 ID verification and 20 minute session)',
      amount: baseFee
    });

    // Additional ID verification fees - $2.00 each
    const idCount = input.idVerificationCount || 1;
    const additionalIds = Math.max(0, idCount - 1);
    const additionalIdFeeAmount = await this.getFeeAmount('additional_id');
    const additionalIdFees = additionalIds * additionalIdFeeAmount;
    
    if (additionalIds > 0) {
      breakdown.push({
        description: 'Additional ID verification',
        amount: additionalIdFeeAmount,
        quantity: additionalIds
      });
    }

    // Extended time fees - $5.00 per 10 minutes over 20
    const sessionDuration = input.sessionDuration || 20;
    const extendedMinutes = Math.max(0, sessionDuration - 20);
    const extendedTimeBlocks = Math.ceil(extendedMinutes / 10);
    const extendedTimeFeeAmount = await this.getFeeAmount('extended_time');
    const extendedTimeFees = extendedTimeBlocks * extendedTimeFeeAmount;
    
    if (extendedTimeBlocks > 0) {
      breakdown.push({
        description: 'Extended time (per 10 minutes over 20)',
        amount: extendedTimeFeeAmount,
        quantity: extendedTimeBlocks
      });
    }

    // Witness fees (if applicable)
    let witnessFees = 0;
    if (input.requiresWitness) {
      if (input.witnessProvidedByUSANotary) {
        witnessFees = await this.getFeeAmount('witness_provided');
        breakdown.push({
          description: 'Witness provided by USA Notary',
          amount: witnessFees
        });
      } else {
        witnessFees = await this.getFeeAmount('witness_client_provided');
        breakdown.push({
          description: 'Witness provided by client (ID verification)',
          amount: witnessFees
        });
      }
    }

    const totalFees = baseFee + additionalIdFees + extendedTimeFees + witnessFees;

    return {
      baseFee,
      additionalIdFees,
      extendedTimeFees,
      documentFees: 0,
      signerFees: 0,
      witnessFees,
      totalFees,
      breakdown
    };
  }

  /**
   * Calculate client fees for USA Notary services (title closing, documents)
   */
  async calculateClientFees(input: FeeCalculationInput): Promise<FeeBreakdown> {
    const breakdown: FeeBreakdown['breakdown'] = [];
    let totalFees = 0;
    let documentFees = 0;
    let signerFees = 0;
    let witnessFees = 0;

    // Base service fee based on job type
    let baseFee = 0;
    switch (input.jobType) {
      case 'title_closing_seller':
        baseFee = await this.getFeeAmount('title_closing_seller');
        breakdown.push({
          description: 'Title Closing - Seller Side',
          amount: baseFee
        });
        break;
      
      case 'title_closing_buyer':
        baseFee = await this.getFeeAmount('title_closing_buyer');
        breakdown.push({
          description: 'Title Closing - Buyer Side',
          amount: baseFee
        });
        break;
      
      case 'title_closing_buyer_loans':
        baseFee = await this.getFeeAmount('title_closing_buyer_loans');
        breakdown.push({
          description: 'Title Closing - Buyer Side with Loans',
          amount: baseFee
        });
        break;
      
      case 'single_document':
        baseFee = await this.getFeeAmount('single_document');
        breakdown.push({
          description: 'Single Document (Up to 2 documents)',
          amount: baseFee
        });
        break;
      
      case 'multiple_documents':
        baseFee = await this.getFeeAmount('single_document');
        breakdown.push({
          description: 'Base document fee (Up to 2 documents)',
          amount: baseFee
        });

        // Additional documents over 2
        const docCount = input.documentCount || 2;
        const additionalDocs = Math.max(0, docCount - 2);
        if (additionalDocs > 0) {
          const additionalDocFee = await this.getFeeAmount('additional_document');
          documentFees = additionalDocs * additionalDocFee;
          breakdown.push({
            description: 'Additional document (over 2)',
            amount: additionalDocFee,
            quantity: additionalDocs
          });
        }
        break;
    }

    // Additional signer fees
    const signerCount = input.signerCount || 1;
    const additionalSigners = Math.max(0, signerCount - 1);
    if (additionalSigners > 0) {
      const signerFeeType = input.jobType.includes('title_closing') ? 'additional_signer_title' : 'additional_signer_single';
      const signerFeeAmount = await this.getFeeAmount(signerFeeType);
      signerFees = additionalSigners * signerFeeAmount;
      
      breakdown.push({
        description: input.jobType.includes('title_closing') ? 'Additional Signer - Title Documents' : 'Additional Signer - Single Document',
        amount: signerFeeAmount,
        quantity: additionalSigners
      });
    }

    // Witness fees (if applicable) - NOT included in notary compensation calculation
    if (input.requiresWitness) {
      if (input.witnessProvidedByUSANotary) {
        witnessFees = await this.getFeeAmount('witness_provided');
        breakdown.push({
          description: 'Witness provided by USA Notary',
          amount: witnessFees
        });
      } else {
        witnessFees = await this.getFeeAmount('witness_client_provided');
        breakdown.push({
          description: 'Witness provided by client (ID verification)',
          amount: witnessFees
        });
      }
    }

    totalFees = baseFee + documentFees + signerFees + witnessFees;

    return {
      baseFee,
      additionalIdFees: 0,
      extendedTimeFees: 0,
      documentFees,
      signerFees,
      witnessFees,
      totalFees,
      breakdown
    };
  }

  /**
   * Calculate contractor payment (55% of total fee, excluding witness charges)
   */
  calculateContractorPayment(clientFees: FeeBreakdown): number {
    // Contractor gets 55% of total fee EXCLUDING witness charges
    const feeForCalculation = clientFees.totalFees - clientFees.witnessFees;
    return Math.round(feeForCalculation * 0.55);
  }

  /**
   * Save fee breakdown to database
   */
  async saveFeeBreakdown(jobId: number, subscriberNotaryId: number | null, feeData: FeeBreakdown, sessionDuration?: number): Promise<void> {
    await db.insert(jobFeeBreakdowns).values({
      jobId,
      subscriberNotaryId,
      basePlatformFee: feeData.baseFee,
      additionalIdFees: feeData.additionalIdFees,
      extendedTimeFees: feeData.extendedTimeFees,
      sessionDuration,
      totalSubscriberFees: feeData.totalFees,
      witnessFee: feeData.witnessFees,
      feeBreakdown: feeData.breakdown,
      deductedAt: new Date()
    });
  }

  /**
   * Get comprehensive fee breakdown for a job
   */
  async getFeeBreakdownForJob(jobId: number): Promise<any> {
    const feeBreakdown = await db
      .select()
      .from(jobFeeBreakdowns)
      .where(eq(jobFeeBreakdowns.jobId, jobId))
      .limit(1);

    return feeBreakdown.length > 0 ? feeBreakdown[0] : null;
  }

  /**
   * Validate minimum balance for subscriber
   */
  async validateSubscriberBalance(userId: number, requiredAmount: number): Promise<{ valid: boolean; currentBalance: number; minimumRequired: number }> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const currentBalance = user[0].accountBalance || 0;
    const minimumRequired = user[0].minimumBalance || 2500; // $25.00 default

    // Check if user has enough balance including minimum balance requirement
    const availableBalance = currentBalance - minimumRequired;
    const valid = availableBalance >= requiredAmount;

    return {
      valid,
      currentBalance,
      minimumRequired
    };
  }
} 