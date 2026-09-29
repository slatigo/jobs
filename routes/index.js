const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Job, Department, Application } = require('../models');

/* ================================================================== */
/* HOME — GET /                                                        */
/* ================================================================== */
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const isAdmin = req.session.user && req.session.user.role === 'admin';

    /* -------- Active jobs (deadline not passed) -------- */
    const activeFilter = {
      status: 'active',
      deadline: { [Op.gt]: now }
    };

    const featured = await Job.findAll({
      where: { ...activeFilter, featured: true },
      include: [{ model: Department, as: 'department' }],
      order: [['createdAt', 'DESC']],
      limit: 6
    });

    const recent = await Job.findAll({
      where: activeFilter,
      include: [{ model: Department, as: 'department' }],
      order: [['createdAt', 'DESC']],
      limit: 6
    });

    /* -------- Stats -------- */
    const totalJobs = await Job.count({ where: activeFilter });

    const typeRows = await Job.findAll({
      attributes: ['type'],
      where: activeFilter,
      group: ['type'],
      raw: true
    });
    const types = typeRows.length;

    const closingSoon = await Job.count({
      where: {
        ...activeFilter,
        deadline: { [Op.gt]: now, [Op.lte]: in7Days }
      }
    });

    /* -------- Application counts for admins only -------- */
    let countMap = new Map();

    if (isAdmin) {
      const allIds = [...new Set([
        ...featured.map((j) => j.id),
        ...recent.map((j) => j.id)
      ])];

      if (allIds.length > 0) {
        const rows = await Application.findAll({
          attributes: ['jobId', [fn('COUNT', col('id')), 'n']],
          where: { jobId: { [Op.in]: allIds } },
          group: ['jobId'],
          raw: true
        });
        rows.forEach((r) => {
          countMap.set(Number(r.jobId), parseInt(r.n, 10) || 0);
        });
      }
    }

    /* -------- Convert to plain objects, attach count -------- */
    const decorate = (job) => {
      const plain = job.get({ plain: true });
      if (isAdmin) plain.applicationCount = countMap.get(Number(job.id)) || 0;
      return plain;
    };

    res.render('index', {
      title: 'MUBS Job Portal',
      featured: featured.map(decorate),
      recent: recent.map(decorate),
      stats: { totalJobs, types, closingSoon },
      isAdmin
    });
  } catch (err) {
    console.error('[HOME]', err);
    res.render('index', {
      title: 'MUBS Job Portal',
      featured: [],
      recent: [],
      stats: { totalJobs: 0, types: 0, closingSoon: 0 },
      isAdmin: false
    });
  }
});

module.exports = router;