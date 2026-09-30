const express = require('express');
const router = express.Router({ mergeParams: true });
const { Op } = require('sequelize');
const { Job, JobStage, Application, sequelize } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');

/* ------------------------------------------------------------------ */
/* Access helper                                                       */
/* ------------------------------------------------------------------ */
async function loadJobOrRedirect(req, res) {
  const job = await Job.findByPk(req.params.id);
  if (!job) {
    req.flash('error', 'Job not found');
    res.redirect('/jobs');
    return null;
  }

  const isPoster = req.session.user.id === job.userId;
  const isAdmin = req.session.user.role === 'admin';
  if (!isPoster && !isAdmin) {
    req.flash('error', 'You are not allowed to manage this job.');
    res.redirect(`/jobs/${job.id}`);
    return null;
  }

  return job;
}

/* ================================================================== */
/* GET /jobs/:id/stages — view + edit form                            */
/* ================================================================== */
router.get('/', isAuthenticated, async (req, res) => {
  const job = await loadJobOrRedirect(req, res);
  if (!job) return;

  const stages = await JobStage.findAll({
    where: { jobId: job.id },
    order: [['order', 'ASC']]
  });

  /* Which stages currently hold applications? */
  const counts = await Application.findAll({
    where: { jobId: job.id },
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    group: ['status'],
    raw: true
  });
  const countMap = new Map(counts.map((c) => [c.status, parseInt(c.n, 10)]));

  res.render('jobs/stages', {
    title: `Manage Stages — ${job.title}`,
    job,
    stages: stages.length > 0
      ? stages.map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
          color: s.color,
          order: s.order,
          isTerminal: s.isTerminal
        }))
      : Job.DEFAULT_STAGES.map((s, i) => ({ ...s, id: null, order: i })),
    countMap: Object.fromEntries(countMap),
    DEFAULT_STAGES: Job.DEFAULT_STAGES
  });
});

/* ================================================================== */
/* POST /jobs/:id/stages — save the whole list                        */
/* ================================================================== */
router.post('/', isAuthenticated, async (req, res) => {
  const job = await loadJobOrRedirect(req, res);
  if (!job) return;

  const { stages: stagesRaw, deletedHandling } = req.body;

  /* Parse the incoming stages */
  let incoming = [];
  try {
    const parsed = JSON.parse(stagesRaw || '[]');
    if (Array.isArray(parsed)) incoming = parsed;
  } catch (err) {
    req.flash('error', 'Invalid stages payload.');
    return res.redirect(`/jobs/${job.id}/stages`);
  }

  if (incoming.length === 0) {
    req.flash('error', 'You must keep at least one stage.');
    return res.redirect(`/jobs/${job.id}/stages`);
  }

  /* The current DB state */
  const existing = await JobStage.findAll({ where: { jobId: job.id } });
  const existingById = new Map(existing.map((s) => [s.id, s]));
  const existingByKey = new Map(existing.map((s) => [s.key, s]));

  /* Incoming IDs (stages the client kept) */
  const incomingIds = new Set(
    incoming.filter((s) => s.id).map((s) => parseInt(s.id, 10))
  );

  /* Any stage row in the DB that's NOT in the incoming list gets deleted */
  const toDelete = existing.filter((s) => !incomingIds.has(s.id));

  /* Check if any stage being deleted still holds applications */
  for (const del of toDelete) {
    const usedCount = await Application.count({
      where: { jobId: job.id, status: del.key }
    });

    if (usedCount > 0) {
      /* Force the client to decide what to do */
      if (!deletedHandling || !deletedHandling.stageKey) {
        req.flash(
          'error',
          `Stage "${del.label}" has ${usedCount} application(s). ` +
          `Choose where to move them before deleting this stage.`
        );
        return res.redirect(`/jobs/${job.id}/stages`);
      }

      /* Move applications to the chosen fallback stage */
      const { stageKey: fallbackKey } = deletedHandling;
      const fallback = existingByKey.get(fallbackKey)
        || incoming.find((s) => s.key === fallbackKey);

      if (!fallback) {
        req.flash('error', 'Fallback stage not found.');
        return res.redirect(`/jobs/${job.id}/stages`);
      }

      await Application.update(
        { status: fallbackKey },
        { where: { jobId: job.id, status: del.key } }
      );

      /* Log the move in the audit trail */
      const movedApps = await Application.findAll({
        where: { jobId: job.id, status: fallbackKey },
        attributes: ['id']
      });
      // (Optional: iterate and call logStatusChange for each)
    }
  }

  /* Now save inside a transaction */
  const t = await sequelize.transaction();
  try {
    /* Delete removed stages */
    if (toDelete.length > 0) {
      await JobStage.destroy({
        where: { id: toDelete.map((s) => s.id) },
        transaction: t
      });
    }

    /* Upsert incoming stages in order */
    for (let i = 0; i < incoming.length; i++) {
      const s = incoming[i];
      const payload = {
        jobId: job.id,
        key: s.key,
        label: s.label.trim(),
        color: s.color || 'primary',
        order: i,
        isTerminal: s.isTerminal === true || s.isTerminal === 'true'
      };

      if (s.id && existingById.has(parseInt(s.id, 10))) {
        await JobStage.update(payload, {
          where: { id: parseInt(s.id, 10) },
          transaction: t
        });
      } else {
        await JobStage.create(payload, { transaction: t });
      }
    }

    await t.commit();
    req.flash('success', 'Stages saved.');
    res.redirect(`/jobs/${job.id}/stages`);
  } catch (err) {
    await t.rollback();
    console.error('[JOBS STAGES SAVE]', err);
    req.flash('error', 'Error saving stages: ' + err.message);
    res.redirect(`/jobs/${job.id}/stages`);
  }
});

module.exports = router;