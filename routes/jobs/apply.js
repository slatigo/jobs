const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Job, Application, sequelize } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { isClosed, closedReason } = require('../../utils/jobStatus');
const { logStatusChange } = require('../../utils/logStatusChange');
const { upload, handleUploadError } = require('../../middleware/upload');
const { sendApplicationReceivedEmail } = require('../../utils/mail');
const { format: formatEAT } = require('../../utils/appTime');

/* ================================================================== */
/* POST /:id/apply — submit application with attachment                */
/* ================================================================== */
router.post(
  '/:id/apply',
  isAuthenticated,
  (req, res, next) => {
    upload.single('attachment')(req, res, (err) => {
      if (err) {
        let message = 'Upload failed. Please try again.';
        if (err.code === 'LIMIT_FILE_SIZE') {
          message = 'Attachment must be 10 MB or smaller.';
        } else if (err.message && /file type|mime|extension/i.test(err.message)) {
          message = 'Only PDF, DOC, or DOCX files are allowed.';
        }
        return res.status(400).json({ ok: false, message, field: 'attachment' });
      }
      next();
    });
  },
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const job = await Job.findByPk(req.params.id, { transaction: t });
      if (!job) {
        await t.rollback();
        return res.status(404).json({ ok: false, message: 'Job not found.' });
      }

      /* ---- Reject if job is closed ---- */
      if (isClosed(job)) {
        await t.rollback();
        const reason = closedReason(job);
        return res.status(400).json({
          ok: false,
          message: reason === 'deadline-passed'
            ? 'The application deadline for this job has passed.'
            : 'This job is no longer accepting applications.'
        });
      }

      /* ---- Prevent duplicate applications ---- */
      const existing = await Application.findOne({
        where: { jobId: job.id, userId: req.session.user.id },
        transaction: t
      });

      if (existing) {
        await t.rollback();
        return res.status(400).json({
          ok: false,
          message: 'You have already applied to this job.'
        });
      }

      /* ---- Validate required fields ---- */
      const { fullName, email, phone } = req.body;

      if (!fullName || !fullName.trim() || fullName.trim().length < 3) {
        await t.rollback();
        return res.status(400).json({ ok: false, message: 'Full name is required (at least 3 characters).', field: 'fullName' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        await t.rollback();
        return res.status(400).json({ ok: false, message: 'A valid email address is required.', field: 'email' });
      }
      if (!phone || !phone.trim()) {
        await t.rollback();
        return res.status(400).json({ ok: false, message: 'Phone number is required.', field: 'phone' });
      }
      if (!req.file) {
        await t.rollback();
        return res.status(400).json({ ok: false, message: 'Please attach your CV or resume.', field: 'attachment' });
      }

      /* ---- Create application ---- */
      const application = await Application.create(
        {
          jobId: job.id,
          userId: req.session.user.id,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          coverLetter: null,
          attachmentUrl:  `/uploads/resumes/${req.file.filename}`,
          attachmentName: req.file.originalname,
          attachmentMime: req.file.mimetype,
          attachmentSize: req.file.size,
          status: 'pending'
        },
        { transaction: t }
      );

      /* ---- Initial history row ---- */
      await logStatusChange({
        applicationId: application.id,
        fromStatus: null,
        toStatus: 'pending',
        changedByUserId: req.session.user.id,
        source: 'submit',
        transaction: t
      });

      await t.commit();
      
      sendApplicationReceivedEmail({
        to: req.session.user.email,
        name: fullName.trim(),
        jobTitle: job.title,
        jobRef: job.jobRef || null,
        departmentName: job.department ? job.department.name : null,
        appliedAt: formatEAT(application.createdAt),
        jobUrl: `${process.env.APP_URL || 'http://localhost:3000'}/jobs/my-applications`
      }).catch((err) => {
        console.error('[APPLY EMAIL]', err.message);
      });

      return res.json({
        ok: true,
        message: 'Application submitted successfully! You can track its status under My Applications.',
        redirect: `/jobs/${job.id}`
      });
    } catch (err) {
      await t.rollback();
      console.error('[JOBS APPLY]', err);

      let message = 'Something went wrong. Please try again.';
      if (err.name === 'SequelizeUniqueConstraintError') {
        message = 'You have already applied to this job.';
      } else if (err.name === 'SequelizeValidationError') {
        message = 'Please check the information you entered.';
      }

      return res.status(500).json({ ok: false, message });
    }
  }
);

/* ================================================================== */
/* POST /:id/withdraw — Delete application, file, and log the action   */
/* ================================================================== */
router.post('/:id/withdraw', isAuthenticated, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const job = await Job.findByPk(req.params.id, { transaction: t });
    
    if (!job || isClosed(job)) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'The deadline has passed. You can no longer withdraw.' });
    }

    const application = await Application.findOne({
      where: { jobId: req.params.id, userId: req.session.user.id },
      transaction: t
    });

    if (!application) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: 'Application not found.' });
    }

    // 1. Log the withdrawal to the server console (Audit Trail)
    console.log(`[WITHDRAWAL] User ${req.session.user.email} (ID: ${req.session.user.id}) withdrew their application for Job: "${job.title}" (ID: ${job.id}). Deleted file: ${application.attachmentName}`);

    // 2. Delete the physical PDF/DOC file from the server disk
    if (application.attachmentUrl) {
      // The attachmentUrl is stored as "/uploads/resumes/filename.pdf"
      // We strip the leading slash to safely join it with the public directory path
      const relativePath = application.attachmentUrl.startsWith('/') 
        ? application.attachmentUrl.slice(1) 
        : application.attachmentUrl;
        
      const filePath = path.join(__dirname, '..', '..', 'public', relativePath);
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.error('[WITHDRAW FILE DELETE ERROR]', fileErr);
          // We don't rollback the DB transaction if the file fails to delete, 
          // the DB record should still be removed.
        }
      }
    }

    // 3. Delete the application record from the database
    // (Note: If your DB has Cascade Delete, this will also wipe the history log. 
    // If you want to keep history, remove this line and just update the status.)
    await application.destroy({ transaction: t });

    await t.commit();
    
    return res.json({
      ok: true,
      message: 'Your application has been withdrawn and removed. You can now apply again.',
      redirect: `/jobs/${req.params.id}`
    });

  } catch (err) {
    await t.rollback();
    console.error('[WITHDRAW ERROR]', err);
    return res.status(500).json({ ok: false, message: 'Something went wrong while withdrawing. Please try again.' });
  }
});

module.exports = router;