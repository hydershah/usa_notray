import { db } from "../db";
import { contractorPayments, users, jobs, InsertContractorPayment } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { AccountBalanceService } from "./account-balance-service";

export interface ContractorPaymentInfo {
  id: number;
  contractorId: number;
  jobId: number;
  totalJobFee: number;
  contractorPercentage: number;
  contractorAmount: number;
  platformFee: number;
  paymentStatus: string;
  clientPaymentDate?: Date;
  availableForPayoutDate?: Date;
  paidToContractorDate?: Date;
  delayReason?: string;
  estimatedPayoutDate?: Date;
  invoiceNumber?: string;
}

export interface PaymentSummary {
  totalPending: number;
  totalAvailable: number;
  totalPaid: number;
  pendingCount: number;
  availableCount: number;
  paidCount: number;
}

export class ContractorPaymentService {
  private accountBalanceService: AccountBalanceService;

  constructor() {
    this.accountBalanceService = new AccountBalanceService();
  }

  /**
   * Create contractor payment record when job is completed
   */
  async createContractorPayment(
    contractorId: number,
    jobId: number,
    totalJobFee: number,
    contractorPercentage: number = 55,
    invoiceNumber?: string
  ): Promise<ContractorPaymentInfo> {
    // Calculate contractor amount (55% of total, excluding witness fees if any)
    const contractorAmount = Math.round(totalJobFee * (contractorPercentage / 100));
    const platformFee = totalJobFee - contractorAmount;

    const paymentData: InsertContractorPayment = {
      contractorId,
      jobId,
      totalJobFee,
      contractorPercentage,
      contractorAmount,
      platformFee,
      paymentStatus: 'pending',
      invoiceNumber,
      delayReason: 'Waiting for client payment'
    };

    const [payment] = await db
      .insert(contractorPayments)
      .values(paymentData)
      .returning();

    // Add to contractor's pending balance
    await this.accountBalanceService.addPendingBalance(
      contractorId,
      contractorAmount,
      `Contractor payment for job #${jobId} (Pending client payment)`,
      jobId
    );

    return payment;
  }

  /**
   * Process contractor payout
   */
  async processContractorPayout(
    paymentId: number,
    stripeTransferId: string,
    paidDate: Date = new Date()
  ): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        // Get payment details
        const payment = await tx
          .select()
          .from(contractorPayments)
          .where(eq(contractorPayments.id, paymentId))
          .limit(1);

        if (payment.length === 0) {
          throw new Error('Payment not found');
        }

        const paymentData = payment[0];

        // Update payment status
        await tx
          .update(contractorPayments)
          .set({
            paymentStatus: 'paid_to_contractor',
            paidToContractorDate: paidDate,
            stripeTransferId
          })
          .where(eq(contractorPayments.id, paymentId));

        // Add funds to contractor account
        await this.accountBalanceService.addContractorPayment(
          paymentData.contractorId,
          paymentData.contractorAmount,
          `Contractor payment for job #${paymentData.jobId}`,
          paymentData.jobId,
          stripeTransferId
        );

        return true;
      });
    } catch (error) {
      console.error('Error processing contractor payout:', error);
      return false;
    }
  }

  /**
   * Get contractor payment history
   */
  async getContractorPaymentHistory(contractorId: number, limit: number = 50): Promise<ContractorPaymentInfo[]> {
    return await db
      .select()
      .from(contractorPayments)
      .where(eq(contractorPayments.contractorId, contractorId))
      .orderBy(desc(contractorPayments.createdAt))
      .limit(limit);
  }
} 