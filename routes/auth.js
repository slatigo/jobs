const express = require('express');
const router = express.Router();
const { User } = require('../models');

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const ALLOWED_ROLES = ['student', 'employer']; // never let a form pick 'admin'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

/** Guard: redirect logged-in users away from login/register */
function redirectIfAuthed(req, res, next) {
  if (req.session.user) {
    return res.redirect(req.query.returnTo || '/');
  }
  next();
}

/* ------------------------------------------------------------------ */
/* LOGIN — GET                                                         */
/* ------------------------------------------------------------------ */
router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    returnTo: req.query.returnTo || '/',
    formData: {}
  });
});

/* ------------------------------------------------------------------ */
/* LOGIN — POST                                                        */
/* ------------------------------------------------------------------ */
router.post('/login', redirectIfAuthed, async (req, res) => {
  const { email, password, returnTo = '/' } = req.body;

  const fail = (msg) => {
    req.flash('error', msg);
    // Preserve email so the user doesn't retype it
    req.flash('formEmail', String(email || ''));
    return res.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  try {
    // ---- Validation ----
    if (!email || !password) return fail('Email and password are required.');
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) return fail('Please enter a valid email address.');

    // ---- Lookup ----
    const user = await User.findOne({ where: { email: normalized } });
    if (!user) return fail('Invalid email or password.'); // don't reveal which

    const ok = await user.comparePassword(password);
    if (!ok) return fail('Invalid email or password.');

    // ---- Session fixation protection ----
    req.session.regenerate((err) => {
      if (err) {
        console.error('[AUTH LOGIN] session regen:', err);
        return fail('Login failed. Please try again.');
      }
      req.session.user = safeUser(user);
      req.flash('success', `Welcome back, ${user.name.split(' ')[0]}!`);
      const target = returnTo && returnTo.startsWith('/') ? returnTo : '/';
      res.redirect(target);
    });
  } catch (err) {
    console.error('[AUTH LOGIN]', err);
    return fail('Login failed. Please try again.');
  }
});

/* ------------------------------------------------------------------ */
/* REGISTER — GET                                                      */
/* ------------------------------------------------------------------ */
router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('auth/register', {
    title: 'Register',
    returnTo: req.query.returnTo || '/',
    formData: {}
  });
});

/* ------------------------------------------------------------------ */
/* REGISTER — POST                                                     */
/* ------------------------------------------------------------------ */
router.post('/register', redirectIfAuthed, async (req, res) => {
  const {
    name,
    email,
    password,
    passwordConfirm,
    role,
    phone,
    course,
    yearOfStudy,
    company,
    returnTo = '/'
  } = req.body;

  // ---- Stash form values to repopulate on error ----
  const stashForm = () => {
    req.flash('formName', name || '');
    req.flash('formEmail', email || '');
    req.flash('formRole', role || 'student');
    req.flash('formPhone', phone || '');
    req.flash('formCourse', course || '');
    req.flash('formYear', yearOfStudy || '');
    req.flash('formCompany', company || '');
  };

  const fail = (msg) => {
    stashForm();
    req.flash('error', msg);
    return res.redirect(
      `/auth/register?returnTo=${encodeURIComponent(returnTo)}`
    );
  };

  try {
    // ---- Validation ----
    if (!name || !name.trim()) return fail('Full name is required.');
    if (name.trim().length < 3) return fail('Name must be at least 3 characters.');

    if (!email || !email.trim()) return fail('Email is required.');
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) return fail('Please enter a valid email address.');

    if (!password) return fail('Password is required.');
    if (password.length < 6) return fail('Password must be at least 6 characters.');
    if (passwordConfirm !== undefined && password !== passwordConfirm) {
      return fail('Passwords do not match.');
    }

    const safeRole = ALLOWED_ROLES.includes(role) ? role : 'student';

    // Role-specific validation
    let yearVal = null;
    if (safeRole === 'student') {
      if (yearOfStudy) {
        yearVal = parseInt(yearOfStudy, 10);
        if (Number.isNaN(yearVal) || yearVal < 1 || yearVal > 6) {
          return fail('Year of study must be between 1 and 6.');
        }
      }
    } else if (safeRole === 'employer') {
      if (!company || !company.trim()) {
        return fail('Company / Department name is required for employers.');
      }
    }

    // ---- Uniqueness check ----
    const existing = await User.findOne({ where: { email: normalized } });
    if (existing) return fail('An account with that email already exists.');

    // ---- Create ----
    const user = await User.create({
      name: name.trim(),
      email: normalized,
      password, // model hook hashes it
      role: safeRole,
      phone: phone ? phone.trim() : null,
      course: safeRole === 'student' && course ? course.trim() : null,
      yearOfStudy: safeRole === 'student' ? yearVal : null,
      company: safeRole === 'employer' && company ? company.trim() : null
    });

    // ---- Auto-login with session regen ----
    req.session.regenerate((err) => {
      if (err) {
        console.error('[AUTH REGISTER] session regen:', err);
        req.flash('success', 'Account created. Please log in.');
        return res.redirect('/auth/login');
      }
      req.session.user = safeUser(user);
      req.flash('success', `Welcome, ${user.name.split(' ')[0]}!`);
      const target = returnTo && returnTo.startsWith('/') ? returnTo : '/';
      res.redirect(target);
    });
  } catch (err) {
    console.error('[AUTH REGISTER]', err);

    // Don't leak raw Sequelize messages to users
    const msg = err.name === 'SequelizeUniqueConstraintError'
      ? 'That email is already registered.'
      : err.name === 'SequelizeValidationError'
        ? 'Please check the information you entered.'
        : 'Registration failed. Please try again.';

    stashForm();
    req.flash('error', msg);
    res.redirect('/auth/register');
  }
});

/* ------------------------------------------------------------------ */
/* LOGOUT — GET                                                        */
/* ------------------------------------------------------------------ */
router.get('/logout', (req, res) => {
  if (!req.session) return res.redirect('/');

  req.session.destroy((err) => {
    if (err) console.error('[AUTH LOGOUT]', err);
    res.clearCookie('connect.sid', { path: '/' });
    res.redirect('/');
  });
});

module.exports = router;