const express = require('express');
const router = express.Router();
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

      // 🔴 FIX 1: Only block if they haven't withdrawn
      if (existing && existing.status !== 'withdrawn') {
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
        return res.status(400).json({
          ok: false,
          message: 'Full name is required (at least 3 characters).',
          field: 'fullName'
        });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        await t.rollback();
        return res.status(400).json({
          ok: false,
          message: 'A valid email address is required.',
          field: 'email'
        });
      }
      if (!phone || !phone.trim()) {
        await t.rollback();
        return res.status(400).json({
          ok: false,
          message: 'Phone number is required.',
          field: 'phone'
        });
      }
      if (!req.file) {
        await t.rollback();
        return res.status(400).json({
          ok: false,
          message: 'Please attach your CV or resume.',
          field: 'attachment'
        });
      }

      /* ---- Create OR Update application ---- */
      let application;
      const applicationData = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        coverLetter: null,
        attachmentUrl:  `/uploads/resumes/${req.file.filename}`,
        attachmentName: req.file.originalname,
        attachmentMime: req.file.mimetype,
        attachmentSize: req.file.size,
        status: 'pending'
      };

      // 🔴 FIX 2: If withdrawn, overwrite the old record and reset to pending
      if (existing && existing.status === 'withdrawn') {
        application = await existing.update(applicationData, { transaction: t });
      } else {
        application = await Application.create({
          jobId: job.id,
          userId: req.session.user.id,
          ...applicationData
        }, { transaction: t });
      }

      /* ---- Initial history row ---- */
      await logStatusChange({
        applicationId: application.id,
        fromStatus: existing ? existing.status : null,
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
/* POST /:id/withdraw — Withdraw an application (AJAX)                 */
/* ================================================================== */
router.post('/:id/withdraw', isAuthenticated, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const job = await Job.findByPk(req.params.id, { transaction: t });
    
    if (!job || isClosed(job)) {
      await t.rollback();
      // 🔴 FIX 3: Return JSON instead of redirect
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

    // Log the change (so HR can see they withdrew)
    await logStatusChange({
      applicationId: application.id,
      fromStatus: application.status,
      toStatus: 'withdrawn',
      changedByUserId: req.session.user.id,
      source: 'applicant',
      transaction: t
    });

    // Update status instead of destroying the record
    application.status = 'withdrawn';
    await application.save({ transaction: t });

    await t.commit();
    
    // 🔴 FIX 4: Return JSON success message for the frontend SweetAlert
    return res.json({
      ok: true,
      message: 'Your application has been withdrawn. You can now apply again.',
      redirect: `/jobs/${req.params.id}`
    });

  } catch (err) {
    await t.rollback();
    console.error('[WITHDRAW ERROR]', err);
    // 🔴 FIX 5: Return JSON error for the frontend
    return res.status(500).json({ ok: false, message: 'Something went wrong while withdrawing. Please try again.' });
  }
});

module.exports = router;