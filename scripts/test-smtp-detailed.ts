import nodemailer from "nodemailer";

async function testSMTPDetailed() {
  console.log("🔍 Running Detailed SMTP Diagnostics...\n");
  
  const configs = [
    {
      name: "Hostinger SSL (Port 465)",
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || ""
      }
    },
    {
      name: "Hostinger TLS (Port 587)",
      host: "smtp.hostinger.com", 
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || ""
      },
      tls: {
        rejectUnauthorized: false
      }
    }
  ];
  
  for (const config of configs) {
    console.log(`\n📧 Testing: ${config.name}`);
    console.log("=" .repeat(50));
    
    const transporter = nodemailer.createTransport(config);
    
    // Enable debug output
    transporter.set('debug', true);
    
    try {
      // Verify connection
      console.log("1️⃣ Verifying connection...");
      await transporter.verify();
      console.log("✅ Connection verified!");
      
      // Send test email with detailed logging
      console.log("\n2️⃣ Sending test email...");
      const info = await transporter.sendMail({
        from: `"USA Notary Test" <${process.env.SMTP_USER || "test@example.com"}>`,
        to: "test@gmail.com, test@yahoo.com", // Try multiple providers
        subject: `SMTP Test - ${new Date().toISOString()}`,
        text: "This is a plain text test email",
        html: "<p>This is an <b>HTML</b> test email</p>",
        headers: {
          'X-Test-Header': 'test-value'
        }
      });
      
      console.log("\n✅ Email sent!");
      console.log("Message ID:", info.messageId);
      console.log("Response:", info.response);
      console.log("Accepted:", info.accepted);
      console.log("Rejected:", info.rejected);
      console.log("Pending:", info.pending);
      console.log("Full info:", JSON.stringify(info, null, 2));
      
    } catch (error: any) {
      console.error("\n❌ Error:", error.message);
      if (error.response) {
        console.error("Server response:", error.response);
      }
      if (error.responseCode) {
        console.error("Response code:", error.responseCode);
      }
      console.error("Full error:", error);
    }
    
    // Close connection
    transporter.close();
  }
  
  console.log("\n\n💡 Troubleshooting Tips:");
  console.log("1. Check if your Hostinger account has email sending enabled");
  console.log("2. Verify that your email address exists in your hosting Email");
  console.log("3. Check if there are any sending limits on your account");
  console.log("4. Try logging into webmail.hostinger.com with these credentials");
  console.log("5. Contact Hostinger support to check if outbound SMTP is blocked");
  
  process.exit();
}

testSMTPDetailed(); 