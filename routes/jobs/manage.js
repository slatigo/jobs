const express = require('express');
const router = express.Router();
const { Job } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');

/* ================================================================== */
/* POST /:id/close                                                     */
/* ================================================================== */
router.post('/:id/close', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const canClose =
      req.session.user.id === job.userId || req.session.user.role === 'admin';

    if (!canClose) {
      req.flash('error', 'You are not allowed to close this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    job.status = 'closed';
    await job.save();

    req.flash('success', 'Job closed successfully.');
    res.redirect(`/jobs/${job.id}`);
  } catch (err) {
    console.error('[JOBS CLOSE]', err);
    req.flash('error', 'Error closing job.');
    res.redirect(`/jobs/${req.params.id}`);
  }
});
/* ================================================================== */
/* POST /jobs/:id/reopen                                               */
/* ================================================================== */
router.post('/:id/reopen', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const canReopen =
      req.session.user.id === job.userId || req.session.user.role === 'admin';

    if (!canReopen) {
      req.flash('error', 'You are not allowed to reopen this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    /* Only reopen if closed */
    if (job.status !== 'closed') {
      req.flash('error', 'This job is already open.');
      return res.redirect(`/jobs/${job.id}`);
    }

    /* Guard: deadline must still be in the future */
    if (job.deadline && new Date(job.deadline).getTime() <= Date.now()) {
      req.flash(
        'error',
        'Cannot reopen: the deadline has passed. Extend the deadline first via Edit, then reopen.'
      );
      return res.redirect(`/jobs/${job.id}/edit`);
    }

    job.status = 'active';
    await job.save();

    req.flash('success', 'Job reopened successfully.');
    res.redirect(`/jobs/${job.id}`);
  } catch (err) {
    console.error('[JOBS REOPEN]', err);
    req.flash('error', 'Error reopening job.');
    res.redirect(`/jobs/${req.params.id}`);
  }
});
/* ================================================================== */
/* POST /:id/delete                                                    */
/* ================================================================== */
router.post('/:id/delete', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const canDelete =
      req.session.user.id === job.userId || req.session.user.role === 'admin';

    if (!canDelete) {
      req.flash('error', 'You are not allowed to delete this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    await job.destroy();
    req.flash('success', 'Job deleted.');
    res.redirect('/jobs');
  } catch (err) {
    console.error('[JOBS DELETE]', err);
    req.flash('error', 'Error deleting job.');
    res.redirect(`/jobs/${req.params.id}`);
  }
});

module.exports = router;