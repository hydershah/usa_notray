// Quick script to trigger signer invitations for Job #9
const { NotificationService } = require('./server/notification-service');

async function triggerInvitations() {
  try {
    const notificationService = new NotificationService();
    await notificationService.sendSignerInvitations(9);
    console.log('✅ Signer invitations sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send invitations:', error);
  }
  process.exit(0);
}

triggerInvitations();
