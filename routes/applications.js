/* ==================================================================
   APPLICATIONS ROUTER — mounted inside jobs router at /:id/applications
   ================================================================== */

const express = require('express');
const router = express.Router({ mergeParams: true });

router.use('/', require('./applications/list'));
router.use('/', require('./applications/export'));
router.use('/', require('./applications/reports'));
router.use('/', require('./applications/ai'));
router.use('/', require('./applications/bulk'));
router.use('/', require('./applications/status'));

module.exports = router;