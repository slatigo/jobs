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

/* ================================================================== */
/* Institutional branding                                              */
/* ================================================================== */
const ORG = {
  school: 'Makerere University Business School',
  directorate: 'Human Resource Directorate'
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
/* GET /:id/applications/export.pdf?status=<filter>                    */
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
      layout: 'landscape',  // <--- LANDSCAPE MODE
      bufferPages: true,
      margins: { top: 40, bottom: 40, left: 40, right: 40 }, // Tighter margins for more room
      info: {
        Title: `Applications — ${job.title}`,
        Author: `${ORG.school} — ${ORG.directorate}`,
        Subject: 'Job applications report',
        Creator: 'Recruitment Portal'
      }
    });
    doc.pipe(res);

    const PAGE_W = doc.page.width;
    const MARGIN = 40;
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
    /* BRANDED HEADER BAND (Slimmer for landscape)                      */
    /* ================================================================ */
    doc.rect(0, 0, PAGE_W, 110).fill(C.accentBg);

    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(15)
       .text(ORG.school.toUpperCase(), MARGIN, 24, {
         width: CONTENT_W, align: 'left', characterSpacing: 0.5
       });

    doc.fillColor(C.ink).font('Helvetica').fontSize(11)
       .text(ORG.directorate, MARGIN, 42, { width: CONTENT_W });

    doc.strokeColor(C.accent).lineWidth(0.75)
       .moveTo(MARGIN, 60)
       .lineTo(MARGIN + CONTENT_W, 60)
       .stroke();

    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(14)
       .text('Applications Report', MARGIN, 68, { width: CONTENT_W });

    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11)
       .text(job.title, MARGIN, 86, { width: CONTENT_W, ellipsis: true });

    doc.fillColor(C.muted).font('Helvetica').fontSize(8.5)
       .text(
         [
           job.department ? job.department.name : null,
           job.jobRef ? `Ref: ${job.jobRef}` : null,
           `Filter: ${activeFilter === 'all' ? 'All stages' : labelFor(activeFilter)}`,
           `Generated: ${new Date().toISOString().slice(0, 10)}`,
           `${applications.length} application${applications.length === 1 ? '' : 's'}`
         ].filter(Boolean).join('   ·   '),
         MARGIN, 98, { width: CONTENT_W }
       );

    doc.y = 130;

    /* ================================================================ */
    /* TABLE SETUP (Landscape Widths)                                   */
    /* ================================================================ */
    const cols = [
      { key: 'idx',     label: '#',         w: 30,  align: 'right' },
      { key: 'name',    label: 'Applicant', w: 200, align: 'left'  },
      { key: 'contact', label: 'Contact',   w: 280, align: 'left'  },
      { key: 'status',  label: 'Status',    w: 100, align: 'left'  },
      { key: 'applied', label: 'Applied',   w: 0,   align: 'right' } // Gets remaining ~160px
    ];
    const fixedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = CONTENT_W - fixedW;

    const ROW_H = 24; // Slightly tighter rows
    const HEAD_H = 24;

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(MARGIN, y, CONTENT_W, HEAD_H).fill(C.band);
      doc.fillColor(C.muted).font('Helvetica-Bold').fontSize(9);
      let x = MARGIN;
      cols.forEach(c => {
        doc.text(c.label.toUpperCase(), x + 6, y + 7, {
          width: c.w - 12, align: c.align
        });
        x += c.w;
      });
      doc.strokeColor(C.line).lineWidth(0.5)
         .moveTo(MARGIN, y + HEAD_H)
         .lineTo(MARGIN + CONTENT_W, y + HEAD_H)
         .stroke();
      doc.y = y + HEAD_H;
      doc.fillColor(C.ink).font('Helvetica').fontSize(9);
    };

    const ensureSpace = (h) => {
      if (doc.y + h > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawTableHeader();
      }
    };

    drawTableHeader();

    /* ================================================================ */
    /* ROWS (With Smart Text Truncation)                                */
    /* ================================================================ */
    applications.forEach((a, i) => {
      ensureSpace(ROW_H);
      const y = doc.y;

      const statusLabel = labelFor(a.status);
      
      // Nice full date format: "27 Oct 2026"
      let applied = '—';
      if (a.createdAt) {
        const d = new Date(a.createdAt);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        applied = `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
      }

      // Truncate contact natively using PDFKit's width measurement
      let contactStr = [a.email, a.phone].filter(Boolean).join('  ·  ');
      doc.font('Helvetica').fontSize(9);
      if (doc.widthOfString(contactStr) > (cols[2].w - 12)) {
        while (doc.widthOfString(contactStr + '...') > (cols[2].w - 12) && contactStr.length > 0) {
          contactStr = contactStr.slice(0, -1);
        }
        contactStr += '...';
      }

      let nameStr = a.fullName || '—';
      if (doc.widthOfString(nameStr) > (cols[1].w - 12)) {
        while (doc.widthOfString(nameStr + '...') > (cols[1].w - 12) && nameStr.length > 0) {
          nameStr = nameStr.slice(0, -1);
        }
        nameStr += '...';
      }

      const cells = {
        idx:     String(i + 1),
        name:    nameStr,
        contact: contactStr || '—',
        status:  statusLabel,
        applied: applied
      };

      let x = MARGIN;
      doc.fillColor(C.ink).font('Helvetica').fontSize(9);

      cols.forEach(c => {
        if (c.key === 'status') {
          const chipW = Math.min(c.w - 12, doc.widthOfString(statusLabel) + 16);
          doc.roundedRect(x + 6, y + 5, chipW, 14, 7).fill(C.accentBg);
          doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(8)
             .text(statusLabel, x + 12, y + 8, { width: chipW - 12, lineBreak: false });
          doc.fillColor(C.ink).font('Helvetica').fontSize(9);
        } else {
          doc.text(cells[c.key], x + 6, y + 7, {
            width: c.w - 12,
            align: c.align,
            lineBreak: false // Safe now because we truncated it above
          });
        }
        x += c.w;
      });

      doc.strokeColor(C.line).lineWidth(0.4)
         .moveTo(MARGIN, y + ROW_H)
         .lineTo(MARGIN + CONTENT_W, y + ROW_H)
         .stroke();

      doc.y = y + ROW_H;
    });

    /* ================================================================ */
    /* COVER LETTERS APPENDIX                                           */
    /* ================================================================ */
    const withCover = applications.filter(a => a.coverLetter && a.coverLetter.trim());
    if (withCover.length) {
      ensureSpace(60);
      doc.moveDown(1.2);
      doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(12)
         .text('Appendix — Cover Letters', MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.3);
      doc.strokeColor(C.accent).lineWidth(0.75)
         .moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).stroke();
      doc.moveDown(0.8);

      withCover.forEach((a) => {
        const nameLineH = 16;
        const coverWidth = CONTENT_W - 12;
        const coverH = doc.heightOfString(a.coverLetter, { width: coverWidth, align: 'left' });
        const blockH = nameLineH + coverH + 22;

        ensureSpace(blockH);

        doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10)
           .text(`${a.fullName}  ·  ${labelFor(a.status)}`, MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(0.15);
        doc.fillColor(C.muted).font('Helvetica').fontSize(8.5)
           .text([a.email, a.phone].filter(Boolean).join('   ·   '), MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(0.35);

        const bodyY = doc.y;
        doc.fillColor(C.ink).font('Helvetica').fontSize(9)
           .text(a.coverLetter, MARGIN + 12, bodyY, { width: coverWidth, align: 'left' });
        const bodyEndY = doc.y;

        doc.strokeColor(C.accentBg).lineWidth(2)
           .moveTo(MARGIN + 4, bodyY).lineTo(MARGIN + 4, bodyEndY).stroke();

        doc.moveDown(1);
      });
    }

    /* ================================================================ */
    /* FOOTER ON EVERY PAGE                                             */
    /* ================================================================ */
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      const footerY = doc.page.height - 30; // Adjusted for landscape margins

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

module.exports = router;