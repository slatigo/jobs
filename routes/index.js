const express = require('express');
const router = express.Router();
const { Job, Department } = require('../models');

router.get('/', async (req, res) => {
  try {
    const featured = await Job.findAll({
      where: { featured: true, status: 'active' },
      include: [{ model: Department, as: 'department' }],
      order: [['createdAt', 'DESC']],
      limit: 6
    });

    const recent = await Job.findAll({
      where: { status: 'active' },
      include: [{ model: Department, as: 'department' }],
      order: [['createdAt', 'DESC']],
      limit: 6
    });

    const faculties = await Department.findAll({
      where: { active: true, type: 'Faculty' },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      limit: 8
    });

    const totalJobs = await Job.count({ where: { status: 'active' } });
    const departments = await Department.count({ where: { active: true } });
    const distinctTypes = await Job.findAll({
      attributes: ['type'],
      where: { status: 'active' },
      group: ['type'],
      raw: true
    });

    res.render('index', {
      title: 'MUBS Job Portal',
      featured,
      recent,
      faculties,
      stats: { totalJobs, departments, types: distinctTypes.length }
    });
  } catch (err) {
    console.error('[HOME]', err);
    res.render('index', {
      title: 'MUBS Job Portal',
      featured: [],
      recent: [],
      faculties: [],
      stats: { totalJobs: 0, departments: 0, types: 0 }
    });
  }
});

module.exports = router;