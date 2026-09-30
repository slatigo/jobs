/* ==================================================================
   JOBS ROUTER — mounts all job-related sub-routers
   ================================================================== */

const express = require('express');
const router = express.Router();

router.use('/', require('./jobs/list'));
router.use('/', require('./jobs/create'));
router.use('/', require('./jobs/detail'));
router.use('/', require('./jobs/edit'));
router.use('/', require('./jobs/apply'));
router.use('/', require('./jobs/manage'));
const stagesRouter = require('./jobs/stages');
router.use('/:id/stages', stagesRouter);
// Mount applications sub-router at /:id/applications
router.use('/:id/applications', require('./applications'));

module.exports = router;