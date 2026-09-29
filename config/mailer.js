const nodemailer = require('nodemailer');

/* ------------------------------------------------------------------ */
/* SMTP transporter — shared across the app                            */
/* ------------------------------------------------------------------ */
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_SECURE === 'true',   // true for 465, false for 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

/* Default from — "MUBS Job Portal <noreply@mubs.ac.ug>" */
const fromAddress = `"${process.env.MAIL_FROM_NAME || 'MUBS Job Portal'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USER}>`;

/* ------------------------------------------------------------------ */
/* Verify on startup (dev only)                                        */
/* ------------------------------------------------------------------ */
async function verifyMailer() {
  try {
    await transporter.verify();
    console.log('✅ Mailer ready');
  } catch (err) {
    console.error('❌ Mailer failed:', err.message);
    // Don't crash — the app can still run without email
  }
}

module.exports = { transporter, fromAddress, verifyMailer };