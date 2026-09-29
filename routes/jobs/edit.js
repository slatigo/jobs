const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const { Job, Department } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { cleanOpts } = require('../../utils/sanitizeOptions');

/* ================================================================== */
/* GET /:id/edit — show edit form                                      */
/* ================================================================== */
router.get('/:id/edit', isAuthenticated, async (req, res) => {
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
      req.flash('error', 'You are not allowed to edit this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render('jobs/edit', {
      title: `Edit — ${job.title}`,
      job,
      departments,
      JOB_TYPES: Job.JOB_TYPES,
      CONTRACT_TERMS: Job.CONTRACT_TERMS
    });
  } catch (err) {
    console.error('[JOBS EDIT GET]', err);
    req.flash('error', 'Could not load edit form');
    res.redirect(`/jobs/${req.params.id}`);
  }
});

/* ================================================================== */
/* POST /:id/edit — save changes                                       */
/* ================================================================== */
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const isPoster = req.session.user.id === job.userId;
    const isAdmin = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      req.flash('error', 'You are not allowed to edit this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    const {
      jobRef, title, departmentId, location, type, contractTerms,
      grade, vacancies, description, deadline, contactEmail, contactPhone
    } = req.body;

    if (!title || !departmentId || !description || !deadline || !contactEmail) {
      req.flash('error', 'Please fill in all required fields.');
      return res.redirect(`/jobs/${job.id}/edit`);
    }

    const cleanDescription = sanitizeHtml(description, cleanOpts).trim();
    if (!cleanDescription || cleanDescription === '<p><br></p>') {
      req.flash('error', 'Job description cannot be empty.');
      return res.redirect(`/jobs/${job.id}/edit`);
    }

    const dept = await Department.findByPk(parseInt(departmentId, 10));
    if (!dept) {
      req.flash('error', 'Invalid department selected.');
      return res.redirect(`/jobs/${job.id}/edit`);
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      req.flash('error', 'Invalid deadline date.');
      return res.redirect(`/jobs/${job.id}/edit`);
    }

    job.jobRef = jobRef ? jobRef.trim() : null;
    job.title = title.trim();
    job.departmentId = dept.id;
    job.location = (location && location.trim()) || 'MUBS Main Campus, Nakawa';
    job.type = Job.JOB_TYPES.includes(type) ? type : 'Full-time';
    job.contractTerms = Job.CONTRACT_TERMS.includes(contractTerms) ? contractTerms : 'Permanent';
    job.grade = grade ? grade.trim() : null;
    job.vacancies = vacancies ? Math.max(parseInt(vacancies, 10) || 1, 1) : 1;
    job.description = cleanDescription;
    job.deadline = deadlineDate;
    job.contactEmail = contactEmail.trim();
    job.contactPhone = contactPhone ? contactPhone.trim() : null;

    await job.save();

    req.flash('success', 'Job updated successfully.');
    res.redirect(`/jobs/${job.id}`);
  } catch (err) {
    console.error('[JOBS EDIT POST]', err);
    req.flash('error', 'Error updating job: ' + err.message);
    res.redirect(`/jobs/${req.params.id}/edit`);
  }
});

module.exports = router;