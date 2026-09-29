const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Application, Job } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../middleware/upload');

/* ------------------------------------------------------------------ */
/* Ensure the uploads directory exists (defensive)                     */
/* ------------------------------------------------------------------ */
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('📁 Created uploads directory:', UPLOAD_DIR);
}

/* ------------------------------------------------------------------ */
/* GET /files/resumes/:filename                                        */
/*   Access: job poster | admin | the applicant themself               */
/* ------------------------------------------------------------------ */
router.get('/resumes/:filename', isAuthenticated, async (req, res) => {
  try {
    const filename = req.params.filename;

    // Reject path traversal & separators
    if (!filename || /[\/\\]/.test(filename) || filename.includes('..')) {
      return res.status(400).send('Invalid file name.');
    }

    // Only serve files registered on an application
    const application = await Application.findOne({
      where: { attachmentUrl: `/uploads/resumes/${filename}` },
      include: [{ model: Job, as: 'job', attributes: ['id', 'userId'] }]
    });

    if (!application || !application.job) {
      return res.status(404).send('File not found.');
    }

    const isPoster = req.session.user.id === application.job.userId;
    const isAdmin = req.session.user.role === 'admin';
    const isApplicant = req.session.user.id === application.userId;

    if (!isPoster && !isAdmin && !isApplicant) {
      return res.status(403).send('Access denied.');
    }

    const fullPath = path.join(UPLOAD_DIR, filename);

    // Double-guard: resolved path must stay inside UPLOAD_DIR
    if (!fullPath.startsWith(UPLOAD_DIR)) {
      return res.status(400).send('Invalid path.');
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('File missing on disk.');
    }

    const stat = fs.statSync(fullPath);

    res.setHeader('Content-Type', application.attachmentMime || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(application.attachmentName)}"`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('[FILES]', err);
    if (res.headersSent) return;
    res.status(500).send('Server error.');
  }
});

module.exports = router;