const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Job, Department, Application } = require('../../models');

router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      department = 'All',
      type = 'All',
      terms = 'All',
      location = '',
      status = 'active',
      page = 1
    } = req.query;

    const isAdmin = req.session.user && req.session.user.role === 'admin';

    /* ---- Status filter ---- */
    let requestedStatus = String(status).toLowerCase();
    if (!['active', 'closed', 'all'].includes(requestedStatus)) {
      requestedStatus = 'active';
    }
    if (!isAdmin && requestedStatus !== 'active') {
      requestedStatus = 'active';
    }

    const limit = 9;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * limit;

    /* ---- Status condition ---- */
    const statusWhere = {};
    if (requestedStatus === 'active') {
      statusWhere.status = 'active';
      statusWhere.deadline = { [Op.gt]: new Date() };
    } else if (requestedStatus === 'closed') {
      statusWhere[Op.or] = [
        { status: 'closed' },
        { deadline: { [Op.lte]: new Date() } }
      ];
    }

    /* ---- Filters (including title-only search) ---- */
    const filterWhere = {};
    if (search && search.trim()) {
      filterWhere.title = { [Op.like]: `%${search.trim()}%` };
    }
    if (type && type !== 'All') filterWhere.type = type;
    if (terms && terms !== 'All') filterWhere.contractTerms = terms;
    if (location) filterWhere.location = { [Op.like]: `%${location}%` };

    const where = { [Op.and]: [statusWhere, filterWhere] };

    /* ---- Department join ---- */
    const include = [{ model: Department, as: 'department', required: false }];
    if (department && department !== 'All') {
      include[0].where = { slug: department };
      include[0].required = true;
    }

    /* ---- 1. Fetch the page of jobs ---- */
    const { rows: jobs, count: total } = await Job.findAndCountAll({
      where,
      include,
      order: [['featured', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    /* ---- 2. Application counts ---- */
    const jobIds = jobs.map((j) => j.id);
    const countMap = new Map();

    if (jobIds.length > 0) {
      const rows = await Application.findAll({
        attributes: ['jobId', [fn('COUNT', col('id')), 'n']],
        where: { jobId: { [Op.in]: jobIds } },
        group: ['jobId'],
        raw: true
      });
      rows.forEach((r) => {
        countMap.set(Number(r.jobId), parseInt(r.n, 10) || 0);
      });
    }

    const jobsPlain = jobs.map((j) => {
      const plain = j.get({ plain: true });
      plain.applicationCount = countMap.get(Number(j.id)) || 0;
      return plain;
    });

    /* ---- 3. Departments for the admin filter dropdown ---- */
    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render('jobs/list', {
      title: 'Browse Jobs',
      jobs: jobsPlain,
      total,
      currentPage,
      totalPages: Math.ceil(total / limit) || 1,
      departments,
      filters: { search, department, type, terms, location, status: requestedStatus },
      JOB_TYPES: Job.JOB_TYPES,
      CONTRACT_TERMS: Job.CONTRACT_TERMS,
      isAdmin
    });
  } catch (err) {
    console.error('[JOBS LIST]', err);
    req.flash('error', 'Error loading jobs');
    res.redirect('/');
  }
});

module.exports = router;