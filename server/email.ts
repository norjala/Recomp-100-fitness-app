// Simplified email service for Bolt hosting
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // For Bolt hosting, log email instead of sending
    console.log('Email would be sent:', {
      to: params.to,
      subject: params.subject,
      text: params.text
    });
    return true;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  
  const text = `
    Welcome to 💯 Day Recomp!
    
    Thanks for joining our 100-day body recomposition challenge. To complete your registration, please verify your email address by visiting:
    
    ${verificationUrl}
    
    This verification link will expire in 24 hours.
  `;

  return await sendEmail({
    to: email,
    subject: 'Verify your 💯 Day Recomp account',
    text,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  
  const text = `
    Reset Your 💯 Day Recomp Password
    
    We received a request to reset your password. Visit the following link to create a new password:
    
    ${resetUrl}
    
    This reset link will expire in 1 hour.
  `;

  return await sendEmail({
    to: email,
    subject: 'Reset your 💯 Day Recomp password',
    text,
  });
}