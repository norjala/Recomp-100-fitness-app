import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY!);

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
    await mailService.send({
      to: params.to,
      from: FROM_EMAIL,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome to FitnessForge!</h1>
      <p>Thanks for joining our 100-day body recomposition challenge. To complete your registration, please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
      </div>
      <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">This verification link will expire in 24 hours.</p>
    </div>
  `;

  const text = `
    Welcome to FitnessForge!
    
    Thanks for joining our 100-day body recomposition challenge. To complete your registration, please verify your email address by visiting:
    
    ${verificationUrl}
    
    This verification link will expire in 24 hours.
  `;

  return await sendEmail({
    to: email,
    subject: 'Verify your FitnessForge account',
    html,
    text,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Reset Your FitnessForge Password</h1>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">This reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `;

  const text = `
    Reset Your FitnessForge Password
    
    We received a request to reset your password. Visit the following link to create a new password:
    
    ${resetUrl}
    
    This reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  `;

  return await sendEmail({
    to: email,
    subject: 'Reset your FitnessForge password',
    html,
    text,
  });
}