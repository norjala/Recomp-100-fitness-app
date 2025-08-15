// Simplified email service for Bolt hosting
export async function sendEmail(params: { to: string; subject: string; text?: string }): Promise<boolean> {
  console.log('Email would be sent:', params);
  return true;
}