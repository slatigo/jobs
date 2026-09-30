const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Job, Application, User, Department, sequelize } = require('../models');
const { isAdmin } = require('../middleware/auth');

/* ================================================================== */
/* DASHBOARD — /admin                                                  */
/* ================================================================== */
router.get('/', isAdmin, async (req, res) => {
  try {
    const [
      users,
      jobs,
      applications,
      departments,
      activeJobs,
      closedJobs,
      recentJobs,
      recentApplications
    ] = await Promise.all([
      User.count(),
      Job.count(),
      Application.count(),
      Department.count({ where: { active: true } }),
      Job.count({ where: { status: 'active' } }),
      Job.count({ where: { status: 'closed' } }),
      Job.findAll({
        include: [{ model: Department, as: 'department' }],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),
      Application.findAll({
        include: [
          { model: Job, as: 'job', attributes: ['id', 'title'] },
          { model: User, as: 'applicant', attributes: ['id', 'name', 'email'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: 5
      })
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        users,
        jobs,
        applications,
        departments,
        activeJobs,
        closedJobs
      },
      recentJobs,
      recentApplications
    });
  } catch (err) {
    console.error('[ADMIN DASHBOARD]', err);
    req.flash('error', 'Error loading dashboard');
    res.redirect('/');
  }
});

/* ================================================================== */
/* JOBS — /admin/jobs                                                  */
/* ================================================================== */
router.get('/jobs', isAdmin, async (req, res) => {
  try {
    const { search = '', status = 'All', page = 1 } = req.query;
    const limit = 20;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * limit;

    const where = {};
    if (status !== 'All') where.status = status;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { jobRef: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: jobs, count: total } = await Job.findAndCountAll({
      where,
      include: [{ model: Department, as: 'department' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    res.render('admin/jobs', {
      title: 'Manage Jobs',
      jobs,
      total,
      currentPage,
      totalPages: Math.ceil(total / limit) || 1,
      filters: { search, status }
    });
  } catch (err) {
    console.error('[ADMIN JOBS]', err);
    req.flash('error', 'Error loading jobs');
    res.redirect('/admin');
  }
});

/* Toggle job status (active ↔ closed) */
router.post('/jobs/:id/toggle', isAdmin, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/admin/jobs');
    }

    job.status = job.status === 'active' ? 'closed' : 'active';
    await job.save();

    req.flash('success', `Job ${job.status === 'active' ? 'reopened' : 'closed'}.`);
    res.redirect(req.get('referer') || '/admin/jobs');
  } catch (err) {
    console.error('[ADMIN TOGGLE JOB]', err);
    req.flash('error', 'Error updating job');
    res.redirect('/admin/jobs');
  }
});

/* Feature / unfeature */
router.post('/jobs/:id/feature', isAdmin, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/admin/jobs');
    }

    job.featured = !job.featured;
    await job.save();

    req.flash('success', job.featured ? 'Job featured.' : 'Job unfeatured.');
    res.redirect(req.get('referer') || '/admin/jobs');
  } catch (err) {
    console.error('[ADMIN FEATURE JOB]', err);
    req.flash('error', 'Error updating job');
    res.redirect('/admin/jobs');
  }
});

/* Delete job */
router.post('/jobs/:id/delete', isAdmin, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/admin/jobs');
    }

    await job.destroy();
    req.flash('success', 'Job deleted.');
    res.redirect('/admin/jobs');
  } catch (err) {
    console.error('[ADMIN DELETE JOB]', err);
    req.flash('error', 'Error deleting job');
    res.redirect('/admin/jobs');
  }
});

/* ================================================================== */
/* DEPARTMENTS — /admin/departments                                    */
/* ================================================================== */
router.get('/departments', isAdmin, async (req, res) => {
  try {
    const departments = await Department.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: Job,
          as: 'jobs',
          attributes: ['id', 'status']
        }
      ]
    });

    res.render('admin/departments', {
      title: 'Departments',
      departments,
      TYPES: Department.TYPES
    });
  } catch (err) {
    console.error('[ADMIN DEPARTMENTS]', err);
    req.flash('error', 'Error loading departments');
    res.redirect('/admin');
  }
});

router.post('/departments', isAdmin, async (req, res) => {
  try {
    const { name, shortName, type, description, displayOrder } = req.body;

    if (!name || !type) {
      req.flash('error', 'Name and type are required.');
      return res.redirect('/admin/departments');
    }

    await Department.create({
      name: name.trim(),
      shortName: shortName ? shortName.trim() : null,
      type,
      description: description ? description.trim() : null,
      displayOrder: displayOrder ? parseInt(displayOrder, 10) : 100,
      active: true
    });

    req.flash('success', 'Department added.');
    res.redirect('/admin/departments');
  } catch (err) {
    console.error('[ADMIN CREATE DEPT]', err);
    const msg = err.name === 'SequelizeUniqueConstraintError'
      ? 'A department with that name already exists.'
      : 'Error adding department: ' + err.message;
    req.flash('error', msg);
    res.redirect('/admin/departments');
  }
});

router.post('/departments/:id/toggle', isAdmin, async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) {
      req.flash('error', 'Department not found');
      return res.redirect('/admin/departments');
    }

    dept.active = !dept.active;
    await dept.save();

    req.flash('success', `Department ${dept.active ? 'enabled' : 'disabled'}.`);
    res.redirect('/admin/departments');
  } catch (err) {
    console.error('[ADMIN TOGGLE DEPT]', err);
    req.flash('error', 'Error updating department');
    res.redirect('/admin/departments');
  }
});

router.post('/departments/:id/delete', isAdmin, async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);

    if (!dept) {
      req.flash('error', 'Department not found');
      return res.redirect('/admin/departments');
    }

    const jobCount = await Job.count({ where: { departmentId: dept.id } });

    if (jobCount > 0) {
      req.flash(
        'error',
        `Cannot delete "${dept.name}" — it has ${jobCount} job(s). Disable it instead.`
      );
      return res.redirect('/admin/departments');
    }

    await dept.destroy();
    req.flash('success', 'Department deleted.');
    res.redirect('/admin/departments');
  } catch (err) {
    console.error('[ADMIN DELETE DEPT]', err);
    req.flash('error', 'Error deleting department');
    res.redirect('/admin/departments');
  }
});

/* ================================================================== */
/* USERS — /admin/users                                                */
/* ================================================================== */

/* -------- List -------- */
router.get('/users', isAdmin, async (req, res) => {
  try {
    const { role = 'All', search = '', page = 1 } = req.query;
    const limit = 20;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * limit;

    const where = {};
    if (role !== 'All') where.role = role;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: { exclude: ['password', 'passwordResetToken'] }
    });

    res.render('admin/users', {
      title: 'Manage Users',
      users,
      total,
      currentPage,
      totalPages: Math.ceil(total / limit) || 1,
      filters: { role, search }
    });
  } catch (err) {
    console.error('[ADMIN USERS]', err);
    req.flash('error', 'Error loading users');
    res.redirect('/admin');
  }
});

/* -------- Create — GET /admin/users/new -------- */
router.get('/users/new', isAdmin, (req, res) => {
  res.render('admin/user-form', {
    title: 'Create User'
  });
});

/* -------- Create — POST /admin/users -------- */
router.post('/users', isAdmin, async (req, res) => {
  const { name, email, password, role, company, phone } = req.body;

  const fail = (msg) => {
    req.flash('error', msg);
    req.flash('formName', name || '');
    req.flash('formEmail', email || '');
    req.flash('formRole', role || '');
    req.flash('formPhone', phone || '');
    req.flash('formCompany', company || '');
    res.redirect('/admin/users/new');
  };

  try {
    if (!name || !name.trim()) return fail('Full name is required.');
    if (!email || !email.trim()) return fail('Email is required.');
    if (!password || password.length < 6) return fail('Password must be at least 6 characters.');
    if (!['applicant', 'employer', 'admin'].includes(role)) return fail('Invalid role.');

    const normalized = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalized } });
    if (existing) return fail('A user with that email already exists.');

    await User.create({
      name: name.trim(),
      email: normalized,
      password,
      role,
      phone: phone ? phone.trim() : null,
      company: role === 'employer' && company ? company.trim() : null
    });

    req.flash('success', `User "${name}" created successfully.`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[ADMIN CREATE USER]', err);
    fail('Error creating user: ' + err.message);
  }
});

/* -------- Edit — GET /admin/users/:id/edit -------- */
router.get('/users/:id/edit', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'passwordResetToken'] }
    });
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    res.render('admin/user-form', {
      title: `Edit User — ${user.name}`,
      user
    });
  } catch (err) {
    console.error('[ADMIN EDIT USER GET]', err);
    req.flash('error', 'Error loading user.');
    res.redirect('/admin/users');
  }
});

/* -------- Edit — POST /admin/users/:id -------- */
router.post('/users/:id', isAdmin, async (req, res) => {
  const { name, email, password, role, company, phone } = req.body;

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    /* Validation */
    if (!name || !name.trim()) {
      req.flash('error', 'Full name is required.');
      return res.redirect(`/admin/users/${user.id}/edit`);
    }
    if (!email || !email.trim()) {
      req.flash('error', 'Email is required.');
      return res.redirect(`/admin/users/${user.id}/edit`);
    }
    if (!['applicant', 'employer', 'admin'].includes(role)) {
      req.flash('error', 'Invalid role.');
      return res.redirect(`/admin/users/${user.id}/edit`);
    }

    const normalized = email.trim().toLowerCase();

    /* Uniqueness check (excluding self) */
    const existing = await User.findOne({
      where: { email: normalized, id: { [Op.ne]: user.id } }
    });
    if (existing) {
      req.flash('error', 'Another user with that email already exists.');
      return res.redirect(`/admin/users/${user.id}/edit`);
    }

    /* Prevent self-demotion */
    if (user.id === req.session.user.id && role !== 'admin') {
      req.flash('error', 'You cannot change your own role.');
      return res.redirect(`/admin/users/${user.id}/edit`);
    }

    /* Update */
    user.name = name.trim();
    user.email = normalized;
    user.role = role;
    user.phone = phone ? phone.trim() : null;
    user.company = role === 'employer' && company ? company.trim() : null;

    /* Only change password if provided */
    if (password && password.trim()) {
      if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters.');
        return res.redirect(`/admin/users/${user.id}/edit`);
      }
      user.password = password;
    }

    await user.save();

    req.flash('success', `User "${user.name}" updated.`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[ADMIN EDIT USER POST]', err);
    req.flash('error', 'Error updating user: ' + err.message);
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

/* -------- Inline role change — POST /admin/users/:id/role -------- */
router.post('/users/:id/role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['applicant', 'employer', 'admin'].includes(role)) {
      req.flash('error', 'Invalid role');
      return res.redirect('/admin/users');
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    if (user.id === req.session.user.id) {
      req.flash('error', 'You cannot change your own role.');
      return res.redirect('/admin/users');
    }

    user.role = role;
    await user.save();

    req.flash('success', `${user.name} is now a ${role}.`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[ADMIN USER ROLE]', err);
    req.flash('error', 'Error updating role');
    res.redirect('/admin/users');
  }
});

/* -------- Reset password — POST /admin/users/:id/reset-password -------- */
router.post('/users/:id/reset-password', isAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      req.flash('error', 'Password must be at least 6 characters.');
      return res.redirect('/admin/users');
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    user.password = newPassword;   // beforeSave hook hashes it
    await user.save();

    req.flash('success', `Password reset for ${user.name}.`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[ADMIN RESET PASSWORD]', err);
    req.flash('error', 'Error resetting password');
    res.redirect('/admin/users');
  }
});

/* -------- Delete — POST /admin/users/:id/delete -------- */
router.post('/users/:id/delete', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    if (user.id === req.session.user.id) {
      req.flash('error', 'You cannot delete your own account.');
      return res.redirect('/admin/users');
    }

    const name = user.name;
    await user.destroy();
    req.flash('success', `User "${name}" deleted.`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[ADMIN DELETE USER]', err);
    req.flash('error', 'Error deleting user');
    res.redirect('/admin/users');
  }
});

/* ================================================================== */
/* APPLICATIONS — /admin/applications                                  */
/* ================================================================== */
router.get('/applications', isAdmin, async (req, res) => {
  try {
    const { status = 'All', page = 1 } = req.query;
    const limit = 20;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * limit;

    const where = {};
    if (status !== 'All') where.status = status;

    const { rows: applications, count: total } = await Application.findAndCountAll({
      where,
      include: [
        { model: Job, as: 'job', attributes: ['id', 'title', 'jobRef'] },
        { model: User, as: 'applicant', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    res.render('admin/applications', {
      title: 'Applications',
      applications,
      total,
      currentPage,
      totalPages: Math.ceil(total / limit) || 1,
      filters: { status }
    });
  } catch (err) {
    console.error('[ADMIN APPLICATIONS]', err);
    req.flash('error', 'Error loading applications');
    res.redirect('/admin');
  }
});

module.exports = router;