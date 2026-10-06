const express = require('express');
const router = express.Router();
const { Application, Job, Department, JobStage } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const applications = await Application.findAll({
      where: { userId: req.session.user.id },
      include: [
        {
          model: Job,
          as: 'job',
          include: [{ model: Department, as: 'department' }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    /* For each application, resolve the current stage's label/color */
    const jobIds = [...new Set(applications.map((a) => a.jobId))];
    const stagesByJob = new Map();

    if (jobIds.length > 0) {
      const allStages = await JobStage.findAll({
        where: { jobId: jobIds },
        order: [['order', 'ASC']]
      });
      allStages.forEach((s) => {
        if (!stagesByJob.has(s.jobId)) stagesByJob.set(s.jobId, []);
        stagesByJob.get(s.jobId).push(s);
      });
    }

    const rows = applications.map((a) => {
      const plain = a.get({ plain: true });
      const jobStages = stagesByJob.get(a.jobId);
      const stages = jobStages && jobStages.length ? jobStages : Job.DEFAULT_STAGES;
      const stageDef = stages.find((s) => s.key === a.status);
      plain.stageLabel = stageDef ? stageDef.label : a.status;
      plain.stageColor = stageDef ? stageDef.color : 'muted';
      return plain;
    });

    res.render('jobs/my-applications', {
      title: 'My Applications',
      applications: rows
    });
  } catch (err) {
    console.error('[MY APPLICATIONS]', err);
    req.flash('error', 'Could not load your applications.');
    res.redirect('/');
  }
});

module.exports = router;