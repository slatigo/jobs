const express = require('express');
const router = express.Router();
const { literal } = require('sequelize');
const { Department, Job } = require('../models');

/* LIST — grouped by type */
router.get('/', async (req, res) => {
  try {
    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      attributes: {
        include: [
          [
            literal(`(
              SELECT COUNT(*)
              FROM jobs
              WHERE jobs.department_id = Department.id
                AND jobs.status = 'active'
            )`),
            'jobCount'
          ]
        ]
      }
    });

    const groups = {};
    departments.forEach((d) => {
      const t = d.type || 'Other';
      if (!groups[t]) groups[t] = [];
      groups[t].push({
        id: d.id,
        name: d.name,
        slug: d.slug,
        shortName: d.shortName,
        description: d.description,
        jobCount: parseInt(d.get('jobCount'), 10) || 0
      });
    });

    res.render('departments/index', { title: 'Departments', groups });
  } catch (err) {
    console.error('[DEPARTMENTS LIST]', err);
    req.flash('error', 'Could not load departments');
    res.redirect('/');
  }
});

/* DETAIL — /departments/:slug */
router.get('/:slug', async (req, res) => {
  try {
    const department = await Department.findOne({
      where: { slug: req.params.slug, active: true }
    });

    if (!department) {
      req.flash('error', 'Department not found');
      return res.redirect('/departments');
    }

    const jobs = await Job.findAll({
      where: { departmentId: department.id, status: 'active' },
      include: [{ model: Department, as: 'department' }],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']]
    });

    res.render('departments/detail', {
      title: department.name,
      department,
      jobs
    });
  } catch (err) {
    console.error('[DEPARTMENTS DETAIL]', err);
    req.flash('error', 'Could not load department');
    res.redirect('/departments');
  }
});

module.exports = router;