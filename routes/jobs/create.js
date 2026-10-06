const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const { Job, Department, JobStage, sequelize } = require('../../models');
const { isEmployer } = require('../../middleware/auth');
const { cleanOpts } = require('../../utils/sanitizeOptions');
const { fromInput } = require('../../utils/appTime');

/* ================================================================== */
/* GET /jobs/new — render the create form                              */
/* ================================================================== */
router.get('/new', isEmployer, async (req, res) => {
  try {
    const departments = await Department.findAll({
      where: { active: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    const form = {
      jobRef:        req.flash('formJobRef')[0]        || '',
      refCategory:   req.flash('formRefCategory')[0]   || 'GEN',
      title:         req.flash('formTitle')[0]         || '',
      departmentId:  req.flash('formDepartmentId')[0]  || '',
      grade:         req.flash('formGrade')[0]         || '',
      type:          req.flash('formType')[0]          || 'Full-time',
      contractTerms: req.flash('formContractTerms')[0] || 'Permanent',
      vacancies:     req.flash('formVacancies')[0]     || 1,
      location:      req.flash('formLocation')[0]      || 'MUBS Main Campus, Nakawa',
      visibility:    req.flash('formVisibility')[0]    || 'public',
      deadline:      req.flash('formDeadline')[0]      || '',
      contactEmail:  req.flash('formContactEmail')[0]  || (req.session.user && req.session.user.email) || '',
      contactPhone:  req.flash('formContactPhone')[0]  || (req.session.user && req.session.user.phone) || '',
      description:   req.flash('formDescription')[0]   || '',
      stages:        req.flash('formStages')[0]        || '[]'
    };

    res.render('jobs/job-form', {
      title: 'Post a Job',
      departments,
      JOB_TYPES: Job.JOB_TYPES,
      CONTRACT_TERMS: Job.CONTRACT_TERMS,
      REF_CATEGORIES: Job.REF_CATEGORIES,
      VISIBILITY: Job.VISIBILITY,
      form
      // `job` is intentionally NOT passed — the template's isEdit check sees undefined
    });
  } catch (err) {
    console.error('[JOBS NEW]', err);
    req.flash('error', 'Could not load form');
    res.redirect('/jobs');
  }
});

/* ================================================================== */
/* POST /jobs — create a job                                           */
/* ================================================================== */
router.post('/', isEmployer, async (req, res) => {
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

    // Stash the submitted values so the form can repopulate
    req.flash('formJobRef',        req.body.jobRef        || '');
    req.flash('formRefCategory',   req.body.refCategory   || 'GEN');
    req.flash('formTitle',         req.body.title         || '');
    req.flash('formDepartmentId',  req.body.departmentId  || '');
    req.flash('formGrade',         req.body.grade         || '');
    req.flash('formType',          req.body.type          || 'Full-time');
    req.flash('formContractTerms', req.body.contractTerms || 'Permanent');
    req.flash('formVacancies',     req.body.vacancies     || 1);
    req.flash('formLocation',      req.body.location      || '');
    req.flash('formVisibility',    req.body.visibility    || 'public');
    req.flash('formDeadline',      req.body.deadline      || '');
    req.flash('formContactEmail',  req.body.contactEmail  || '');
    req.flash('formContactPhone',  req.body.contactPhone  || '');
    req.flash('formDescription',   req.body.description   || '');
    req.flash('formStages',        req.body.stages        || '[]');

    return res.redirect('/jobs/new');
  };

  try {
    const {
      jobRef, refCategory, title, departmentId, location, type,
      contractTerms, grade, vacancies, description, deadline,
      contactEmail, contactPhone, visibility, stages: stagesRaw
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

    /* ---- Parse deadline as Kampala time + reject past dates ---- */
    let parsedDeadline = null;
    if (deadline) {
      parsedDeadline = fromInput(deadline);
      if (!parsedDeadline) {
        errors.deadline = 'Invalid date or time.';
      } else if (parsedDeadline <= new Date()) {
        errors.deadline = 'Deadline must be in the future.';
      }
    }

    if (Object.keys(errors).length > 0) {
      return bad(errors, 'Please fix the highlighted fields.');
    }

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

    /* ---- Parse stages ---- */
    let stagesInput = [];
    try {
      const parsed = JSON.parse(stagesRaw || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) stagesInput = parsed;
    } catch { /* ignore */ }
    if (stagesInput.length === 0) stagesInput = Job.DEFAULT_STAGES;

    /* ---- Save inside a transaction ---- */
    const t = await sequelize.transaction();
    try {
      const job = await Job.create({
        jobRef: jobRef && jobRef.trim() ? jobRef.trim() : null,
        refCategory: validRefCategory,
        title: title.trim(),
        departmentId: dept.id,
        location: (location && location.trim()) || 'MUBS Main Campus, Nakawa',
        type: validType,
        contractTerms: validTerms,
        grade: grade ? grade.trim() : null,
        vacancies: vacancies ? Math.max(parseInt(vacancies, 10) || 1, 1) : 1,
        description: cleanDescription,
        deadline: parsedDeadline,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone ? contactPhone.trim() : null,
        visibility: validVisibility,
        userId: req.session.user.id
      }, { transaction: t });

      await JobStage.bulkCreate(
        stagesInput.map((s, i) => ({
          jobId: job.id,
          key: s.key,
          label: s.label,
          color: s.color || 'primary',
          order: i,
          isTerminal: ['accepted', 'rejected'].includes(s.key)
        })),
        { transaction: t }
      );

      await t.commit();

      return ok({
        message: 'Position posted successfully.',
        redirect: `/jobs/${job.id}`,
        job: { id: job.id, title: job.title, jobRef: job.jobRef }
      });
    } catch (err) {
      await t.rollback();
      console.error('[JOBS CREATE]', err);

      let msg = 'Error creating job.';
      if (err.name === 'SequelizeUniqueConstraintError') {
        msg = 'A conflict occurred. Please try again.';
      } else if (err.name === 'SequelizeValidationError') {
        msg = 'Please check the information you entered.';
      } else {
        msg += ' ' + err.message;
      }

      return bad({ _global: msg }, msg);
    }
  } catch (err) {
    console.error('[JOBS NEW POST]', err);
    return bad({ _global: 'Server error. Please try again.' }, 'Server error.');
  }
});

module.exports = router;