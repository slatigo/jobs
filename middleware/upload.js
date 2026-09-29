const path = require('path');
const fs = require('fs');
const multer = require('multer');

/* ------------------------------------------------------------------ */
/* Upload directory                                                    */
/* ------------------------------------------------------------------ */
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'resumes');

// Create directory on startup if missing
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('📁 Created uploads directory:', UPLOAD_DIR);
}

/* ------------------------------------------------------------------ */
/* Allowed types & limits                                              */
/* ------------------------------------------------------------------ */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',                                                          // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'     // .docx
]);

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx']);

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/* ------------------------------------------------------------------ */
/* Filename sanitization                                               */
/* ------------------------------------------------------------------ */
function safeBaseName(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'resume';
  return base + ext;
}

/* ------------------------------------------------------------------ */
/* Storage engine                                                      */
/* ------------------------------------------------------------------ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const userId = req.session?.user?.id || 'anon';
    const jobId = req.params?.id || 'job';
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'resume';
    cb(null, `job${jobId}-user${userId}-${stamp}-${rand}-${base}${ext}`);
  }
});

/* ------------------------------------------------------------------ */
/* File filter                                                         */
/* ------------------------------------------------------------------ */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error('Only PDF, DOC, or DOCX files are allowed.'));
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Invalid file type. Upload a PDF or Word document.'));
  }
  cb(null, true);
}

/* ------------------------------------------------------------------ */
/* Exported multer instance                                            */
/* ------------------------------------------------------------------ */
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: 1 }
});

/* ------------------------------------------------------------------ */
/* Error handler wrapper for use in routes                             */
/* ------------------------------------------------------------------ */
function handleUploadError(err, req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('error', 'File is too large. Maximum size is 5 MB.');
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      req.flash('error', 'Only one file can be uploaded.');
    } else {
      req.flash('error', 'Upload failed: ' + err.message);
    }
    return res.redirect(`/jobs/${req.params.id}`);
  }

  if (err.message) {
    req.flash('error', err.message);
    return res.redirect(`/jobs/${req.params.id}`);
  }

  next(err);
}

module.exports = { upload, handleUploadError, UPLOAD_DIR, MAX_SIZE };