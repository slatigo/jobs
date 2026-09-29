const express = require('express');
const router = express.Router({ mergeParams: true });
const { Op } = require('sequelize');
const { Job, Application, sequelize } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { logStatusChange } = require('../../utils/logStatusChange');

/* ================================================================== */
/* POST /bulk-reject — bulk reject applications                        */
/* MUST come before /:appId/status (same parent, different segment     */
/* count, so no actual conflict — but explicit is better)              */
/* ================================================================== */
router.post('/bulk-reject', isAuthenticated, async (req, res) => {
  try {
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

    const { scope, reason } = req.body;

    let where = { jobId: job.id };
    let label = '';

    const selectedIds = req.body.applicationIds;
    if (scope === 'selected' && Array.isArray(selectedIds) && selectedIds.length > 0) {
      const intIds = selectedIds.map((id) => parseInt(id, 10)).filter(Boolean);
      if (intIds.length === 0) {
        req.flash('error', 'No valid applications selected.');
        return res.redirect(`/jobs/${job.id}/applications`);
      }
      where.id = { [Op.in]: intIds };
      label = `selected (${intIds.length})`;
    } else {
      switch (scope) {
        case 'pending':         where.status = 'pending';                              label = 'pending'; break;
        case 'reviewed':        where.status = 'reviewed';                             label = 'reviewed'; break;
        case 'shortlisted':     where.status = 'shortlisted';                          label = 'shortlisted'; break;
        case 'non-shortlisted': where.status = { [Op.in]: ['pending', 'reviewed'] };   label = 'non-shortlisted'; break;
        default:
          req.flash('error', 'Invalid bulk action.');
          return res.redirect(`/jobs/${job.id}/applications`);
      }
    }

    const affected = await Application.findAll({ where });

    if (affected.length === 0) {
      req.flash('error', 'No applications to reject in that group.');
      return res.redirect(req.body.returnTo || `/jobs/${job.id}/applications`);
    }

    await sequelize.transaction(async (t) => {
      for (const app of affected) {
        const fromStatus = app.status;

        await logStatusChange({
          applicationId: app.id,
          fromStatus,
          toStatus: 'rejected',
          changedByUserId: req.session.user.id,
          reason: reason || null,
          source: `bulk-${label}`,
          transaction: t
        });

        app.status = 'rejected';
        await app.save({ transaction: t });
      }
    });

    const back = req.body.returnTo || `/jobs/${job.id}/applications`;
    req.flash('success', `Rejected ${affected.length} ${label} application${affected.length === 1 ? '' : 's'}.`);
    res.redirect(back);
  } catch (err) {
    console.error('[BULK REJECT]', err);
    req.flash('error', 'Error during bulk reject.');
    res.redirect(`/jobs/${req.params.id}/applications`);
  }
});

module.exports = router;