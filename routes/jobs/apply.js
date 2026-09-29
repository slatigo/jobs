const express = require('express');
const router = express.Router();
const { Job, Application, sequelize } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { isClosed, closedReason } = require('../../utils/jobStatus');
const { logStatusChange } = require('../../utils/logStatusChange');
const { upload, handleUploadError } = require('../../middleware/upload');

/* ================================================================== */
/* POST /:id/apply — submit application with CV upload                 */
/* ================================================================== */
router.post(
  '/:id/apply',
  isAuthenticated,
  (req, res, next) => {
    upload.single('attachment')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const job = await Job.findByPk(req.params.id, { transaction: t });
      if (!job) throw new Error('Job not found');

      if (isClosed(job)) {
        await t.rollback();
        const reason = closedReason(job);
        req.flash(
          'error',
          reason === 'deadline-passed'
            ? 'The application deadline for this job has passed.'
            : 'This job is no longer accepting applications.'
        );
        return res.redirect(`/jobs/${job.id}`);
      }

      const existing = await Application.findOne({
        where: { jobId: job.id, userId: req.session.user.id },
        transaction: t
      });

      if (existing) {
        await t.rollback();
        req.flash('error', 'You have already applied to this job.');
        return res.redirect(`/jobs/${job.id}`);
      }

      const { fullName, email, phone, coverLetter } = req.body;

      if (!fullName || !email || !phone || !coverLetter) {
        await t.rollback();
        req.flash('error', 'Please fill in all application fields.');
        return res.redirect(`/jobs/${job.id}`);
      }

      if (!req.file) {
        await t.rollback();
        req.flash('error', 'Please attach your CV / resume (PDF or Word).');
        return res.redirect(`/jobs/${job.id}`);
      }

      const application = await Application.create(
        {
          jobId: job.id,
          userId: req.session.user.id,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          coverLetter: coverLetter.trim(),
          attachmentUrl:  `/uploads/resumes/${req.file.filename}`,
          attachmentName: req.file.originalname,
          attachmentMime: req.file.mimetype,
          attachmentSize: req.file.size,
          status: 'pending'
        },
        { transaction: t }
      );

      await logStatusChange({
        applicationId: application.id,
        fromStatus: null,
        toStatus: 'pending',
        changedByUserId: req.session.user.id,
        source: 'submit',
        transaction: t
      });

      await t.commit();
      req.flash('success', 'Application submitted successfully!');
      res.redirect(`/jobs/${job.id}`);
    } catch (err) {
      await t.rollback();
      console.error('[JOBS APPLY]', err);
      req.flash('error', 'Error submitting application: ' + err.message);
      res.redirect(`/jobs/${req.params.id}`);
    }
  }
);

module.exports = router;