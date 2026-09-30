const express = require('express');
const router = express.Router();
const { Job } = require('../../models');

/* ================================================================== */
/* GET /j/:code — redirect to the job detail page                      */
/* ================================================================== */
router.get('/:code', async (req, res) => {
  try {
    const job = await Job.findOne({
      where: { shortCode: req.params.code },
      attributes: ['id']
    });

    if (!job) {
      return res.status(404).render('404', { title: 'Link not found' });
    }

    res.redirect(`/jobs/${job.id}`);
  } catch (err) {
    console.error('[SHARE REDIRECT]', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;