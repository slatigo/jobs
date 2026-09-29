const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Job, Department, Application } = require('../../models');

/* ================================================================== */
/* GET /jobs — list all jobs                                           */
/*   - Public sees: active jobs only (deadline not passed)             */
/*   - Admins can pass ?status=closed or ?status=all                   */
/*   - Filters: search, department, type, terms, location, status      */
/*   - Pagination: 9 per page                                          */
/*   - Attaches application count per job for admins                   */
/* ================================================================== */
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

    /* -------- Normalize status filter -------- */
    let requestedStatus = String(status).toLowerCase();
    if (!['active', 'closed', 'all'].includes(requestedStatus)) {
      requestedStatus = 'active';
    }
    // Non-admins are forced to 'active' regardless of what they pass
    if (!isAdmin && requestedStatus !== 'active') {
      requestedStatus = 'active';
    }

    /* -------- Pagination -------- */
    const limit = 9;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * limit;

    /* -------- Status condition -------- */
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
    // 'all' → no status filter

    /* -------- Search + facet filters -------- */
    const filterWhere = {};
    if (search) {
      filterWhere[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { jobRef: { [Op.like]: `%${search}%` } }
      ];
    }
    if (type && type !== 'All') filterWhere.type = type;
    if (terms && terms !== 'All') filterWhere.contractTerms = terms;
    if (location) filterWhere.location = { [Op.like]: `%${location}%` };

    /* -------- Combine everything with AND -------- */
    const where = { [Op.and]: [statusWhere, filterWhere] };

    /* -------- Department join -------- */
    const include = [{ model: Department, as: 'department', required: false }];
    if (department && department !== 'All') {
      include[0].where = { slug: department };
      include[0].required = true;
    }

    /* ============================================================== */
    /* 1. Fetch current page of jobs                                   */
    /* ============================================================== */
    const { rows: jobs, count: total } = await Job.findAndCountAll({
      where,
      include,
      order: [['featured', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    /* ============================================================== */
    /* 2. Fetch application counts for these jobs in one grouped query */
    /* ============================================================== */
    const jobIds = jobs.map((j) => j.id);
    const countMap = new Map();

    if (jobIds.length > 0) {
      const rows = await Application.findAll({
        attributes: [
          'jobId',
          [fn('COUNT', col('id')), 'n']
        ],
        where: { jobId: { [Op.in]: jobIds } },
        group: ['jobId'],
        raw: true
      });

      rows.forEach((r) => {
        // Coerce both key and value to numbers — Sequelize may return strings
        countMap.set(Number(r.jobId), parseInt(r.n, 10) || 0);
      });
    }

    /* ============================================================== */
    /* 3. Convert Sequelize instances to plain objects and attach      */
    /*    applicationCount. This is REQUIRED — otherwise toJSON()      */
    /*    strips the ad-hoc field and the view sees undefined.         */
    /* ============================================================== */
    const jobsPlain = jobs.map((j) => {
      const plain = j.get({ plain: true });
      plain.applicationCount = countMap.get(Number(j.id)) || 0;
      return plain;
    });

    /* ============================================================== */
    /* 4. Departments for the filter dropdown                          */
    /* ============================================================== */
    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    /* ============================================================== */
    /* 5. Render                                                       */
    /* ============================================================== */
    res.render('jobs/list', {
      title: 'Browse Jobs',
      jobs: jobsPlain,
      total,
      currentPage,
      totalPages: Math.ceil(total / limit) || 1,
      departments,
      filters: {
        search,
        department,
        type,
        terms,
        location,
        status: requestedStatus
      },
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