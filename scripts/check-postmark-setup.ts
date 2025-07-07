import { Client as PostmarkClient } from 'postmark';

async function checkPostmarkSetup() {
  console.log("🔍 Checking Postmark Account Setup...\n");

  const apiKey = 'a22553c8-6da3-4b42-844c-168adeec4031';
  
  if (!apiKey) {
    console.log("❌ Postmark API key not found");
    console.log("Please set POSTMARK_API_KEY environment variable");
    process.exit(1);
  }

  const client = new PostmarkClient(apiKey);

  try {
    // Check account info
    console.log("1️⃣ Checking account information...");
    const account = await client.getAccount();
    console.log(`✅ Account: ${account.Name}`);
    console.log(`   Plan: ${account.AccountType}`);
    console.log(`   Credits: ${account.Credits || 'N/A'}`);
    console.log(`   Status: ${account.CanSendEmails ? 'Active' : 'Pending Approval'}\n`);

    // Check server info
    console.log("2️⃣ Checking server configuration...");
    const server = await client.getServer();
    console.log(`✅ Server: ${server.Name}`);
    console.log(`   ID: ${server.ID}`);
    console.log(`   Color: ${server.Color}`);
    console.log(`   SMTP API Activated: ${server.SmtpApiActivated}`);
    console.log(`   Raw Email Enabled: ${server.RawEmailEnabled}\n`);

    // Check sender signatures
    console.log("3️⃣ Checking sender signatures...");
    const signatures = await client.getSenderSignatures();
    
    if (signatures.SenderSignatures.length === 0) {
      console.log("❌ No sender signatures found");
      console.log("\n📝 You need to add a sender signature:");
      console.log("1. Go to: https://postmarkapp.com/servers/[YOUR_SERVER_ID]/sender-signatures");
      console.log("2. Add your sender email (e.g., noreply@yourdomain.com)");
      console.log("3. Verify the email address");
      console.log("4. Or verify your entire domain");
    } else {
      console.log(`✅ Found ${signatures.SenderSignatures.length} sender signature(s):`);
      signatures.SenderSignatures.forEach(sig => {
        console.log(`   📧 ${sig.EmailAddress}`);
        console.log(`      Name: ${sig.Name || 'Not set'}`);
        console.log(`      Confirmed: ${sig.Confirmed ? '✅' : '❌'}`);
        console.log(`      SPF Verified: ${sig.SPFVerified ? '✅' : '❌'}`);
        console.log(`      DKIM Verified: ${sig.DKIMVerified ? '✅' : '❌'}`);
        if (sig.Domain) {
          console.log(`      Domain: ${sig.Domain}`);
        }
        console.log("");
      });
    }

    // Check domains
    console.log("4️⃣ Checking verified domains...");
    const domains = await client.getDomains();
    
    if (domains.Domains.length === 0) {
      console.log("⚠️ No verified domains found");
      console.log("Consider verifying your domain for better deliverability");
    } else {
      console.log(`✅ Found ${domains.Domains.length} domain(s):`);
      domains.Domains.forEach(domain => {
        console.log(`   🌐 ${domain.Name}`);
        console.log(`      SPF Verified: ${domain.SPFVerified ? '✅' : '❌'}`);
        console.log(`      DKIM Verified: ${domain.DKIMVerified ? '✅' : '❌'}`);
        console.log(`      DMARC Verified: ${domain.DMARCVerified ? '✅' : '❌'}`);
        console.log("");
      });
    }

    console.log("🎯 Recommendations:");
    
    if (!account.CanSendEmails) {
      console.log("1. ⏳ Wait for account approval or contact Postmark support");
    }
    
    if (signatures.SenderSignatures.length === 0) {
      console.log("1. 📝 Add a sender signature for your from email");
      console.log("   Suggested: noreply@yourdomain.com");
    } else {
      const verifiedEmails = signatures.SenderSignatures
        .filter(sig => sig.Confirmed)
        .map(sig => sig.EmailAddress);
      
      if (verifiedEmails.length > 0) {
        console.log("2. ✅ Use one of these verified email addresses:");
        verifiedEmails.forEach(email => {
          console.log(`   - ${email}`);
        });
        
        console.log("\n🔧 Update your configuration with a verified email:");
        console.log(`   postmark_from_email: ${verifiedEmails[0]}`);
      }
    }
    
    if (domains.Domains.length === 0) {
      console.log("3. 🌐 Consider verifying your domain for better deliverability");
    }

  } catch (error) {
    console.error("❌ Postmark setup check failed:");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    
    console.log("\n💡 Common Issues:");
    console.log("1. Invalid API key");
    console.log("2. Account not activated");
    console.log("3. Network connectivity issues");
    console.log("4. API rate limits");
  }
}

// Run the check
checkPostmarkSetup().then(() => {
  console.log('\n🏁 Postmark setup check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Setup check failed:', error);
  process.exit(1);
}); 