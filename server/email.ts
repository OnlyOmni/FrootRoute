import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function createEmailTransporter() {
  // Check if SMTP credentials are provided
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Fallback to test email service for development
  const testAccount = await nodemailer.createTestAccount();
  
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

export async function sendWelcomeEmail(email: string, username: string) {
  try {
    const transporter = await createEmailTransporter();
    
    const emailOptions: EmailOptions = {
      to: email,
      subject: 'Welcome to FrootRoute! Your account is ready',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to FrootRoute</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #F59E0B, #DC2626); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .logo { font-size: 32px; font-weight: bold; color: white; margin-bottom: 10px; }
            .header-text { color: white; font-size: 18px; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
            .welcome-badge { background: #f8f9fa; border: 2px solid #F59E0B; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .badge-text { font-size: 24px; font-weight: bold; color: #F59E0B; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666; font-size: 14px; }
            .social { margin: 15px 0; }
            .social a { color: #F59E0B; text-decoration: none; margin: 0 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🍊 FrootRoute</div>
              <div class="header-text">Welcome to the community!</div>
            </div>
            <div class="content">
              <h2>Hello ${username}!</h2>
              <p>Congratulations! Your FrootRoute account has been successfully created and is ready to use.</p>
              
              <div class="welcome-badge">
                <div class="badge-text">✅ Account Created Successfully</div>
              </div>
              
              <p><strong>Your account details:</strong></p>
              <ul>
                <li>Username: ${username}</li>
                <li>Email: ${email}</li>
                <li>Status: Active and Ready</li>
              </ul>
              
              <p><strong>What you can do now:</strong></p>
              <ul>
                <li>🗺️ Share your location with friends</li>
                <li>👥 Create and join friend groups</li>
                <li>📱 Use FrootBand integration features</li>
                <li>🔒 Customize your privacy settings</li>
              </ul>
              
              <p><strong>Getting Started:</strong></p>
              <ol>
                <li>Complete your profile setup</li>
                <li>Add friends to start sharing locations</li>
                <li>Explore the map features</li>
              </ol>
              
              <p>Your road to real friends starts here!</p>
              
              <p>Best regards,<br>
              <strong>The FrootRoute Team</strong></p>
            </div>
            <div class="footer">
              <p>© 2024 FrootRoute. Your road to real friends starts here.</p>
              <div class="social">
                <a href="#">Privacy Policy</a> | 
                <a href="#">Terms of Service</a> | 
                <a href="#">Contact Support</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${username}!

Congratulations! Your FrootRoute account has been successfully created and is ready to use.

Your account details:
- Username: ${username}
- Email: ${email}
- Status: Active and Ready

What you can do now:
- Share your location with friends
- Create and join friend groups
- Use FrootBand integration features
- Customize your privacy settings

Getting Started:
1. Complete your profile setup
2. Add friends to start sharing locations
3. Explore the map features

Your road to real friends starts here!

Best regards,
The FrootRoute Team

© 2024 FrootRoute. Your road to real friends starts here.
      `
    };

    const info = await transporter.sendMail(emailOptions);
    
    console.log('✅ Welcome email sent successfully!');
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    };
    
  } catch (error) {
    console.error('❌ Welcome email sending failed:', error);
    throw new Error('Failed to send welcome email');
  }
}