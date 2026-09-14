import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: 10000,
});

const FROM_NAME = "EduNivo";

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.EMAIL_USER) {
    console.log("[Mail skipped — EMAIL_USER not set]", { to, subject });
    return;
  }
  await transporter.sendMail({ from: `"${FROM_NAME}" <${process.env.EMAIL_USER}>`, to, subject, html });
}

export const sendOTPMail = (to: string, otp: string) =>
  sendMail(
    to,
    "OTP Verification",
    `<div style="font-family:sans-serif;padding:24px"><h2 style="color:#4F46E5">Your OTP</h2><h1 style="letter-spacing:8px">${otp}</h1><p>Valid 5 minutes.</p></div>`,
  );

export const sendCredentialsMail = (to: string, data: { name: string; userId: string; email: string; password: string }) =>
  sendMail(
    to,
    "Your Account Credentials",
    `<div style="font-family:sans-serif;padding:24px"><h2>Welcome ${data.name}</h2><p>ID: <b>${data.userId}</b></p><p>Email: <b>${data.email}</b></p><p>Password: <b>${data.password}</b></p><p style="color:red">Change password after login.</p></div>`,
  );

export const sendPasswordResetMail = (to: string, otp: string) =>
  sendMail(
    to,
    "Password Reset OTP",
    `<div style="font-family:sans-serif;padding:24px"><h2>Reset OTP</h2><h1 style="letter-spacing:8px">${otp}</h1><p>Valid 5 minutes.</p></div>`,
  );

export const sendAbsentAlertMail = (to: string, name: string, date: string) =>
  sendMail(
    to,
    `Absence Alert - ${name}`,
    `<div style="font-family:sans-serif;padding:24px"><h2 style="color:red">Absence Alert</h2><p>Your child <b>${name}</b> was absent on <b>${date}</b>.</p></div>`,
  );
