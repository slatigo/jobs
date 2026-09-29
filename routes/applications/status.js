const express = require('express');
const router = express.Router({ mergeParams: true });
const { Job, Application, sequelize } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { logStatusChange } = require('../../utils/logStatusChange');

/* ================================================================== */
/* POST /:appId/status — change a single application's status          */
/* ================================================================== */
router.post('/:appId/status', isAuthenticated, async (req, res) => {
  try {
    const { status, reason } = req.body;

    const ALLOWED = ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'];
    if (!ALLOWED.includes(status)) {
      req.flash('error', 'Invalid status.');
      return res.redirect(`/jobs/${req.params.id}/applications`);
    }

    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const isPoster = req.session.user.id === job.userId;
    const isAdmin = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      req.flash('error', 'You are not allowed to update applications for this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    const application = await Application.findOne({
      where: { id: req.params.appId, jobId: job.id }
    });

    if (!application) {
      req.flash('error', 'Application not found.');
      return res.redirect(`/jobs/${job.id}/applications`);
    }

    const fromStatus = application.status;

    if (fromStatus === status) {
      req.flash('error', 'Application is already in that status.');
      return res.redirect(req.body.returnTo || `/jobs/${job.id}/applications`);
    }

    await sequelize.transaction(async (t) => {
      application.status = status;
      await application.save({ transaction: t });

      await logStatusChange({
        applicationId: application.id,
        fromStatus,
        toStatus: status,
        changedByUserId: req.session.user.id,
        reason: reason || null,
        source: 'single',
        transaction: t
      });
    });

    const back = req.body.returnTo || `/jobs/${job.id}/applications`;
    req.flash('success', `Application marked as ${status}.`);
    res.redirect(back);
  } catch (err) {
    console.error('[APPLICATION STATUS]', err);
    req.flash('error', 'Error updating application status.');
    res.redirect(`/jobs/${req.params.id}/applications`);
  }
});

module.exports = router;