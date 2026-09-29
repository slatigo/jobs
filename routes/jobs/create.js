const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const { Job, Department } = require('../../models');
const { isEmployer } = require('../../middleware/auth');
const { cleanOpts } = require('../../utils/sanitizeOptions');

/* ================================================================== */
/* GET /new — show create form                                         */
/* ================================================================== */
router.get('/new', isEmployer, async (req, res) => {
  try {
    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render('jobs/create', {
      title: 'Post a Job',
      departments,
      JOB_TYPES: Job.JOB_TYPES,
      CONTRACT_TERMS: Job.CONTRACT_TERMS
    });
  } catch (err) {
    console.error('[JOBS NEW]', err);
    req.flash('error', 'Could not load form');
    res.redirect('/jobs');
  }
});

/* ================================================================== */
/* POST / — create job                                                 */
/* ================================================================== */
router.post('/', isEmployer, async (req, res) => {
  try {
    const {
      jobRef, title, departmentId, location, type, contractTerms,
      grade, vacancies, description, deadline, contactEmail, contactPhone
    } = req.body;

    if (!title || !departmentId || !description || !deadline || !contactEmail) {
      req.flash('error', 'Please fill in all required fields.');
      return res.redirect('/jobs/new');
    }

    const cleanDescription = sanitizeHtml(description, cleanOpts).trim();
    if (!cleanDescription || cleanDescription === '<p><br></p>') {
      req.flash('error', 'Job description cannot be empty.');
      return res.redirect('/jobs/new');
    }

    const dept = await Department.findByPk(parseInt(departmentId, 10));
    if (!dept) {
      req.flash('error', 'Invalid department selected.');
      return res.redirect('/jobs/new');
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      req.flash('error', 'Deadline must be a valid future date.');
      return res.redirect('/jobs/new');
    }

    const job = await Job.create({
      jobRef: jobRef ? jobRef.trim() : null,
      title: title.trim(),
      departmentId: dept.id,
      location: (location && location.trim()) || 'MUBS Main Campus, Nakawa',
      type: Job.JOB_TYPES.includes(type) ? type : 'Full-time',
      contractTerms: Job.CONTRACT_TERMS.includes(contractTerms) ? contractTerms : 'Permanent',
      grade: grade ? grade.trim() : null,
      vacancies: vacancies ? Math.max(parseInt(vacancies, 10) || 1, 1) : 1,
      description: cleanDescription,
      deadline: deadlineDate,
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone ? contactPhone.trim() : null,
      userId: req.session.user.id
    });

    req.flash('success', 'Position posted successfully!');
    res.redirect(`/jobs/${job.id}`);
  } catch (err) {
    console.error('[JOBS CREATE]', err);
    req.flash('error', 'Error creating job: ' + err.message);
    res.redirect('/jobs/new');
  }
});

module.exports = router;