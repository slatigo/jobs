const PDFDocument = require('pdfkit');
const path = require('path');
const { GROUPS } = require('./shortlistData');

const BLUE = '#0070B8';
const NAVY = '#003A70';
const INK = '#1A2332';
const MUTED = '#4A5A6A';
const LINE = '#D6E4F0';
const BAND = '#E8F4FC';
const GOLD = '#F5C400';

function resultLabel(result) {
  return ({
    met: 'Met',
    partial: 'Partial',
    not_met: 'Not met',
    unclear: 'Unclear',
    not_applicable: 'Not applicable'
  })[result] || result || '';
}

function buildPdf({ job, people, counts, groupKey, stream }) {
  const group = GROUPS[groupKey];
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    bufferPages: true,
    margins: { top: 36, bottom: 0, left: 36, right: 36 },
    info: {
      Title: `AI shortlisting report: ${group.short} - ${job.title}`,
      Author: 'Makerere University Business School, Human Resource Directorate',
      Subject: 'AI shortlisting report'
    }
  });
  doc.pipe(stream);

  const M = 36;
  const pageW = () => doc.page.width;
  const contentW = () => pageW() - M * 2;
  const bottom = 48;

  function header(compact) {
    const h = compact ? 86 : 148;
    doc.save();
    doc.rect(0, 0, pageW(), h).fill(BAND);
    try {
      doc.image(path.join(__dirname, '../../public/images/logo.png'), pageW() / 2 - 22, 10, { height: compact ? 22 : 34 });
    } catch (err) { /* logo optional */ }
    const top = compact ? 36 : 50;
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(compact ? 11 : 13)
      .text('MAKERERE UNIVERSITY BUSINESS SCHOOL', M, top, { width: contentW(), align: 'center' });
    doc.fillColor(NAVY).font('Helvetica').fontSize(8)
      .text('HUMAN RESOURCE DIRECTORATE', M, top + 16, { width: contentW(), align: 'center' });
    doc.strokeColor(BLUE).lineWidth(0.75)
      .moveTo(M, top + 30).lineTo(M + contentW(), top + 30).stroke();
    if (!compact) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(12)
        .text(`AI shortlisting report: ${group.title}`, M, top + 38, { width: contentW(), align: 'center' });
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text([
          job.title,
          job.department ? job.department.name : null,
          job.jobRef ? `Ref: ${job.jobRef}` : null,
          `Generated: ${new Date().toISOString().slice(0, 10)}`,
          `${people.length} candidate${people.length === 1 ? '' : 's'}`
        ].filter(Boolean).join('   |   '), M, top + 56, { width: contentW(), align: 'center' });
    }
    doc.restore();
    return h + 14;
  }

  let y = header(false);

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
    .text('Summary for the committee', M, y, { width: contentW() });
  y = doc.y + 4;
  doc.fillColor(INK).font('Helvetica').fontSize(9)
    .text('Each row is the module\'s reading of the advertisement against the application pack. The reason states why the person passed, is for review, or did not meet a requirement.', M, y, { width: contentW() });
  y = doc.y + 8;

  const boxes = [
    ['Pass', counts.pass, '#166534', '#DCF5E8'],
    ['Review', counts.review, '#92400E', '#FFF4D6'],
    ['Fail', counts.fail, '#991B1B', '#FDE8E8'],
    ['Not screened', counts.unscreened, MUTED, '#F3F4F6'],
    ['In this report', people.length, BLUE, BAND]
  ];
  const boxW = (contentW() - 16) / boxes.length;
  boxes.forEach((box, i) => {
    const x = M + i * (boxW + 4);
    doc.roundedRect(x, y, boxW, 36, 4).fill(box[3]);
    doc.fillColor(box[2]).font('Helvetica-Bold').fontSize(14)
      .text(String(box[1]), x, y + 4, { width: boxW, align: 'center' });
    doc.font('Helvetica').fontSize(8)
      .text(box[0], x, y + 22, { width: boxW, align: 'center' });
  });
  y += 48;

  const maxCount = Math.max(counts.pass, counts.review, counts.fail, counts.unscreened, 1);
  const barLabels = [
    ['Pass', counts.pass, '#166534'],
    ['Review', counts.review, '#B45309'],
    ['Fail', counts.fail, '#B91C1C'],
    ['Not screened', counts.unscreened, '#6B7280']
  ];
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
    .text('Distribution across the whole list', M, y);
  y = doc.y + 6;
  barLabels.forEach((bar) => {
    doc.fillColor(INK).font('Helvetica').fontSize(8)
      .text(bar[0], M, y + 1, { width: 80 });
    const track = contentW() - 130;
    doc.roundedRect(M + 86, y, track, 12, 2).fill('#EEF2F6');
    const w = Math.max(bar[1] ? 4 : 0, (bar[1] / maxCount) * track);
    if (w) doc.roundedRect(M + 86, y, w, 12, 2).fill(bar[2]);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
      .text(String(bar[1]), M + 92 + track, y + 1, { width: 30 });
    y += 18;
  });
  y += 8;

  const cols = [
    { label: 'No.', w: 32, align: 'right' },
    { label: 'Applicant', w: 130, align: 'left' },
    { label: 'Contact', w: 150, align: 'left' },
    { label: 'Judgement', w: 78, align: 'left' },
    { label: 'Score', w: 58, align: 'left' },
    { label: 'Confidence', w: 70, align: 'left' },
    { label: 'Reason', w: 0, align: 'left' }
  ];
  const fixed = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
  cols[cols.length - 1].w = contentW() - fixed;

  function drawHead() {
    doc.rect(M, y, contentW(), 18).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    let x = M;
    cols.forEach((c) => {
      doc.text(c.label.toUpperCase(), x + 4, y + 5, { width: c.w - 8, align: c.align, lineBreak: false });
      x += c.w;
    });
    y += 18;
  }

  function newLandscapePage(withTableHead) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
    y = header(true);
    if (withTableHead) drawHead();
  }

  function ensure(h, withTableHead) {
    if (y + h > doc.page.height - bottom) newLandscapePage(withTableHead);
  }

  drawHead();

  if (!people.length) {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(10)
      .text('No applicants in this group.', M, y + 8);
  }

  people.forEach((person, index) => {
    const contact = [person.email, person.phone].filter(Boolean).join('\n');
    const reason = person.summary || '';
    doc.font('Helvetica').fontSize(8);
    const reasonH = doc.heightOfString(reason, { width: cols[6].w - 8 });
    const contactH = doc.heightOfString(contact, { width: cols[2].w - 8 });
    const nameH = doc.heightOfString(person.fullName, { width: cols[1].w - 8 });
    const rowH = Math.max(reasonH, contactH, nameH, 12) + 10;
    ensure(rowH, true);

    if (index % 2 === 0) doc.rect(M, y, contentW(), rowH).fill('#F8FBFE');
    const values = [
      String(index + 1),
      person.fullName,
      contact,
      person.judgement,
      person.scoreLabel || '-',
      person.confidence ? person.confidence.charAt(0).toUpperCase() + person.confidence.slice(1) : '-',
      reason
    ];
    let x = M;
    values.forEach((value, i) => {
      const bold = i === 3;
      doc.fillColor(INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
        .text(value, x + 4, y + 4, { width: cols[i].w - 8, align: cols[i].align });
      x += cols[i].w;
    });
    doc.strokeColor(LINE).lineWidth(0.4)
      .moveTo(M, y + rowH).lineTo(M + contentW(), y + rowH).stroke();
    y += rowH;
  });

  people.forEach((person) => {
    doc.addPage({ size: 'A4', layout: 'portrait', margin: 40 });
    const PM = 40;
    const pw = doc.page.width - PM * 2;
    doc.rect(0, 0, doc.page.width, 72).fill(BAND);
    doc.rect(0, 72, doc.page.width, 3).fill(GOLD);
    try {
      doc.image(path.join(__dirname, '../../public/images/logo.png'), doc.page.width / 2 - 14, 8, { height: 22 });
    } catch (err) { /* optional */ }
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10)
      .text('MAKERERE UNIVERSITY BUSINESS SCHOOL', PM, 32, { width: pw, align: 'center' });
    doc.fillColor(NAVY).font('Helvetica').fontSize(8)
      .text('HUMAN RESOURCE DIRECTORATE', PM, 46, { width: pw, align: 'center' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(`${job.title}${job.jobRef ? '   |   Ref: ' + job.jobRef : ''}`, PM, 58, { width: pw, align: 'center' });

    let cy = 86;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14)
      .text(person.fullName, PM, cy, { width: pw });
    cy = doc.y + 2;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10)
      .text(`${person.judgement}${person.scoreLabel ? '   |   Mandatory requirements met: ' + person.scoreLabel : ''}${person.confidence ? '   |   Confidence: ' + person.confidence : ''}`, PM, cy, { width: pw });
    cy = doc.y + 2;
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text([person.email, person.phone, person.applied ? 'Applied ' + person.applied : '', person.attachmentName ? 'Document: ' + person.attachmentName : ''].filter(Boolean).join('   |   '), PM, cy, { width: pw });
    cy = doc.y + 8;
    doc.fillColor(INK).font('Helvetica').fontSize(9)
      .text(person.summary || '', PM, cy, { width: pw });
    cy = doc.y + 6;
    if (person.documentNote) {
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8)
        .text(person.documentNote, PM, cy, { width: pw });
      cy = doc.y + 8;
    }

    const dcols = [
      { label: 'Category', w: 90 },
      { label: 'Requirement', w: 150 },
      { label: 'Result', w: 62 },
      { label: 'Evidence from the pack', w: 0 }
    ];
    dcols[3].w = pw - 90 - 150 - 62;

    const drawDetailHead = () => {
      doc.rect(PM, cy, pw, 16).fill(NAVY);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      let x = PM;
      dcols.forEach((c) => {
        doc.text(c.label.toUpperCase(), x + 3, cy + 4, { width: c.w - 6, lineBreak: false });
        x += c.w;
      });
      cy += 16;
    };

    const ensureDetail = (h) => {
      if (cy + h > doc.page.height - 46) {
        doc.addPage({ size: 'A4', layout: 'portrait', margin: 40 });
        cy = 40;
        drawDetailHead();
      }
    };

    drawDetailHead();
    if (!person.checklist.length) {
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9)
        .text('No checklist has been saved for this applicant.', PM, cy + 6);
    }
    person.checklist.forEach((item, i) => {
      doc.font('Helvetica').fontSize(8);
      const heights = [
        doc.heightOfString(item.group || '', { width: dcols[0].w - 6 }),
        doc.heightOfString(item.criterion || '', { width: dcols[1].w - 6 }),
        doc.heightOfString(resultLabel(item.result), { width: dcols[2].w - 6 }),
        doc.heightOfString(item.evidence || '', { width: dcols[3].w - 6 })
      ];
      const rh = Math.max(...heights, 10) + 8;
      ensureDetail(rh);
      if (i % 2 === 0) doc.rect(PM, cy, pw, rh).fill('#F8FBFE');
      const vals = [item.group || '', item.criterion || '', resultLabel(item.result), item.evidence || ''];
      let x = PM;
      vals.forEach((value, col) => {
        doc.fillColor(INK).font(col === 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
          .text(value, x + 3, cy + 3, { width: dcols[col].w - 6 });
        x += dcols[col].w;
      });
      doc.strokeColor(LINE).lineWidth(0.3)
        .moveTo(PM, cy + rh).lineTo(PM + pw, cy + rh).stroke();
      cy += rh;
    });
  });

  const range = doc.bufferedPageRange();
  const pageTotal = range.count;
  for (let p = range.start; p < range.start + pageTotal; p++) {
    doc.switchToPage(p);
    const footerY = doc.page.height - 22;
    const width = doc.page.width - M * 2;
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text('Makerere University Business School  |  Human Resource Directorate', M, footerY, {
      width: width * 0.72,
      height: 12,
      lineBreak: false,
      ellipsis: true
    });
    doc.text(`Page ${p - range.start + 1} of ${pageTotal}`, M, footerY, {
      width,
      height: 12,
      align: 'right',
      lineBreak: false
    });
  }

  doc.end();
}

module.exports = { buildPdf };
