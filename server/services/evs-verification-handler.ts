import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

interface EVSResult {
  success: boolean;
  status: string;
  confidence?: number;
  transactionId?: string;
  document?: {
    extractedData?: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      documentNumber?: string;
      expirationDate?: string;
      address?: string;
    }
  };
}

export class EVSVerificationHandler {
  
  static async updateUserVerificationStatus(userId: string, evsResult: EVSResult): Promise<boolean> {
    try {
      console.log(`🔍 EVS Handler: Processing verification result for user ${userId}`);
      console.log(`🔍 EVS Handler: Result status - success: ${evsResult.success}, status: ${evsResult.status}`);
      
      // Determine if verification was successful
      const isSuccessful = evsResult.success && evsResult.status === 'approved';
      const confidence = evsResult.confidence || 0;
      const verificationId = evsResult.transactionId || `evs_${Date.now()}`;
      
      console.log(`🔍 EVS Handler: isSuccessful: ${isSuccessful}, confidence: ${confidence}%, transactionId: ${verificationId}`);

      if (isSuccessful) {
        console.log(`✅ EVS Handler: About to update database for user ${userId} with successful verification`);
        
        // Prepare update data
        const updateData: any = { 
          isVerified: true,
          verificationStatus: 'approved',
          evsTransactionId: verificationId,
          evsVerificationConfidence: confidence,
          evsVerifiedAt: new Date(),
          updatedAt: new Date()
        };

        // Add extracted document data if available
        if (evsResult.document?.extractedData) {
          const extracted = evsResult.document.extractedData;
          
          if (extracted.firstName) {
            updateData.extractedFirstName = extracted.firstName;
          }
          if (extracted.lastName) {
            updateData.extractedLastName = extracted.lastName;
          }
          if (extracted.dateOfBirth) {
            updateData.extractedDateOfBirth = new Date(extracted.dateOfBirth);
          }
          if (extracted.documentNumber) {
            updateData.extractedDocumentNumber = extracted.documentNumber;
          }
          if (extracted.expirationDate) {
            updateData.extractedExpirationDate = new Date(extracted.expirationDate);
          }
          if (extracted.address) {
            updateData.extractedAddress = extracted.address;
          }
          
          console.log(`📄 EVS Handler: Added extracted document data for user ${userId}`);
        }

        // Execute database update
        console.log(`🔄 EVS Handler: Executing database update for user ${userId}...`);
        const dbUpdateResult = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, parseInt(userId)))
          .returning({ id: users.id, isVerified: users.isVerified, verificationStatus: users.verificationStatus });
        
        console.log(`✅ EVS Handler: Database update completed for user ${userId}:`, dbUpdateResult);
        
        if (dbUpdateResult && dbUpdateResult.length > 0) {
          console.log(`🎉 EVS Handler: Successfully updated user ${userId} verification status to approved`);
          return true;
        } else {
          console.error(`❌ EVS Handler: Database update returned no results for user ${userId}`);
          return false;
        }
        
      } else {
        console.log(`❌ EVS Handler: Verification not successful for user ${userId} - success: ${evsResult.success}, status: ${evsResult.status}`);
        
        // Update with failed verification status
        const failedUpdateData = {
          verificationStatus: 'rejected',
          evsTransactionId: verificationId,
          evsVerificationConfidence: confidence,
          updatedAt: new Date()
        };
        
        await db
          .update(users)
          .set(failedUpdateData)
          .where(eq(users.id, parseInt(userId)));
          
        console.log(`⚠️  EVS Handler: Updated user ${userId} with failed verification status`);
        return false;
      }
      
    } catch (error) {
      console.error(`💥 EVS Handler: Error updating verification status for user ${userId}:`, error);
      return false;
    }
  }
  
  static async getUserVerificationStatus(userId: string) {
    try {
      const user = await db
        .select({
          id: users.id,
          isVerified: users.isVerified,
          verificationStatus: users.verificationStatus,
          evsTransactionId: users.evsTransactionId,
          evsVerificationConfidence: users.evsVerificationConfidence,
          evsVerifiedAt: users.evsVerifiedAt
        })
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);
        
      return user.length > 0 ? user[0] : null;
    } catch (error) {
      console.error(`💥 EVS Handler: Error getting verification status for user ${userId}:`, error);
      return null;
    }
  }
  
  static async logVerificationAttempt(userId: string, evsResult: EVSResult, processingTimeMs: number) {
    try {
      // This could be expanded to log to a verification attempts table
      console.log(`📝 EVS Handler: Logging verification attempt for user ${userId}`);
      console.log(`📝 Details: success=${evsResult.success}, status=${evsResult.status}, confidence=${evsResult.confidence}%, time=${processingTimeMs}ms`);
      
      // You could add database logging here if needed
      return true;
    } catch (error) {
      console.error(`💥 EVS Handler: Error logging verification attempt for user ${userId}:`, error);
      return false;
    }
  }
} 