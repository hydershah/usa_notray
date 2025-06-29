import { db } from "../db";
import { users, accountTransactions, InsertAccountTransaction } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export interface TransactionResult {
  success: boolean;
  transactionId?: number;
  newBalance: number;
  error?: string;
}

export interface BalanceInfo {
  accountBalance: number;
  availableBalance: number;
  pendingBalance: number;
  minimumBalance: number;
  totalEarnings: number;
  totalSpent: number;
}

export class AccountBalanceService {

  /**
   * Get current balance information for a user
   */
  async getBalanceInfo(userId: number): Promise<BalanceInfo> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const userData = user[0];
    return {
      accountBalance: userData.accountBalance || 0,
      availableBalance: userData.availableBalance || 0,
      pendingBalance: userData.pendingBalance || 0,
      minimumBalance: userData.minimumBalance || 2500, // $25.00 default
      totalEarnings: userData.totalEarnings || 0,
      totalSpent: userData.totalSpent || 0
    };
  }

  /**
   * Add funds to user account (deposit)
   */
  async addFunds(
    userId: number, 
    amount: number, 
    description: string, 
    paymentMethod: string = 'stripe',
    stripeTransactionId?: string
  ): Promise<TransactionResult> {
    try {
      return await db.transaction(async (tx) => {
        // Get current balance
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('User not found');
        }

        const currentBalance = user[0].accountBalance || 0;
        const newBalance = currentBalance + amount;

        // Update user balance
        await tx
          .update(users)
          .set({
            accountBalance: newBalance,
            availableBalance: newBalance - (user[0].minimumBalance || 2500),
            totalEarnings: (user[0].totalEarnings || 0) + amount
          })
          .where(eq(users.id, userId));

        // Record transaction
        const transactionData: InsertAccountTransaction = {
          userId,
          transactionType: 'deposit',
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description,
          paymentMethod,
          stripeTransactionId,
          status: 'completed',
          processedAt: new Date()
        };

        const [transaction] = await tx
          .insert(accountTransactions)
          .values(transactionData)
          .returning();

        return {
          success: true,
          transactionId: transaction.id,
          newBalance
        };
      });
    } catch (error) {
      console.error('Error adding funds:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Withdraw funds from user account
   */
  async withdrawFunds(
    userId: number, 
    amount: number, 
    description: string, 
    paymentMethod: string = 'stripe',
    stripeTransactionId?: string
  ): Promise<TransactionResult> {
    try {
      return await db.transaction(async (tx) => {
        // Get current balance
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('User not found');
        }

        const currentBalance = user[0].accountBalance || 0;
        const minimumBalance = user[0].minimumBalance || 2500;
        const availableBalance = currentBalance - minimumBalance;

        // Check if user has sufficient funds
        if (availableBalance < amount) {
          throw new Error(`Insufficient funds. Available: $${(availableBalance / 100).toFixed(2)}, Requested: $${(amount / 100).toFixed(2)}`);
        }

        const newBalance = currentBalance - amount;

        // Update user balance
        await tx
          .update(users)
          .set({
            accountBalance: newBalance,
            availableBalance: newBalance - minimumBalance,
            totalSpent: (user[0].totalSpent || 0) + amount
          })
          .where(eq(users.id, userId));

        // Record transaction
        const transactionData: InsertAccountTransaction = {
          userId,
          transactionType: 'withdrawal',
          amount: -amount, // Negative for withdrawal
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description,
          paymentMethod,
          stripeTransactionId,
          status: 'completed',
          processedAt: new Date()
        };

        const [transaction] = await tx
          .insert(accountTransactions)
          .values(transactionData)
          .returning();

        return {
          success: true,
          transactionId: transaction.id,
          newBalance
        };
      });
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deduct fees from subscriber account
   */
  async deductFees(
    userId: number, 
    amount: number, 
    description: string, 
    jobId?: number
  ): Promise<TransactionResult> {
    try {
      return await db.transaction(async (tx) => {
        // Get current balance
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('User not found');
        }

        const currentBalance = user[0].accountBalance || 0;
        const minimumBalance = user[0].minimumBalance || 2500;
        const availableBalance = currentBalance - minimumBalance;

        // Check if user has sufficient funds for fee deduction
        if (availableBalance < amount) {
          throw new Error(`Insufficient funds for fee deduction. Available: $${(availableBalance / 100).toFixed(2)}, Required: $${(amount / 100).toFixed(2)}`);
        }

        const newBalance = currentBalance - amount;

        // Update user balance
        await tx
          .update(users)
          .set({
            accountBalance: newBalance,
            availableBalance: newBalance - minimumBalance,
            totalSpent: (user[0].totalSpent || 0) + amount
          })
          .where(eq(users.id, userId));

        // Record transaction
        const transactionData: InsertAccountTransaction = {
          userId,
          transactionType: 'fee_deduction',
          amount: -amount, // Negative for deduction
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description,
          jobId,
          status: 'completed',
          processedAt: new Date()
        };

        const [transaction] = await tx
          .insert(accountTransactions)
          .values(transactionData)
          .returning();

        return {
          success: true,
          transactionId: transaction.id,
          newBalance
        };
      });
    } catch (error) {
      console.error('Error deducting fees:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add contractor payment (for when they get paid)
   */
  async addContractorPayment(
    contractorId: number, 
    amount: number, 
    description: string, 
    jobId?: number,
    stripeTransactionId?: string
  ): Promise<TransactionResult> {
    try {
      return await db.transaction(async (tx) => {
        // Get current balance
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, contractorId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('Contractor not found');
        }

        const currentBalance = user[0].accountBalance || 0;
        const newBalance = currentBalance + amount;
        const pendingBalance = Math.max(0, (user[0].pendingBalance || 0) - amount);

        // Update user balance
        await tx
          .update(users)
          .set({
            accountBalance: newBalance,
            availableBalance: newBalance - (user[0].minimumBalance || 0), // Contractors don't need minimum balance
            pendingBalance: pendingBalance,
            totalEarnings: (user[0].totalEarnings || 0) + amount
          })
          .where(eq(users.id, contractorId));

        // Record transaction
        const transactionData: InsertAccountTransaction = {
          userId: contractorId,
          transactionType: 'contractor_payment',
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description,
          jobId,
          stripeTransactionId,
          status: 'completed',
          processedAt: new Date()
        };

        const [transaction] = await tx
          .insert(accountTransactions)
          .values(transactionData)
          .returning();

        return {
          success: true,
          transactionId: transaction.id,
          newBalance
        };
      });
    } catch (error) {
      console.error('Error adding contractor payment:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add pending balance for contractor (when client pays but contractor can't be paid yet)
   */
  async addPendingBalance(contractorId: number, amount: number, description: string, jobId?: number): Promise<TransactionResult> {
    try {
      return await db.transaction(async (tx) => {
        // Get current balance
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, contractorId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('Contractor not found');
        }

        const currentPendingBalance = user[0].pendingBalance || 0;
        const newPendingBalance = currentPendingBalance + amount;

        // Update user pending balance
        await tx
          .update(users)
          .set({
            pendingBalance: newPendingBalance
          })
          .where(eq(users.id, contractorId));

        // Record transaction as pending
        const transactionData: InsertAccountTransaction = {
          userId: contractorId,
          transactionType: 'contractor_payment',
          amount,
          balanceBefore: user[0].accountBalance || 0,
          balanceAfter: user[0].accountBalance || 0, // No change to account balance yet
          description: `${description} (Pending)`,
          jobId,
          status: 'pending'
        };

        const [transaction] = await tx
          .insert(accountTransactions)
          .values(transactionData)
          .returning();

        return {
          success: true,
          transactionId: transaction.id,
          newBalance: user[0].accountBalance || 0
        };
      });
    } catch (error) {
      console.error('Error adding pending balance:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(userId: number, limit: number = 50): Promise<any[]> {
    return await db
      .select()
      .from(accountTransactions)
      .where(eq(accountTransactions.userId, userId))
      .orderBy(desc(accountTransactions.createdAt))
      .limit(limit);
  }

  /**
   * Check if user has sufficient balance for an operation
   */
  async checkSufficientBalance(userId: number, requiredAmount: number): Promise<{ sufficient: boolean; availableBalance: number; message?: string }> {
    const balanceInfo = await this.getBalanceInfo(userId);
    const availableBalance = balanceInfo.accountBalance - balanceInfo.minimumBalance;
    
    return {
      sufficient: availableBalance >= requiredAmount,
      availableBalance,
      message: availableBalance < requiredAmount 
        ? `Insufficient funds. Available: $${(availableBalance / 100).toFixed(2)}, Required: $${(requiredAmount / 100).toFixed(2)}`
        : undefined
    };
  }

  /**
   * Update minimum balance requirement for a user
   */
  async updateMinimumBalance(userId: number, newMinimumBalance: number): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({ minimumBalance: newMinimumBalance })
        .where(eq(users.id, userId));
      
      return true;
    } catch (error) {
      console.error('Error updating minimum balance:', error);
      return false;
    }
  }
} 