import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    
    return await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

export const sendEmailToAdmin = async (subject: string, html: string) => {
  try {
    
    return await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ADMIN_EMAIL || "parentscare.xyz@gmail.com",
      subject,
      html,
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};