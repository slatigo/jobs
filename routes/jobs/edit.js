const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const { Job, Department } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { cleanOpts } = require('../../utils/sanitizeOptions');

/* ================================================================== */
/* GET /jobs/:id/edit — render the edit form                           */
/* ================================================================== */
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/jobs');
    }

    const isPoster = req.session.user.id === job.userId;
    const isAdmin  = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      req.flash('error', 'You are not allowed to edit this job.');
      return res.redirect(`/jobs/${job.id}`);
    }

    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render('jobs/job-form', {
      title: `Edit — ${job.title}`,
      job,                    // ← presence of `job` flips the template to edit mode
      departments,
      JOB_TYPES: Job.JOB_TYPES,
      CONTRACT_TERMS: Job.CONTRACT_TERMS,
      REF_CATEGORIES: Job.REF_CATEGORIES,
      VISIBILITY: Job.VISIBILITY,
      form: {}                // unused in edit mode, but harmless
    });
  } catch (err) {
    console.error('[JOBS EDIT GET]', err);
    req.flash('error', 'Could not load edit form');
    res.redirect(`/jobs/${req.params.id}`);
  }
});

/* ================================================================== */
/* POST /jobs/:id/edit — save changes                                  */
/* ================================================================== */
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  const wantsJson = req.is('application/json') || req.xhr ||
                    (req.headers.accept || '').includes('application/json');

  const ok = (payload) => {
    if (wantsJson) return res.json({ ok: true, ...payload });
    req.flash('success', payload.message || 'Saved.');
    return res.redirect(payload.redirect);
  };

  const bad = (errors, message) => {
    if (wantsJson) return res.status(422).json({ ok: false, errors, message });
    req.flash('error', message || 'Please fix the errors and try again.');
    return res.redirect(`/jobs/${req.params.id}/edit`);
  };

  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return bad({ _global: 'Job not found.' });

    const isPoster = req.session.user.id === job.userId;
    const isAdmin  = req.session.user.role === 'admin';

    if (!isPoster && !isAdmin) {
      return bad({ _global: 'You are not allowed to edit this job.' });
    }

    const {
      jobRef, refCategory, title, departmentId, location, type,
      contractTerms, grade, vacancies, description, deadline,
      contactEmail, contactPhone, visibility
    } = req.body;

    /* ---- Collect all validation errors ---- */
    const errors = {};

    if (!title || !title.trim())               errors.title          = 'Title is required.';
    if (!departmentId)                         errors.departmentId   = 'Department is required.';
    if (!description || description === '<p><br></p>')
                                               errors.description    = 'Description is required.';
    if (!deadline)                             errors.deadline       = 'Deadline is required.';
    if (!contactEmail || !contactEmail.trim()) errors.contactEmail   = 'Contact email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
                                               errors.contactEmail   = 'Enter a valid email address.';

    if (deadline) {
      const d = new Date(deadline);
      if (isNaN(d.getTime())) errors.deadline = 'Invalid date.';
    }

    if (Object.keys(errors).length > 0) return bad(errors, 'Please fix the highlighted fields.');

    /* ---- Sanitize description ---- */
    const cleanDescription = sanitizeHtml(description, cleanOpts).trim();
    if (!cleanDescription || cleanDescription === '<p><br></p>') {
      return bad({ description: 'Description cannot be empty.' });
    }

    /* ---- Verify department ---- */
    const dept = await Department.findByPk(parseInt(departmentId, 10));
    if (!dept) return bad({ departmentId: 'Invalid department.' });

    /* ---- Normalise enums ---- */
    const validRefCategory = Job.REF_CATEGORIES.some((c) => c.code === refCategory)
      ? refCategory : 'GEN';
    const validVisibility = Job.VISIBILITY.includes(visibility) ? visibility : 'public';
    const validType = Job.JOB_TYPES.includes(type) ? type : 'Full-time';
    const validTerms = Job.CONTRACT_TERMS.includes(contractTerms) ? contractTerms : 'Permanent';

    /* ---- Update ---- */
    job.jobRef        = jobRef && jobRef.trim() ? jobRef.trim() : null;
    job.refCategory   = validRefCategory;
    job.title         = title.trim();
    job.departmentId  = dept.id;
    job.location      = (location && location.trim()) || 'MUBS Main Campus, Nakawa';
    job.type          = validType;
    job.contractTerms = validTerms;
    job.grade         = grade ? grade.trim() : null;
    job.vacancies     = vacancies ? Math.max(parseInt(vacancies, 10) || 1, 1) : 1;
    job.description   = cleanDescription;
    job.deadline      = new Date(deadline);
    job.contactEmail  = contactEmail.trim();
    job.contactPhone  = contactPhone ? contactPhone.trim() : null;
    job.visibility    = validVisibility;

    await job.save();

    return ok({
      message: 'Job updated successfully.',
      redirect: `/jobs/${job.id}`
    });
  } catch (err) {
    console.error('[JOBS EDIT POST]', err);

    let msg = 'Error updating job.';
    if (err.name === 'SequelizeValidationError') msg = 'Please check the information you entered.';
    else msg += ' ' + err.message;

    return bad({ _global: msg }, msg);
  }
});

module.exports = router;