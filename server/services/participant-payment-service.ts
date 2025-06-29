import { db } from "../db";
import { participantPayments, users, jobs, InsertParticipantPayment } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface ParticipantPaymentInfo {
  id: number;
  participantId: number;
  jobId: number;
  sessionId?: number;
  participantRole: string; // 'signer', 'witness', 'observer'
  baseCompensation: number; // Base amount for participation
  sessionDuration?: number; // Minutes
  bonusAmount?: number; // Additional compensation for complex sessions
  totalAmount: number;
  paymentStatus: string;
  sessionCompletedDate?: Date;
  availableForPayoutDate?: Date;
  paidToParticipantDate?: Date;
  stripeTransferId?: string;
  paymentMethod?: string;
}

export class ParticipantPaymentService {
  
  /**
   * Create participant payment record when session is completed
   */
  async createParticipantPayment(
    participantId: number,
    jobId: number,
    sessionId: number,
    participantRole: string,
    sessionDuration: number = 30
  ): Promise<ParticipantPaymentInfo> {
    
    // Calculate compensation based on role and session duration
    const baseCompensation = this.calculateBaseCompensation(participantRole);
    const durationBonus = this.calculateDurationBonus(sessionDuration);
    const totalAmount = baseCompensation + durationBonus;

    const paymentData: InsertParticipantPayment = {
      participantId,
      jobId,
      sessionId,
      participantRole,
      baseCompensation,
      sessionDuration,
      bonusAmount: durationBonus,
      totalAmount,
      paymentStatus: 'pending',
      sessionCompletedDate: new Date(),
      availableForPayoutDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Available after 24 hours
    };

    const [payment] = await db
      .insert(participantPayments)
      .values(paymentData)
      .returning();

    return payment;
  }

  /**
   * Get participant payment summary
   */
  async getParticipantPaymentSummary(participantId: number): Promise<{
    totalReceived: number;
    pendingPayments: number;
    completedSessions: number;
    averagePayment: number;
  }> {
    
    const payments = await db
      .select()
      .from(participantPayments)
      .where(eq(participantPayments.participantId, participantId))
      .orderBy(desc(participantPayments.createdAt));

    const totalReceived = payments
      .filter(p => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + p.totalAmount, 0) / 100; // Convert to dollars

    const pendingPayments = payments
      .filter(p => p.paymentStatus === 'pending' || p.paymentStatus === 'available')
      .reduce((sum, p) => sum + p.totalAmount, 0) / 100; // Convert to dollars

    const completedSessions = payments.length;

    const averagePayment = completedSessions > 0 ? totalReceived / completedSessions : 0;

    return {
      totalReceived,
      pendingPayments,
      completedSessions,
      averagePayment
    };
  }

  /**
   * Process participant payout
   */
  async processParticipantPayout(
    paymentId: number,
    stripeTransferId: string,
    paymentMethod: string = 'stripe_transfer'
  ): Promise<boolean> {
    try {
      await db
        .update(participantPayments)
        .set({
          paymentStatus: 'paid',
          paidToParticipantDate: new Date(),
          stripeTransferId,
          paymentMethod
        })
        .where(eq(participantPayments.id, paymentId));

      return true;
    } catch (error) {
      console.error('Error processing participant payout:', error);
      return false;
    }
  }

  /**
   * Get pending payments for participant
   */
  async getPendingPayments(participantId: number): Promise<ParticipantPaymentInfo[]> {
    return await db
      .select()
      .from(participantPayments)
      .where(
        and(
          eq(participantPayments.participantId, participantId),
          eq(participantPayments.paymentStatus, 'pending')
        )
      )
      .orderBy(desc(participantPayments.createdAt));
  }

  /**
   * Calculate base compensation based on role
   */
  private calculateBaseCompensation(role: string): number {
    // Base compensation in cents
    switch (role.toLowerCase()) {
      case 'signer':
      case 'primary_signer':
      case 'co_signer':
        return 1500; // $15.00 for signers
      case 'witness':
        return 1000; // $10.00 for witnesses
      case 'observer':
        return 500;  // $5.00 for observers
      default:
        return 1000; // Default $10.00
    }
  }

  /**
   * Calculate duration bonus for long sessions
   */
  private calculateDurationBonus(sessionDuration: number): number {
    // Bonus for sessions over 45 minutes
    if (sessionDuration > 45) {
      const extraMinutes = sessionDuration - 45;
      const bonusBlocks = Math.ceil(extraMinutes / 15); // $2.50 per 15 minutes
      return bonusBlocks * 250; // 250 cents = $2.50
    }
    return 0;
  }

  /**
   * Mark payments as available for payout (automated process)
   */
  async markPaymentsAvailable(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const result = await db
      .update(participantPayments)
      .set({
        paymentStatus: 'available',
        availableForPayoutDate: new Date()
      })
      .where(
        and(
          eq(participantPayments.paymentStatus, 'pending'),
          sql`${participantPayments.sessionCompletedDate} <= ${cutoffDate}`
        )
      );

    return result.rowCount || 0;
  }
} 