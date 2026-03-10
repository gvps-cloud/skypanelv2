
import 'dotenv/config';
import { sendEmail } from '../api/services/emailService.js';
import { config } from '../api/config/index.js';

async function testEmail() {
  const brandName = config.COMPANY_BRAND_NAME;

  console.log('='.repeat(60));
  console.log('Email Service Configuration Test');
  console.log('='.repeat(60));
  
  // Check environment variables
  console.log('\n📋 Configuration:');
  console.log('RESEND_API_KEY:', config.RESEND_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('SMTP_HOST:', config.SMTP_HOST || '❌ Missing');
  console.log('SMTP_PORT:', config.SMTP_PORT || '❌ Missing');
  console.log('SMTP_USERNAME:', config.SMTP_USERNAME ? '✅ Set' : '❌ Missing');
  console.log('SMTP_PASSWORD:', config.SMTP_PASSWORD ? '✅ Set' : '❌ Missing');
  console.log('FROM_EMAIL:', config.FROM_EMAIL || '❌ Missing');
  console.log('FROM_NAME:', config.FROM_NAME || brandName);
  console.log('EMAIL_PROVIDER_PRIORITY:', config.EMAIL_PROVIDER_PRIORITY.join(', '));
  
  if (!config.FROM_EMAIL) {
    console.error('\n❌ FROM_EMAIL not configured!');
    console.error('Please set FROM_EMAIL in your .env file');
    process.exit(1);
  }

  // Test email recipient
  const testEmail = process.env.TEST_EMAIL || config.FROM_EMAIL;
  
  console.log('\n📧 Test Email Details:');
  console.log('To:', testEmail);
  console.log('Subject: SkyPanelV2 Email Test');
  
  console.log('\n⏳ Sending test email using application logic...\n');
  
  try {
    await sendEmail({
      to: testEmail,
      subject: `SkyPanelV2 Email Test from ${process.env.NODE_ENV || 'development'}`,
      text: `This is a test email from your ${brandName} application.
      
Environment: ${process.env.NODE_ENV || 'development'}
Timestamp: ${new Date().toISOString()}

If you received this email, your email configuration is working correctly!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">✅ Email Test Successful</h2>
          <p>This is a test email from your ${brandName} application.</p>
          <ul style="line-height: 1.8;">
            <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            <li><strong>Provider Priority:</strong> ${config.EMAIL_PROVIDER_PRIORITY.join(', ')}</li>
          </ul>
          <p style="color: #28a745; font-weight: bold;">If you received this email, your email configuration is working correctly!</p>
        </div>
      `
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📬 Check your inbox at:', testEmail);
    console.log('(Don\'t forget to check spam folder)\n');
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ EMAIL SEND FAILED');
    console.log('='.repeat(60));
    console.error('\nError Details:');
    console.error(error);
    
    console.log('\n🔍 Troubleshooting Tips:');
    console.log('1. Verify your credentials in .env');
    console.log('2. Check if FROM_EMAIL is verified by your provider');
    console.log('3. Ensure firewall allows outbound traffic on the configured port');
    console.log('4. Check provider logs (e.g. Resend dashboard)');
    
    process.exit(1);
  }
}

testEmail();
