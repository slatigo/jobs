const ExcelJS = require('exceljs');
const path = require('path');
const { GROUPS } = require('./shortlistData');

const BLUE = 'FF0070B8';
const NAVY = 'FF003A70';
const GOLD = 'FFF5C400';
const INK = 'FF1A2332';
const MUTED = 'FF4A5A6A';
const WHITE = 'FFFFFFFF';
const BAND = 'FFE8F4FC';
const GREEN = 'FFDCF5E8';
const AMBER = 'FFFFF4D6';
const RED = 'FFFDE8E8';
const LINE = 'FFD6E4F0';

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function judgementFill(code) {
  if (code === 'pass') return GREEN;
  if (code === 'hold') return AMBER;
  if (code === 'fail') return RED;
  return 'FFF3F4F6';
}

function resultFill(result) {
  if (result === 'met') return GREEN;
  if (result === 'partial' || result === 'unclear') return AMBER;
  if (result === 'not_met') return RED;
  return 'FFF8FAFC';
}

function thinBorder() {
  const edge = { style: 'thin', color: { argb: LINE } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function applyHeader(sheet, lastCol, title, subtitle) {
  sheet.mergeCells(1, 1, 1, lastCol);
  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.mergeCells(3, 1, 3, lastCol);
  sheet.mergeCells(4, 1, 4, lastCol);
  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 22;
  sheet.getRow(4).height = 32;

  const school = sheet.getCell(1, 1);
  school.value = 'MAKERERE UNIVERSITY BUSINESS SCHOOL';
  school.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  school.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  school.fill = fill(BLUE);

  const dir = sheet.getCell(2, 1);
  dir.value = 'HUMAN RESOURCE DIRECTORATE';
  dir.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
  dir.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dir.fill = fill(GOLD);

  const heading = sheet.getCell(3, 1);
  heading.value = title;
  heading.font = { name: 'Calibri', size: 16, bold: true, color: { argb: NAVY } };
  heading.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const sub = sheet.getCell(4, 1);
  sub.value = subtitle;
  sub.font = { name: 'Calibri', size: 11, color: { argb: MUTED } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };

  for (let col = 1; col <= lastCol; col++) {
    sheet.getCell(1, col).fill = fill(BLUE);
    sheet.getCell(2, col).fill = fill(GOLD);
  }

  try {
    if (sheet.workbook.__mubsLogoId == null) {
      const logo = path.join(__dirname, '../../public/images/logo.png');
      sheet.workbook.__mubsLogoId = sheet.workbook.addImage({ filename: logo, extension: 'png' });
    }
    sheet.addImage(sheet.workbook.__mubsLogoId, {
      tl: { col: lastCol - 1, row: 0 },
      ext: { width: 46, height: 46 }
    });
  } catch (err) {
    /* logo is optional */
  }
}

function styleHeaderRow(row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = fill(NAVY);
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = thinBorder();
  });
}

function sheetName(index, name) {
  const clean = String(name || 'Candidate')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const prefix = String(index).padStart(2, '0') + ' ';
  return (prefix + clean).slice(0, 31);
}

async function buildWorkbook({ job, people, counts, groupKey }) {
  const group = GROUPS[groupKey];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Makerere University Business School';
  workbook.company = 'Human Resource Directorate';
  workbook.created = new Date();
  workbook.title = `${group.title} - ${job.title}`;

  const subtitle = [
    job.title,
    job.department ? job.department.name : '',
    job.jobRef ? `Ref: ${job.jobRef}` : '',
    `Generated ${new Date().toISOString().slice(0, 10)}`,
    `${people.length} candidate${people.length === 1 ? '' : 's'}`
  ].filter(Boolean).join('   |   ');

  const summary = workbook.addWorksheet('Summary', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true
    },
    headerFooter: {
      oddFooter: '&LMakerere University Business School  |  Human Resource Directorate&RPage &P of &N'
    },
    views: [{ state: 'frozen', ySplit: 12, showGridLines: false }]
  });

  applyHeader(summary, 8, `AI shortlisting report: ${group.short}`, subtitle);
  summary.getRow(5).height = 8;

  summary.getCell('A6').value = 'Reading of this list';
  summary.getCell('A6').font = { name: 'Calibri', size: 12, bold: true, color: { argb: NAVY } };
  summary.mergeCells('A7:H8');
  summary.getCell('A7').value = 'This workbook sets out the reading of the vacancy advertisement against each application pack in this group. The summary gives the judgement and the reason. Each following sheet sets out one candidate against the requirements taken from the advertisement.';
  summary.getCell('A7').alignment = { wrapText: true, vertical: 'top' };
  summary.getCell('A7').font = { name: 'Calibri', size: 11, color: { argb: INK } };

  const analysis = workbook.addWorksheet('Analysis', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    views: [{ showGridLines: false }]
  });
  applyHeader(analysis, 4, 'Analysis of AI judgements', subtitle);
  analysis.getColumn(1).width = 28;
  analysis.getColumn(2).width = 16;
  analysis.getColumn(3).width = 16;
  analysis.getColumn(4).width = 42;

  const analysisHead = analysis.getRow(6);
  analysisHead.values = ['Judgement', 'Number', 'Share of list', ''];
  styleHeaderRow(analysisHead);
  const analysisRows = [
    ['Pass', counts.pass],
    ['Review', counts.review],
    ['Fail', counts.fail],
    ['Not screened', counts.unscreened]
  ];
  const total = counts.all || 1;
  analysisRows.forEach((entry, i) => {
    const row = analysis.getRow(7 + i);
    const share = counts.all ? `${Math.round((entry[1] / total) * 100)}%` : '0%';
    row.values = [entry[0], entry[1], share, ''];
    row.font = { name: 'Calibri', size: 12 };
    row.getCell(1).font = { name: 'Calibri', size: 12, bold: true };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.height = 22;
    row.eachCell((cell) => { cell.border = thinBorder(); });
  });
  analysis.addConditionalFormatting({
    ref: 'B7:B10',
    rules: [{
      type: 'dataBar',
      cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
      color: { argb: 'FF0070B8' },
      gradient: false
    }]
  });
  analysis.getCell('A12').value = 'How to read the bars';
  analysis.getCell('A12').font = { name: 'Calibri', size: 12, bold: true, color: { argb: NAVY } };
  analysis.mergeCells('A13:D14');
  analysis.getCell('A13').value = 'The bars compare how many applicants in the whole list fall into each judgement. This sheet is the picture of the list. The Summary sheet is the list itself, with the reason for each person. The later sheets are the requirement-by-requirement reading.';
  analysis.getCell('A13').alignment = { wrapText: true, vertical: 'top' };
  analysis.getCell('A13').font = { name: 'Calibri', size: 11 };

  const headers = ['No.', 'Applicant', 'Email', 'Phone', 'Judgement', 'Mandatory score', 'Confidence', 'Reason'];
  const head = summary.getRow(12);
  head.values = headers;
  styleHeaderRow(head);
  summary.autoFilter = { from: 'A12', to: 'H12' };
  summary.views = [{ state: 'frozen', ySplit: 12, showGridLines: false }];

  const widths = [6, 28, 34, 18, 18, 18, 14, 72];
  widths.forEach((w, i) => { summary.getColumn(i + 1).width = w; });

  people.forEach((person, index) => {
    const row = summary.getRow(13 + index);
    row.values = [
      index + 1,
      person.fullName,
      person.email,
      person.phone,
      person.judgement,
      person.scoreLabel,
      person.confidence ? person.confidence.charAt(0).toUpperCase() + person.confidence.slice(1) : '',
      person.summary
    ];
    row.font = { name: 'Calibri', size: 11, color: { argb: INK } };
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = Math.min(90, Math.max(22, Math.ceil(String(person.summary || '').length / 90) * 16));
    row.eachCell((cell, col) => {
      cell.border = thinBorder();
      if (col === 5) {
        cell.fill = fill(judgementFill(person.judgementCode));
        cell.font = { name: 'Calibri', size: 11, bold: true };
      }
    });
  });

  if (!people.length) {
    summary.mergeCells('A13:H13');
    summary.getCell('A13').value = 'No applicants in this group.';
    summary.getCell('A13').font = { name: 'Calibri', size: 12, italic: true, color: { argb: MUTED } };
  }

  summary.pageSetup.printTitlesRow = '1:12';

  const usedNames = new Set(['Summary', 'Analysis']);
  people.forEach((person, index) => {
    let name = sheetName(index + 1, person.fullName);
    while (usedNames.has(name)) name = sheetName(index + 1, `${person.fullName} ${person.id}`);
    usedNames.add(name);

    const sheet = workbook.addWorksheet(name, {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      },
      headerFooter: {
        oddFooter: '&LMakerere University Business School&C' + person.fullName + '&RPage &P of &N'
      },
      views: [{ showGridLines: false }]
    });

    applyHeader(sheet, 4, person.fullName, `${person.judgement}${person.scoreLabel ? '  |  Mandatory requirements met: ' + person.scoreLabel : ''}  |  ${job.title}`);
    const metaWidths = [28, 42, 22, 55];
    metaWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    const facts = [
      ['Email', person.email],
      ['Phone', person.phone || ''],
      ['Applied', person.applied],
      ['Judgement', person.judgement],
      ['Mandatory score', person.scoreLabel || 'Not screened'],
      ['Confidence', person.confidence || ''],
      ['Officer decision on the recommendation', person.hrDecision || 'Pending']
    ];
    facts.forEach((pair, i) => {
      const row = sheet.getRow(6 + i);
      row.getCell(1).value = pair[0];
      row.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
      row.getCell(2).value = pair[1];
      row.getCell(2).font = { name: 'Calibri', size: 11 };
      row.height = 18;
    });

    sheet.mergeCells('A14:D16');
    sheet.getCell('A14').value = person.summary;
    sheet.getCell('A14').alignment = { wrapText: true, vertical: 'top' };
    sheet.getCell('A14').font = { name: 'Calibri', size: 11 };
    sheet.getCell('A13').value = 'Summary';
    sheet.getCell('A13').font = { name: 'Calibri', size: 12, bold: true, color: { argb: NAVY } };

    if (person.documentNote) {
      sheet.getCell('A17').value = 'Documents and scans';
      sheet.getCell('A17').font = { name: 'Calibri', size: 12, bold: true, color: { argb: NAVY } };
      sheet.mergeCells('A18:D19');
      sheet.getCell('A18').value = person.documentNote;
      sheet.getCell('A18').alignment = { wrapText: true, vertical: 'top' };
      sheet.getCell('A18').font = { name: 'Calibri', size: 11 };
    }

    const tableStart = person.documentNote ? 21 : 18;
    const tableHead = sheet.getRow(tableStart);
    tableHead.values = ['Category', 'Requirement from the advertisement', 'Result', 'Evidence from the application pack'];
    styleHeaderRow(tableHead);
    sheet.views = [{ state: 'frozen', ySplit: tableStart, showGridLines: false }];

    if (!person.checklist.length) {
      sheet.mergeCells(tableStart + 1, 1, tableStart + 1, 4);
      sheet.getCell(tableStart + 1, 1).value = 'No checklist has been saved for this applicant.';
      sheet.getCell(tableStart + 1, 1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: MUTED } };
    } else {
      person.checklist.forEach((item, i) => {
        const row = sheet.getRow(tableStart + 1 + i);
        const resultLabel = ({
          met: 'Met',
          partial: 'Partial',
          not_met: 'Not met',
          unclear: 'Unclear',
          not_applicable: 'Not applicable'
        })[item.result] || item.result;
        row.values = [item.group || '', item.criterion || '', resultLabel, item.evidence || ''];
        row.font = { name: 'Calibri', size: 11 };
        row.alignment = { vertical: 'top', wrapText: true };
        row.height = Math.min(72, Math.max(20, Math.ceil(String(item.evidence || item.criterion || '').length / 55) * 15));
        row.eachCell((cell, col) => {
          cell.border = thinBorder();
          if (col === 3) cell.fill = fill(resultFill(item.result));
        });
      });
    }
  });

  return workbook;
}

module.exports = { buildWorkbook };
