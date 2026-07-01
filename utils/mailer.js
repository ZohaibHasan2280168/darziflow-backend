import nodemailer from 'nodemailer';
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: process.env.SMTP_SECURE === 'true',
    auth:{
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    } 
})

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"DarziFlow Support" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log("📧 Email sent to", to);
  } catch (error) {
    console.error("Email error:", error);
   throw new Error(error.message);
  }
};

export {sendEmail};