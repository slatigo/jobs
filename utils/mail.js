const { transporter, fromAddress } = require('../config/mailer');

/* ------------------------------------------------------------------ */
/* Shared HTML shell — keeps emails consistent                         */
/* ------------------------------------------------------------------ */
function shell(title, bodyHtml) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.06);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:24px 28px;color:#fff;">
                    <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;">
                      MUBS <span style="font-weight:400;opacity:.85;">Job Portal</span>
                    </div>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 28px;font-size:15px;line-height:1.6;color:#334155;">
                    ${bodyHtml}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#0f172a;padding:20px 28px;color:#94a3b8;font-size:12px;line-height:1.5;">
                    This is an automated message from the MUBS Job Portal.<br>
                    Do not reply to this email.<br>
                    <a href="https://jobs.mubs.ac.ug" style="color:#60a5fa;text-decoration:none;">jobs.mubs.ac.ug</a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/* ------------------------------------------------------------------ */
/* Welcome email — sent after registration                             */
/* ------------------------------------------------------------------ */
async function sendWelcomeEmail({ to, name, role }) {
  const isApplicant = role === 'applicant';

  const title = 'Welcome to MUBS Job Portal';
  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your account on the MUBS Job Portal has been created successfully.</p>
    ${isApplicant
      ? `<p>You can now browse open vacancies and submit applications. Log in any time to track your progress.</p>`
      : `<p>You can now post vacancies from your department. Log in to get started.</p>`}
    <p style="margin:24px 0;">
      <a href="https://jobs.mubs.ac.ug/auth/login"
         style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
        Log in to your account
      </a>
    </p>
    <p style="color:#64748b;font-size:13px;">If you didn't create this account, please ignore this email.</p>
  `;

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Welcome to MUBS Job Portal',
    html: shell(title, body)
  });
}

/* ------------------------------------------------------------------ */
/* Application status change — sent when HR updates an application     */
/* ------------------------------------------------------------------ */
async function sendStatusChangeEmail({ to, name, jobTitle, status, companyName }) {
  const copy = {
    reviewed: {
      subject: `Your application for "${jobTitle}" is under review`,
      message: `We've started reviewing your application. We'll be in touch soon.`
    },
    shortlisted: {
      subject: `You've been shortlisted for "${jobTitle}"`,
      message: `Good news — you've been shortlisted. The recruitment team will contact you with next steps.`
    },
    accepted: {
      subject: `Congratulations! You've been selected for "${jobTitle}"`,
      message: `We're pleased to inform you that you have been selected for this position. Please check your email for further instructions from the HR office.`
    },
    rejected: {
      subject: `Update on your application for "${jobTitle}"`,
      message: `Thank you for your interest. After careful consideration, we've decided to move forward with other candidates. We encourage you to apply for future openings.`
    }
  };

  const c = copy[status];
  if (!c) return null; // don't send for pending/reverted statuses

  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>${c.message}</p>
    <p style="margin:24px 0;">
      <a href="https://jobs.mubs.ac.ug/jobs"
         style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
        Browse other vacancies
      </a>
    </p>
    <p style="color:#64748b;font-size:13px;">Position: <strong>${jobTitle}</strong>${companyName ? ` — ${companyName}` : ''}</p>
  `;

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject: c.subject,
    html: shell(c.subject, body)
  });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset your MUBS Job Portal password.</p>
    <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
    <p style="margin:24px 0;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
        Reset My Password
      </a>
    </p>
    <p style="color:#64748b;font-size:13px;">
      If you didn't request this, you can safely ignore this email — your password won't change.
    </p>
  `;

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Reset your MUBS Job Portal password',
    html: shell('Reset Password', body)
  });
}
/* ------------------------------------------------------------------
   Application received — sent to the applicant on successful submit
   ------------------------------------------------------------------ */
async function sendApplicationReceivedEmail({
  to,
  name,
  jobTitle,
  jobRef,
  departmentName,
  appliedAt,
  jobUrl
}) {
  const subject = `Application received — ${jobTitle}`;

  const body = `
    <p>Hi <strong>${name}</strong>,</p>

    <p>Thank you for applying for <strong>${jobTitle}</strong> at Makerere University Business School. We've received your application and it's now under consideration.</p>

    <p style="margin:16px 0;padding:16px;background:#f1f5f9;border-radius:8px;color:#334155;font-size:14px;">
      <strong style="display:block;margin-bottom:6px;color:#1e293b;">Application details</strong>
      Position: <strong>${jobTitle}</strong><br>
      ${departmentName ? `Department: ${departmentName}<br>` : ''}
      ${jobRef ? `Reference: <span style="font-family:ui-monospace,monospace;">${jobRef}</span><br>` : ''}
      Applied on: ${appliedAt}
    </p>

    <p>You can track the status of your application anytime from your dashboard:</p>

    <p style="margin:24px 0;">
      <a href="${jobUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">View My Applications</a>
    </p>

    <p style="color:#64748b;font-size:13px;">
      The recruitment team will be in touch if your application progresses. Please don't reply to this email directly — use the contact details listed on the job posting if you have questions.
    </p>
  `;

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html: shell(subject, body)
  });
}
module.exports = { sendWelcomeEmail, sendStatusChangeEmail, sendPasswordResetEmail, sendApplicationReceivedEmail };
