const express = require('express');
const router = express.Router({ mergeParams: true });
const ExcelJS = require('exceljs');
const { Job, Application, JobStage, Department, AiScreening } = require('../../models');
const { isAuthenticated } = require('../../middleware/auth');
const { analyzeJob, getJobAnalysis, screenOne, decideOne, latestMap, startBulkJob, getBulkStatus, stopBulkJob } = require('../../utils/ai/screen');
const { stageLabel } = require('../../utils/ai/advert');

async function loadJob(req, res) {
  const job = await Job.findByPk(req.params.id, {
    include: [{ model: Department, as: 'department' }]
  });
  if (!job) {
    res.status(404).json({ ok: false, error: 'Job not found.' });
    return null;
  }
  const isPoster = req.session.user.id === job.userId;
  const isAdmin = req.session.user.role === 'admin';
  if (!isPoster && !isAdmin) {
    res.status(403).json({ ok: false, error: 'You are not allowed to screen applications for this job.' });
    return null;
  }
  return job;
}

async function stagesFor(job) {
  const rows = await JobStage.findAll({ where: { jobId: job.id }, order: [['order', 'ASC']] });
  if (!rows.length) return Job.DEFAULT_STAGES;
  return rows.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    order: s.order,
    isTerminal: s.isTerminal
  }));
}

router.post('/ai/analyze-job', isAuthenticated, async (req, res) => {
  try {
    const job = await loadJob(req, res);
    if (!job) return;

    const force = req.body.force === true || req.body.force === '1' || req.body.force === 'true';
    const analysis = await analyzeJob({
      job,
      departmentName: job.department ? job.department.name : '',
      userId: req.session.user.id,
      force
    });

    res.json({ ok: true, analysis });
  } catch (err) {
    console.error('[AI ANALYZE JOB]', err.message);
    res.status(400).json({ ok: false, error: err.message || 'Could not analyze job description.' });
  }
});

router.post('/ai/screen', isAuthenticated, async (req, res) => {
  try {
    const job = await loadJob(req, res);
    if (!job) return;

    const application = await Application.findOne({
      where: { id: req.body.applicationId, jobId: job.id }
    });
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found.' });

    const stages = await stagesFor(job);
    const screening = await screenOne({
      job,
      application,
      stages,
      departmentName: job.department ? job.department.name : '',
      userId: req.session.user.id
    });
    screening.suggestedStageLabel = screening.suggestedStageKey
      ? stageLabel(stages, screening.suggestedStageKey)
      : '';
    res.json({ ok: true, screening });
  } catch (err) {
    console.error('[AI SCREEN]', err.message);
    res.status(400).json({ ok: false, error: err.message || 'Screening failed.' });
  }
});

router.post('/ai/bulk-start', isAuthenticated, async (req, res) => {
  try {
    const job = await loadJob(req, res);
    if (!job) return;

    const stages = await stagesFor(job);
    const allApps = await Application.findAll({
      where: { jobId: job.id },
      order: [['createdAt', 'DESC']]
    });

    const requestedIds = Array.isArray(req.body.applicationIds)
      ? req.body.applicationIds.map((id) => Number(id)).filter(Boolean)
      : [];

    let targetApps = [];
    if (requestedIds.length > 0) {
      const idSet = new Set(requestedIds);
      targetApps = allApps.filter((a) => idSet.has(Number(a.id)));
    } else {
      const existingMap = await latestMap(allApps.map((a) => a.id));
      const unscreened = allApps.filter((a) => !existingMap[a.id]);
      targetApps = unscreened.length > 0 ? unscreened : allApps;
    }

    if (!targetApps.length) {
      return res.status(400).json({ ok: false, error: 'No applications found to screen.' });
    }

    const state = startBulkJob({
      job,
      applications: targetApps,
      stages,
      departmentName: job.department ? job.department.name : '',
      userId: req.session.user.id
    });

    res.json({ ok: true, state });
  } catch (err) {
    console.error('[AI BULK START]', err.message);
    res.status(400).json({ ok: false, error: err.message || 'Could not start bulk screening.' });
  }
});

router.get('/ai/bulk-status', isAuthenticated, async (req, res) => {
  try {
    const job = await loadJob(req, res);
    if (!job) return;

    const allApps = await Application.findAll({
      where: { jobId: job.id },
      attributes: ['id']
    });
    const appIds = allApps.map((a) => a.id);
    const screenings = await latestMap(appIds);

    const counts = { pass: 0, hold: 0, fail: 0, unscreened: 0 };
    for (const id of appIds) {
      const s = screenings[id];
      if (!s) counts.unscreened++;
      else if (s.judgementCode === 'pass') counts.pass++;
      else if (s.judgementCode === 'hold') counts.hold++;
      else if (s.judgementCode === 'fail') counts.fail++;
    }

    res.json({
      ok: true,
      state: getBulkStatus(job.id),
      screenings,
      counts
    });
  } catch (err) {
    console.error('[AI BULK STATUS]', err.message);
    res.status(400).json({ ok: false, error: err.message || 'Could not fetch bulk status.' });
  }
});

router.post('/ai/bulk-stop', isAuthenticated, async (req, res) => {
  try {
    const job = await loadJob(req, res);
    if (!job) return;
    const state = stopBulkJob(job.id);
    res.json({ ok: true, state });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'Could not stop bulk screening.' });
  }
});

router.post('/ai/decide', isAuthenticated, async (req, res) => {
  try {
    const job = await loadJob(req, res);
    if (!job) return;

    const application = await Application.findOne({
      where: { id: req.body.applicationId, jobId: job.id }
    });
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found.' });

    const screening = await AiScreening.findOne({
      where: { applicationId: application.id, jobId: job.id },
      order: [['createdAt', 'DESC']]
    });
    const stages = await stagesFor(job);
    const result = await decideOne({
      application,
      screening,
      stages,
      decision: req.body.decision,
      userId: req.session.user.id
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[AI DECIDE]', err.message);
    res.status(400).json({ ok: false, error: err.message || 'Could not apply the recommendation.' });
  }
});

router.get('/ai/export.xlsx', isAuthenticated, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [{ model: Department, as: 'department' }]
    });
    if (!job) return res.status(404).send('Job not found.');
    const isPoster = req.session.user.id === job.userId;
    const isAdmin = req.session.user.role === 'admin';
    if (!isPoster && !isAdmin) return res.status(403).send('Access denied.');

    const stages = await stagesFor(job);
    const where = { jobId: job.id };
    const status = String(req.query.status || 'all').toLowerCase();
    if (status !== 'all' && stages.some((s) => s.key === status)) where.status = status;

    const [applications, jobAnalysis] = await Promise.all([
      Application.findAll({ where, order: [['fullName', 'ASC']] }),
      getJobAnalysis(job, job.department ? job.department.name : '')
    ]);
    const ai = await latestMap(applications.map((a) => a.id));

    const criteria = [];
    if (jobAnalysis && Array.isArray(jobAnalysis.criteria)) {
      for (const item of jobAnalysis.criteria) {
        const key = `${item.group}: ${item.criterion}`;
        if (!criteria.includes(key)) criteria.push(key);
      }
    }
    for (const app of applications) {
      const screening = ai[app.id];
      if (!screening) continue;
      for (const item of screening.checklist) {
        const key = `${item.group}: ${item.criterion}`;
        if (!criteria.includes(key)) criteria.push(key);
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('AI Shortlisting Report');
    const headers = [
      'Applicant',
      'Email',
      'Phone',
      'Current Stage',
      'AI Judgement',
      'Recommendation',
      'Mandatory Criteria Met',
      'Suggested Next Stage',
      'Confidence',
      'HR Decision',
      'AI Executive Summary',
      'Document / OCR Notes',
      ...criteria
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    const recLabels = { advance: 'Advance', hold: 'Hold', do_not_advance: 'Do not advance' };
    const judgeLabels = { advance: 'PASS (Eligible)', hold: 'HOLD (Review)', do_not_advance: 'FAIL (Not Eligible)' };

    for (const app of applications) {
      const screening = ai[app.id];
      const byKey = {};
      if (screening) {
        for (const item of screening.checklist) {
          byKey[`${item.group}: ${item.criterion}`] = `${item.result.toUpperCase()}: ${item.evidence || ''}`.trim();
        }
      }
      sheet.addRow([
        app.fullName,
        app.email,
        app.phone,
        stageLabel(stages, app.status),
        screening ? judgeLabels[screening.recommendation] : 'Not Screened',
        screening ? recLabels[screening.recommendation] : '',
        screening && screening.mandatoryTotal ? `${screening.mandatoryMet}/${screening.mandatoryTotal}` : '',
        screening && screening.suggestedStageKey ? stageLabel(stages, screening.suggestedStageKey) : '',
        screening ? screening.confidence : '',
        screening ? screening.hrDecision : '',
        screening ? screening.summary : '',
        screening ? (screening.documentNote || '') : '',
        ...criteria.map((key) => byKey[key] || '')
      ]);
    }

    sheet.columns.forEach((col) => { col.width = 28; });
    const safe = String(job.jobRef || job.id).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ai-screening-${safe}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[AI EXPORT]', err.message);
    if (!res.headersSent) res.status(500).send('Could not export the AI report.');
  }
});

module.exports = router;
