/**
 * Simple test script to verify email sending works with Mailtrap
 */

const nodemailer = require("nodemailer");

console.log("📧 Testing Email Send with Mailtrap...\n");

// Create transporter with Mailtrap credentials
const transport = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "e2e5af378f6177",
    pass: "2ae6c286bf4cda"
  }
});

// Test email options
const mailOptions = {
  from: '"Test Sender" <test@example.com>',
  to: "recipient@example.com",
  subject: "Test Email from Email Node",
  text: "This is a plain text test email.",
  html: "<h1>Hello!</h1><p>This is an <strong>HTML</strong> test email from the Email Send node.</p>"
};

// Send the email
async function sendTestEmail() {
  try {
    console.log("📤 Sending test email...");
    console.log("To:", mailOptions.to);
    console.log("Subject:", mailOptions.subject);
    console.log("");

    const info = await transport.sendMail(mailOptions);

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
    console.log("");
    console.log("🎉 Check your Mailtrap inbox at: https://mailtrap.io/inboxes");
    
  } catch (error) {
    console.error("❌ Failed to send email:");
    console.error(error.message);
    process.exit(1);
  }
}

sendTestEmail();
