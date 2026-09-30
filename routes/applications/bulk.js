const express = require('express');
const router = express.Router({ mergeParams: true });
const { Op } = require('sequelize');
const {
  Job,
  Application,
  JobStage,
  sequelize
} = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { logStatusChange } = require('../../utils/logStatusChange');

router.post('/bulk-status', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const isPoster = req.session.user.id === job.userId;
    const isAdmin  = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      req.flash('error', 'You are not allowed to update applications for this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    const { targetStage, scope, reason, applicationIds } = req.body;

    /* ---- Validate target stage ---- */
    const stageRows = await JobStage.findAll({ where: { jobId: job.id } });
    const validKeys = stageRows.length > 0
      ? stageRows.map((s) => s.key)
      : Job.DEFAULT_STAGES.map((s) => s.key);

    if (!validKeys.includes(targetStage)) {
      req.flash('error', 'Invalid target stage.');
      return res.redirect(`/jobs/${job.id}/applications`);
    }

    /* ---- Build where clause ---- */
    const where = { jobId: job.id };

    if (scope === 'selected') {
      const ids = Array.isArray(applicationIds)
        ? applicationIds.map((id) => parseInt(id, 10)).filter(Boolean)
        : [parseInt(applicationIds, 10)].filter(Boolean);

      if (ids.length === 0) {
        req.flash('error', 'No valid applications selected.');
        return res.redirect(`/jobs/${job.id}/applications`);
      }
      where.id = { [Op.in]: ids };
    } else if (scope === 'all') {
      /* no status filter */
    } else {
      /* one or more stage keys, comma-separated */
      const scopeKeys = String(scope).split(',').map((s) => s.trim()).filter(Boolean);
      const validScopeKeys = scopeKeys.filter((k) => validKeys.includes(k));

      if (validScopeKeys.length === 0) {
        req.flash('error', 'Invalid scope.');
        return res.redirect(`/jobs/${job.id}/applications`);
      }
      where.status = { [Op.in]: validScopeKeys };
    }

    /* ---- Exclude apps already in target stage ---- */
    where.status = where.status
      ? { [Op.and]: [where.status, { [Op.ne]: targetStage }] }
      : { [Op.ne]: targetStage };

    const affected = await Application.findAll({ where });

    if (affected.length === 0) {
      req.flash('error', 'No applications to move.');
      return res.redirect(req.body.returnTo || `/jobs/${job.id}/applications`);
    }

    await sequelize.transaction(async (t) => {
      for (const app of affected) {
        await logStatusChange({
          applicationId: app.id,
          fromStatus: app.status,
          toStatus: targetStage,
          changedByUserId: req.session.user.id,
          reason: reason || null,
          source: `bulk-${scope}`,
          transaction: t
        });

        app.status = targetStage;
        await app.save({ transaction: t });
      }
    });

    const back = req.body.returnTo || `/jobs/${job.id}/applications`;
    req.flash(
      'success',
      `Moved ${affected.length} application${affected.length === 1 ? '' : 's'}.`
    );
    res.redirect(back);
  } catch (err) {
    console.error('[BULK STATUS]', err);
    req.flash('error', 'Error during bulk update.');
    res.redirect(`/jobs/${req.params.id}/applications`);
  }
});

module.exports = router;