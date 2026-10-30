const express = require('express');
const router = express.Router({ mergeParams: true });
const PDFDocument = require('pdfkit');
const {
  Job,
  Application,
  JobStage,
  User,
  Department
} = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { ZipArchive } = require('archiver');

const fs = require('fs');
const path = require('path');
/* ================================================================== */
/* Institutional branding                                              */
/* ================================================================== */
const ORG = {
  school: 'Makerere University Business School',
  directorate: 'HUMAN RESOURCE DIRECTORATE'
};

/* ================================================================== */
/* Shared: resolve job, auth, stages, filtered applications            */
/* ================================================================== */
async function loadContext(req) {
  const job = await Job.findByPk(req.params.id, {
    include: [{ model: Department, as: 'department' }]
  });
  if (!job) return { error: 'notfound' };

  const isPoster = req.session.user.id === job.userId;
  const isAdmin  = req.session.user.role === 'admin';
  if (!isPoster && !isAdmin) return { error: 'forbidden', job };

  const stageRows = await JobStage.findAll({
    where: { jobId: job.id },
    order: [['order', 'ASC']]
  });
  const stages = stageRows.length > 0
    ? stageRows.map(s => ({ key: s.key, label: s.label, color: s.color }))
    : Job.DEFAULT_STAGES;

  const labelFor = (key) => {
    const s = stages.find(x => x.key === key);
    return s ? s.label : key;
  };

  const statusFilter = (req.query.status || 'all').toLowerCase();
  const validKeys = ['all', ...stages.map(s => s.key)];
  const activeFilter = validKeys.includes(statusFilter) ? statusFilter : 'all';

  const where = { jobId: job.id };
  if (activeFilter !== 'all') where.status = activeFilter;

  const applications = await Application.findAll({
    where,
    include: [
      { model: User, as: 'applicant', attributes: ['id', 'name', 'email'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return { job, stages, labelFor, activeFilter, applications };
}

function safeSlug(s) {
  return String(s || 'job')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function sendAuthError(req, res, ctx) {
  if (ctx.error === 'notfound') {
    req.flash('error', 'Job not found');
    return res.redirect('/jobs');
  }
  req.flash('error', 'You are not allowed to export applications for this job.');
  return res.redirect(ctx.job ? `/jobs/${ctx.job.id}` : '/jobs');
}

/* ================================================================== */
/* GET /:id/applications/export.csv?status=<filter>                    */
/* ================================================================== */
router.get('/export.csv', isAuthenticated, async (req, res) => {
  try {
    const ctx = await loadContext(req);
    if (ctx.error) return sendAuthError(req, res, ctx);

    const { job, labelFor, activeFilter, applications } = ctx;

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const header = [
      'Application ID', 'Full Name', 'Email', 'Phone',
      'Status', 'Applied At', 'Cover Letter', 'Resume URL'
    ];

    const rows = applications.map(a => [
      a.id,
      a.fullName,
      a.email,
      a.phone || '',
      labelFor(a.status),
      a.createdAt ? new Date(a.createdAt).toISOString() : '',
      a.coverLetter || '',
      a.attachmentUrl || ''
    ]);

    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');

    const suffix = activeFilter === 'all' ? 'all' : activeFilter;
    const filename = `applications-${safeSlug(job.title)}-${suffix}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('[APPLICATIONS EXPORT CSV]', err);
    if (res.headersSent) return;
    req.flash('error', 'Error exporting applications');
    res.redirect(`/jobs/${req.params.id}/applications`);
  }
});

/* ================================================================== */
/* GET /:id/applications/export.pdf?status=<filter>                  */
/* ================================================================== */
router.get('/export.pdf', isAuthenticated, async (req, res) => {
  try {
    const ctx = await loadContext(req);
    if (ctx.error) return sendAuthError(req, res, ctx);

    const { job, labelFor, activeFilter, applications } = ctx;
    const suffix = activeFilter === 'all' ? 'all' : activeFilter;
    const filename = `applications-${safeSlug(job.title)}-${suffix}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      autoFirstPage: true,
      // Setting bottom margin to 0 prevents PDFKit's default auto-page break trigger
      margins: { top: 50, bottom: 0, left: 50, right: 50 }, 
      info: {
        Title: `Applications — ${job.title}`,
        Author: `${ORG.school} — ${ORG.directorate}`,
        Subject: 'Job applications report',
        Creator: 'Recruitment Portal'
      }
    });
    doc.pipe(res);

    const PAGE_W = doc.page.width;
    const MARGIN = 50;
    const BOTTOM_MARGIN = 60;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    /* ---------- Palette ---------- */
    const C = {
      ink:      '#111827',
      muted:    '#6b7280',
      line:     '#e5e7eb',
      band:     '#f9fafb',
      accent:   '#4f46e5',
      accentBg: '#eef2ff'
    };

    /* ================================================================ */
    /* BRANDED HEADER BAND (Centered)                                   */
    /* ================================================================ */
    const HEADER_BAND_HEIGHT = 155;
    doc.rect(0, 0, PAGE_W, HEADER_BAND_HEIGHT).fill(C.accentBg);

    try {
      const logoPath = require('path').join(__dirname, '../../public/images/logo.png');
      doc.image(logoPath, PAGE_W / 2 - 25, 12, { height: 38 });
    } catch (e) {
      console.warn('[PDF EXPORT] Logo not found at /public/images/logo.png');
    }

    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(13)
       .text(ORG.school.toUpperCase(), MARGIN, 56, {
         width: CONTENT_W, align: 'center', characterSpacing: 0.5
       });

    doc.fillColor(C.ink).font('Helvetica').fontSize(9.5)
       .text(ORG.directorate, MARGIN, 73, { width: CONTENT_W, align: 'center' });

    doc.strokeColor(C.accent).lineWidth(0.75)
       .moveTo(MARGIN, 87)
       .lineTo(MARGIN + CONTENT_W, 87)
       .stroke();

    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11)
       .text('Applications Report', MARGIN, 94, { width: CONTENT_W, align: 'center' });

    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10)
       .text(job.title, MARGIN, 110, { width: CONTENT_W, align: 'center', ellipsis: true });

    doc.fillColor(C.muted).font('Helvetica').fontSize(8)
       .text(
         [
           job.department ? job.department.name : null,
           job.jobRef ? `Ref: ${job.jobRef}` : null,
           `Filter: ${activeFilter === 'all' ? 'All stages' : labelFor(activeFilter)}`,
           `Generated: ${new Date().toISOString().slice(0, 10)}`,
           `${applications.length} application${applications.length === 1 ? '' : 's'}`
         ].filter(Boolean).join('   ·   '),
         MARGIN, 128,
         { width: CONTENT_W, height: 16, lineBreak: false, align: 'center', ellipsis: true }
       );

    /* ================================================================ */
    /* TABLE SETUP                                                      */
    /* ================================================================ */
    const cols = [
      { key: 'idx',     label: '#',         w: 25,  align: 'right' },
      { key: 'name',    label: 'Applicant', w: 135, align: 'left'  },
      { key: 'contact', label: 'Contact',   w: 155, align: 'left'  },
      { key: 'status',  label: 'Status',    w: 75,  align: 'left'  },
      { key: 'applied', label: 'Applied',   w: 0,   align: 'right' }
    ];
    const fixedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = CONTENT_W - fixedW;

    const HEAD_H = 24;
    let currentY = 175; 
    doc.y = currentY;

    const drawTableHeader = () => {
      doc.rect(MARGIN, currentY, CONTENT_W, HEAD_H).fill(C.band);
      doc.fillColor(C.muted).font('Helvetica-Bold').fontSize(9);
      
      let x = MARGIN;
      cols.forEach(c => {
        doc.text(c.label.toUpperCase(), x + 6, currentY + 7, {
          width: c.w - 12, align: c.align, lineBreak: false
        });
        x += c.w;
      });
      
      doc.strokeColor(C.line).lineWidth(0.5)
         .moveTo(MARGIN, currentY + HEAD_H)
         .lineTo(MARGIN + CONTENT_W, currentY + HEAD_H)
         .stroke();
         
      currentY += HEAD_H;
      doc.y = currentY;
    };

    const ensureSpace = (h) => {
      if (currentY + h > doc.page.height - BOTTOM_MARGIN) {
        doc.addPage();
        currentY = 50;
        doc.y = currentY;
        drawTableHeader();
      }
    };

    drawTableHeader();

    /* ================================================================ */
    /* ROWS                                                             */
    /* ================================================================ */
    applications.forEach((a, i) => {
      const statusLabel = labelFor(a.status);
      
      let applied = '—';
      if (a.createdAt) {
        const d = new Date(a.createdAt);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        applied = `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
      }

      const contact = [a.email, a.phone].filter(Boolean).join('\n');
      const name = a.fullName || '—';

      doc.font('Helvetica').fontSize(9);
      
      const nameH = doc.heightOfString(name, { width: cols[1].w - 12 });
      const contactH = doc.heightOfString(contact, { width: cols[2].w - 12 });
      const appliedH = doc.heightOfString(applied, { width: cols[4].w - 12 });
      
      const maxH = Math.max(nameH, contactH, appliedH, 16);
      const ROW_H = maxH + 14; 

      ensureSpace(ROW_H);

      doc.fillColor(C.ink).font('Helvetica').fontSize(9);

      cols.forEach((c, index) => {
        const cellVal = c.key === 'idx' ? String(i + 1) : 
                        c.key === 'name' ? name : 
                        c.key === 'contact' ? contact : 
                        c.key === 'applied' ? applied : null;

        const currentX = MARGIN + cols.slice(0, index).reduce((sum, col) => sum + col.w, 0);

        if (c.key === 'status') {
          const chipW = Math.min(c.w - 12, doc.widthOfString(statusLabel) + 16);
          doc.roundedRect(currentX + 6, currentY + 6, chipW, 14, 7).fill(C.accentBg);
          doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(8)
             .text(statusLabel, currentX + 12, currentY + 9, { width: chipW - 12, lineBreak: false });
          doc.fillColor(C.ink).font('Helvetica').fontSize(9);
        } else if (cellVal !== null) {
          doc.text(cellVal, currentX + 6, currentY + 6, {
            width: c.w - 12,
            align: c.align,
            lineBreak: true,
            lineGap: 1 
          });
        }
      });

      doc.strokeColor(C.line).lineWidth(0.4)
         .moveTo(MARGIN, currentY + ROW_H)
         .lineTo(MARGIN + CONTENT_W, currentY + ROW_H)
         .stroke();

      currentY += ROW_H;
      doc.y = currentY;
    });

    /* ================================================================ */
    /* COVER LETTERS APPENDIX                                           */
    /* ================================================================ */
    const withCover = applications.filter(a => a.coverLetter && a.coverLetter.trim());
    if (withCover.length) {
      ensureSpace(60);
      currentY += 20;
      doc.y = currentY;
      
      doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(12)
         .text('Appendix — Cover Letters', MARGIN, currentY, { width: CONTENT_W });
      currentY += 16; 
      
      doc.strokeColor(C.accent).lineWidth(0.75)
         .moveTo(MARGIN, currentY).lineTo(MARGIN + CONTENT_W, currentY).stroke();
      currentY += 16; 
      doc.y = currentY;

      withCover.forEach((a) => {
        const nameLineH = 16;
        const coverWidth = CONTENT_W - 12;
        const coverH = doc.heightOfString(a.coverLetter, { width: coverWidth, align: 'left' });
        const blockH = nameLineH + coverH + 22;

        ensureSpace(blockH);

        doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10)
           .text(`${a.fullName}   ·   ${labelFor(a.status)}`, MARGIN, currentY, { width: CONTENT_W });
        currentY += 16;
        
        doc.fillColor(C.muted).font('Helvetica').fontSize(8.5)
           .text([a.email, a.phone].filter(Boolean).join('   ·   '), MARGIN, currentY, { width: CONTENT_W });
        currentY += 14;

        const bodyY = currentY;
        doc.fillColor(C.ink).font('Helvetica').fontSize(9)
           .text(a.coverLetter, MARGIN + 12, bodyY, { width: coverWidth, align: 'left' });
        
        currentY += coverH + 16;
        doc.y = currentY;

        doc.strokeColor(C.accentBg).lineWidth(2)
           .moveTo(MARGIN + 4, bodyY).lineTo(MARGIN + 4, currentY - 16).stroke();
      });
    }

    /* ================================================================ */
    /* FOOTER ON EVERY PAGE                                             */
    /* ================================================================ */
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      const footerY = doc.page.height - 42;

      doc.fillColor(C.muted).font('Helvetica').fontSize(7.5)
         .text(`${ORG.school} — ${ORG.directorate}`, MARGIN, footerY, { width: CONTENT_W, align: 'center' });

      doc.fillColor(C.muted).font('Helvetica').fontSize(8)
         .text(`Applications — ${job.title}`, MARGIN, footerY + 12, { width: CONTENT_W / 2, align: 'left' })
         .text(`Page ${p - range.start + 1} of ${range.count}`, MARGIN + CONTENT_W / 2, footerY + 12, { width: CONTENT_W / 2, align: 'right' });
    }

    doc.end();
  } catch (err) {
    console.error('[APPLICATIONS EXPORT PDF]', err);
    if (res.headersSent) return;
    req.flash('error', 'Error exporting applications');
    res.redirect(`/jobs/${req.params.id}/applications`);
  }
});


/* ================================================================== */
/* GET /:id/applications/download-zip?status=<filter>                  */
/* ================================================================== */
router.get('/download-zip', isAuthenticated, async (req, res) => {
  try {
    // 1. Re-use your existing auth and context logic
    const ctx = await loadContext(req);
    if (ctx.error) return sendAuthError(req, res, ctx);

    const { job, applications } = ctx;

    // Filter out applications without an attachment
    const withFiles = applications.filter(a => a.attachmentUrl);

    if (withFiles.length === 0) {
      req.flash('error', 'No resumes found to download for this filter.');
      return res.redirect(`/jobs/${job.id}/applications`);
    }

    // 2. Set headers for ZIP download
    const suffix = req.query.status && req.query.status !== 'all' ? `-${req.query.status}` : '-all';
    const filename = `applications-${safeSlug(job.title)}${suffix}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // 3. Create the ZIP archive and pipe it to the response
    // Use the ZipArchive class we imported at the top
    const archive = new ZipArchive({
      zlib: { level: 9 } // Maximum compression
    });

    // Listen for errors
    archive.on('error', (err) => {
      console.error('[ZIP ERROR]', err);
      if (!res.headersSent) {
        req.flash('error', 'Error generating ZIP file.');
        res.redirect(`/jobs/${job.id}/applications`);
      }
    });

    // Pipe the archive data to the response
    archive.pipe(res);

    // 4. Loop through applications and add files to the zip
    for (const app of withFiles) {
      // Extract the filename from the URL
      const fileName = app.attachmentUrl.split('/').pop();
      
      // Determine where the file is stored locally
      // IMPORTANT: Adjust this path if your files are stored elsewhere (e.g., 'uploads/')
       const filePath = path.join(__dirname, '../../public/uploads/resumes', fileName);

      if (fs.existsSync(filePath)) {
        // Rename the file inside the zip to include the applicant's name for clarity
        const safeName = app.fullName.replace(/[^a-z0-9]/gi, '_');
        const fileExt = path.extname(fileName);
        const newNameInZip = `${safeName}_${app.id}${fileExt}`;

        archive.file(filePath, { name: newNameInZip });
      } else {
        console.warn(`[ZIP DOWNLOAD] File not found on disk: ${filePath}`);
      }
    }

    // 5. Finalize the archive (this triggers the download to finish)
    await archive.finalize();

  } catch (err) {
    console.error('[ZIP DOWNLOAD]', err);
    if (!res.headersSent) {
      req.flash('error', 'Error downloading resumes.');
      res.redirect(`/jobs/${req.params.id}/applications`);
    }
  }
});


module.exports = router;