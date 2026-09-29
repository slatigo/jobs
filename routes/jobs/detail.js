const express = require('express');
const router = express.Router();
const { Job, Application, User, Department } = require('../../models');
const { isClosed, closedReason } = require('../../utils/jobStatus');

/* ================================================================== */
/* GET /:id — job detail                                               */
/* Closed jobs visible only to poster/admin                            */
/* ================================================================== */
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [
        { model: Department, as: 'department' },
        { model: User, as: 'postedBy', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const isAdmin = req.session.user && req.session.user.role === 'admin';
    const isPoster = req.session.user && req.session.user.id === job.userId;
    const canManage = isPoster || isAdmin;
    const jobIsClosed = isClosed(job);

    if (jobIsClosed && !canManage) {
      req.flash('error', 'This job is no longer available.');
      return res.redirect('/jobs');
    }

    if (!canManage) {
      await job.increment('views');
      job.views += 1;
    }

    const applicationCount = await Application.count({ where: { jobId: job.id } });

    const alreadyApplied = req.session.user
      ? !!(await Application.findOne({
          where: { jobId: job.id, userId: req.session.user.id }
        }))
      : false;

    res.render('jobs/detail', {
      title: job.title,
      job,
      alreadyApplied,
      canManage,
      isAdmin,
      applicationCount,
      jobIsClosed,
      jobClosedReason: closedReason(job)
    });
  } catch (err) {
    console.error('[JOBS DETAIL]', err);
    req.flash('error', 'Error loading job');
    res.redirect('/jobs');
  }
});

module.exports = router;