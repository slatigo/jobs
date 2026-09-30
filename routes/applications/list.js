const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  Job,
  Application,
  ApplicationStatusHistory,
  JobStage,
  User,
  Department
} = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [{ model: Department, as: 'department' }]
    });

    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const isPoster = req.session.user.id === job.userId;
    const isAdmin  = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      req.flash('error', 'You are not allowed to view applications for this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    /* ---- Load the job's stages, fall back to defaults ---- */
    const stageRows = await JobStage.findAll({
      where: { jobId: job.id },
      order: [['order', 'ASC']]
    });

    const stages = stageRows.length > 0
      ? stageRows.map((s) => ({
          key: s.key,
          label: s.label,
          color: s.color,
          order: s.order,
          isTerminal: s.isTerminal
        }))
      : Job.DEFAULT_STAGES;

    /* ---- Filter ---- */
    const statusFilter = (req.query.status || 'all').toLowerCase();
    const validKeys = ['all', ...stages.map((s) => s.key)];
    const activeFilter = validKeys.includes(statusFilter) ? statusFilter : 'all';

    const where = { jobId: job.id };
    if (activeFilter !== 'all') where.status = activeFilter;

    /* ---- Fetch apps + counts ---- */
    const [applications, allApplications] = await Promise.all([
      Application.findAll({
        where,
        include: [
          { model: User, as: 'applicant', attributes: ['id', 'name', 'email'] },
          {
            model: ApplicationStatusHistory,
            as: 'history',
            include: [{ model: User, as: 'changedBy', attributes: ['id', 'name', 'role'] }],
            separate: true,
            order: [['createdAt', 'DESC']]
          }
        ],
        order: [['createdAt', 'DESC']]
      }),
      Application.findAll({
        where: { jobId: job.id },
        attributes: ['status']
      })
    ]);

    /* ---- Dynamic counts ---- */
    const counts = { all: allApplications.length };
    stages.forEach((s) => { counts[s.key] = 0; });

    allApplications.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status]++;
      else counts[a.status] = (counts[a.status] || 0) + 1;
    });

    res.render('jobs/applications', {
      title: `Applications — ${job.title}`,
      job,
      applications,
      stages,
      counts,
      activeFilter,
      isAdmin
    });
  } catch (err) {
    console.error('[APPLICATIONS LIST]', err);
    if (res.headersSent) return;
    req.flash('error', 'Error loading applications');
    res.redirect(`/jobs/${req.params.id}`);
  }
});

module.exports = router;