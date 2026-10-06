/* ==================================================================
   JOBS ROUTER — mounts all job-related sub-routers
   ------------------------------------------------------------------
   Order matters: static paths (my-applications, new) must come
   before parameterized paths (/:id, /:id/applications, etc.),
   otherwise "my-applications" gets interpreted as a job id.
   ================================================================== */

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../middleware/auth');

/* ------------------------------------------------------------------
   Static paths — must be FIRST
   ------------------------------------------------------------------ */

/* Applicant's own applications — /jobs/my-applications */
router.use('/my-applications', isAuthenticated, require('./myApplications'));

/* Everything else that's already static goes here */
router.use('/', require('./list'));
router.use('/', require('./create'));

/* ------------------------------------------------------------------
   Parameterized paths — /:id/...
   ------------------------------------------------------------------ */

/* Manage a specific job's workflow stages */
router.use('/:id/stages', require('./stages'));

/* Applications for a specific job — /jobs/:id/applications
   `../applications` points at routes/applications.js, the aggregator
   that mounts routes/applications/{list,bulk,status}.js */
router.use('/:id/applications', require('../applications'));

/* Detail, edit, apply, manage (all use /:id or /:id/...) */
router.use('/', require('./detail'));
router.use('/', require('./edit'));
router.use('/', require('./apply'));
router.use('/', require('./manage'));

module.exports = router;