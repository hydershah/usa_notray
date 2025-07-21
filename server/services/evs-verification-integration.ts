import { EVSVerificationHandler } from './evs-verification-handler.js';

// Example integration for the EVS verification endpoint
export async function handleEVSVerificationResult(userId: string, evsResult: any) {
  try {
    const startTime = Date.now();
    
    console.log(`🚀 EVS Integration: Starting verification result handling for user ${userId}`);
    
    // Use the new handler to process the verification result
    const updateSuccess = await EVSVerificationHandler.updateUserVerificationStatus(userId, evsResult);
    
    const processingTime = Date.now() - startTime;
    
    // Log the verification attempt
    await EVSVerificationHandler.logVerificationAttempt(userId, evsResult, processingTime);
    
    if (updateSuccess) {
      console.log(`✅ EVS Integration: Successfully processed verification for user ${userId}`);
      
      // Get the updated user status
      const userStatus = await EVSVerificationHandler.getUserVerificationStatus(userId);
      
      return {
        success: true,
        status: evsResult.status,
        confidence: evsResult.confidence,
        transactionId: evsResult.transactionId,
        processingTimeMs: processingTime,
        userVerified: userStatus?.isVerified || false,
        message: 'Verification completed and database updated successfully'
      };
    } else {
      console.error(`❌ EVS Integration: Failed to update database for user ${userId}`);
      
      return {
        success: false,
        status: evsResult.status || 'failed',
        confidence: evsResult.confidence || 0,
        transactionId: evsResult.transactionId,
        processingTimeMs: processingTime,
        userVerified: false,
        message: 'Verification processed but database update failed'
      };
    }
    
  } catch (error) {
    console.error(`💥 EVS Integration: Error handling verification result for user ${userId}:`, error);
    
    return {
      success: false,
      status: 'error',
      confidence: 0,
      transactionId: null,
      processingTimeMs: 0,
      userVerified: false,
      message: `Integration error: ${error.message}`
    };
  }
}

// Example of how to modify the EVS verification route to use the new handler
export const evsVerificationRouteExample = `
// In your routes file, instead of inline database updates, use:

import { handleEVSVerificationResult } from './services/evs-verification-integration.js';

// Replace the existing database update logic with:
const integrationResult = await handleEVSVerificationResult(userId, evsResult);

return res.status(integrationResult.success ? 200 : 400).json({
  success: integrationResult.success,
  status: integrationResult.status,
  confidence: integrationResult.confidence,
  transactionId: integrationResult.transactionId,
  message: integrationResult.message,
  userVerified: integrationResult.userVerified,
  processingTimeMs: integrationResult.processingTimeMs
});
`; 