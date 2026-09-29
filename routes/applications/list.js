const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  Job,
  Application,
  ApplicationStatusHistory,
  User,
  Department
} = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');

/* ================================================================== */
/* GET / — list applications for a job                                 */
/* ================================================================== */
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
    const isAdmin = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      req.flash('error', 'You are not allowed to view applications for this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    const statusFilter = (req.query.status || 'all').toLowerCase();
    const allowedFilters = ['all', 'pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'];
    const activeFilter = allowedFilters.includes(statusFilter) ? statusFilter : 'all';

    const where = { jobId: job.id };
    if (activeFilter !== 'all') where.status = activeFilter;

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

    const counts = {
      all: allApplications.length,
      pending: 0,
      reviewed: 0,
      shortlisted: 0,
      rejected: 0,
      accepted: 0
    };
    allApplications.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status]++;
    });

    res.render('jobs/applications', {
      title: `Applications — ${job.title}`,
      job,
      applications,
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