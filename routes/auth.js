const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { sendWelcomeEmail ,sendPasswordResetEmail} = require('../utils/mail');
const crypto = require('crypto');
const passport = require('passport');
/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const ALLOWED_ROLES = ['applicant', 'employer'];   // never allow 'admin' from a form
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || null
  };
}

/** Guard: redirect logged-in users away from login/register */
function redirectIfAuthed(req, res, next) {
  if (req.session.user) {
    return res.redirect(req.query.returnTo || '/');
  }
  next();
}

/* ================================================================== */
/* LOGIN — GET                                                         */
/* ================================================================== */
router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    returnTo: req.query.returnTo || '/',
    formData: {}
  });
});

/* ================================================================== */
/* LOGIN — POST                                                        */
/* ================================================================== */
router.post('/login', redirectIfAuthed, async (req, res) => {
  const { email, password, returnTo = '/' } = req.body;

  const fail = (msg) => {
    req.flash('error', msg);
    req.flash('formEmail', String(email || ''));
    return res.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  try {
    /* ---- Validation ---- */
    if (!email || !password) return fail('Email and password are required.');
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) return fail('Please enter a valid email address.');

    /* ---- Lookup ---- */
    const user = await User.findOne({ where: { email: normalized } });
    if (!user) return fail('Invalid email or password.');   // don't reveal which

    const ok = await user.comparePassword(password);
    if (!ok) return fail('Invalid email or password.');

    /* ---- Session fixation protection ---- */
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

/* ================================================================== */
/* REGISTER — GET                                                      */
/* ================================================================== */
router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('auth/register', {
    title: 'Register',
    returnTo: req.query.returnTo || '/',
    formData: {}
  });
});

/* ================================================================== */
/* REGISTER — POST                                                     */
/* ================================================================== */
router.post('/register', redirectIfAuthed, async (req, res) => {
  const {
    name,
    email,
    password,
    passwordConfirm,
    phone,
    returnTo = '/'
  } = req.body;

  /* ---- Stash form values to repopulate on error ---- */
  const stashForm = () => {
    req.flash('formName',  (name  || '').trim());
    req.flash('formEmail', (email || '').trim());
    req.flash('formPhone', (phone || '').trim());
  };

  const fail = (msg) => {
    stashForm();
    req.flash('error', msg);
    return res.redirect(`/auth/register?returnTo=${encodeURIComponent(returnTo)}`);
  };

  try {
    /* ---- Validation ---- */
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

    /* ---- Uniqueness check ---- */
    const existing = await User.findOne({ where: { email: normalized } });
    if (existing) return fail('An account with that email already exists.');

    /* ---- Create (public registration is always 'applicant') ---- */
    const user = await User.create({
      name: name.trim(),
      email: normalized,
      password,                       // model hook hashes it
      role: 'applicant',
      phone: phone ? phone.trim() : null
    });

    /* ---- Send welcome email (fire-and-forget) ---- */
    sendWelcomeEmail({
      to: user.email,
      name: user.name,
      role: user.role
    }).catch((err) => {
      console.error('[WELCOME EMAIL]', err.message);
    });

    /* ---- Auto-login with session regen ---- */
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

/* ================================================================== */
/* LOGOUT — GET                                                        */
/* ================================================================== */
router.get('/logout', (req, res) => {
  if (!req.session) return res.redirect('/');

  req.session.destroy((err) => {
    if (err) console.error('[AUTH LOGOUT]', err);
    res.clearCookie('connect.sid', { path: '/' });
    res.redirect('/');
  });
});
/* ================================================================== */
/* FORGOT PASSWORD — GET                                               */
/* ================================================================== */
router.get('/forgot-password', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/forgot-password', { title: 'Forgot Password' });
});

/* ================================================================== */
/* FORGOT PASSWORD — POST                                              */
/* ================================================================== */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const GENERIC_OK = 'If an account exists with that email, a reset link has been sent.';

  try {
    if (!email || !email.trim()) {
      req.flash('error', 'Please enter your email address.');
      return res.redirect('/auth/forgot-password');
    }

    const normalized = normalizeEmail(email);
    const user = await User.findOne({ where: { email: normalized } });

    // Always respond the same way — never reveal whether the email exists
    if (!user) {
      req.flash('success', GENERIC_OK);
      return res.redirect('/auth/login');
    }

    /* ---- Generate token (raw + hashed) ---- */
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    /* ---- Build reset URL ---- */
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/auth/reset-password/${rawToken}`;

    /* ---- Send email (fire-and-forget) ---- */
    sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl
    }).catch((err) => console.error('[RESET EMAIL]', err.message));

    req.flash('success', GENERIC_OK);
    res.redirect('/auth/login');
  } catch (err) {
    console.error('[FORGOT PASSWORD]', err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/auth/forgot-password');
  }
});

/* ================================================================== */
/* RESET PASSWORD — GET                                                */
/* ================================================================== */
router.get('/reset-password/:token', async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      req.flash('error', 'This password reset link is invalid or has expired.');
      return res.redirect('/auth/forgot-password');
    }

    res.render('auth/reset-password', {
      title: 'Reset Password',
      token: req.params.token
    });
  } catch (err) {
    console.error('[RESET PASSWORD GET]', err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/auth/login');
  }
});

/* ================================================================== */
/* RESET PASSWORD — POST                                               */
/* ================================================================== */
router.post('/reset-password/:token', async (req, res) => {
  const { password, passwordConfirm } = req.body;

  try {
    /* ---- Validate new password ---- */
    if (!password || password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters.');
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }
    if (password !== passwordConfirm) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    /* ---- Look up the user by hashed token ---- */
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      req.flash('error', 'This password reset link is invalid or has expired.');
      return res.redirect('/auth/forgot-password');
    }

    /* ---- Update password + clear token ---- */
    user.password = password;              // beforeSave hook hashes it
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    req.flash('success', 'Your password has been reset. Please log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('[RESET PASSWORD POST]', err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect(`/auth/reset-password/${req.params.token}`);
  }
});

/* ================================================================== */
/* GOOGLE OAUTH — GET /auth/google                                     */
/* ================================================================== */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'    // always ask which account
  })
);

/* ================================================================== */
/* GOOGLE OAUTH — GET /auth/google/callback                            */
/* ================================================================== */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login',
    failureFlash: 'Google sign-in failed. Please try again.'
  }),
  (req, res) => {
    /* Passport put the user on req.user — bridge into our session */
    const u = req.user;

    req.session.regenerate((err) => {
      if (err) {
        console.error('[GOOGLE] session regen:', err);
        req.flash('error', 'Login failed. Please try again.');
        return res.redirect('/auth/login');
      }
      req.session.user = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role
      };
      req.flash('success', `Welcome, ${u.name.split(' ')[0]}!`);
      res.redirect('/');
    });
  }
);
module.exports = router;