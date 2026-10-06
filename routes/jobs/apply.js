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
/*                                                                     */
/* Returns JSON:                                                       */
/*   { ok: true,  redirect: '/jobs/:id' }                              */
/*   { ok: false, message: '...', field?: 'attachment' }               */
/*                                                                     */
/* On file-upload errors (multer), the error middleware also returns   */
/* JSON so the client can display it with SweetAlert.                  */
/* ================================================================== */
router.post(
  '/:id/apply',
  isAuthenticated,
  (req, res, next) => {
    upload.single('attachment')(req, res, (err) => {
      if (err) {
        // Translate known multer errors into friendly messages
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
        to: req.session.user.email,               // or email from the form — see note below
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

module.exports = router;