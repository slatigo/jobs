const path = require('path');
const { AiScreening, AiJobAnalysis, sequelize } = require('../../models');
const { logStatusChange } = require('../logStatusChange');
const { advertText, advertHash, nextStageKey, rejectStageKey, stageLabel } = require('./advert');
const { prepareDocument } = require('./prepareDocument');
const { normalizeJobAnalysis, normalizeResult } = require('./parseResult');
const { complete, completeJobAnalysis, userPrompt } = require('./provider');
const { activeCredential, present } = require('./settings');
const { UPLOAD_DIR } = require('../../middleware/upload');

function suggestedKey(recommendation, stages, currentKey) {
  if (recommendation === 'advance') return nextStageKey(stages, currentKey);
  if (recommendation === 'do_not_advance') return rejectStageKey(stages);
  return null;
}

function presentJobAnalysis(row, currentHash) {
  if (!row) return null;
  let criteria = [];
  try { criteria = JSON.parse(row.criteriaJson); } catch (err) { criteria = []; }

  const counts = {
    mandatory: criteria.filter((c) => c.group === 'Mandatory').length,
    advantage: criteria.filter((c) => c.group === 'Added advantage').length,
    documents: criteria.filter((c) => c.group === 'Documents submitted').length,
    total: criteria.length
  };

  return {
    id: row.id,
    jobId: row.jobId,
    roleSummary: row.roleSummary,
    criteria,
    counts,
    provider: row.provider,
    model: row.model,
    updatedAt: row.updatedAt,
    isStale: Boolean(currentHash && row.advertHash !== currentHash)
  };
}

async function getJobAnalysis(job, departmentName) {
  const hash = advertHash(job, departmentName);
  const row = await AiJobAnalysis.findOne({ where: { jobId: job.id } });
  return presentJobAnalysis(row, hash);
}

async function analyzeJob({ job, departmentName, userId, force = false }) {
  const hash = advertHash(job, departmentName);
  const existing = await AiJobAnalysis.findOne({ where: { jobId: job.id } });
  if (existing && !force && existing.advertHash === hash) {
    return presentJobAnalysis(existing, hash);
  }

  const cred = await activeCredential();
  const advert = advertText(job, departmentName);
  const raw = await completeJobAnalysis({
    ...cred,
    advert
  });
  const parsed = normalizeJobAnalysis(raw);

  if (existing) {
    existing.advertHash = hash;
    existing.roleSummary = parsed.roleSummary;
    existing.criteriaJson = JSON.stringify(parsed.criteria);
    existing.provider = cred.provider;
    existing.model = cred.model;
    existing.createdByUserId = userId || existing.createdByUserId;
    await existing.save();
    return presentJobAnalysis(existing, hash);
  }

  const created = await AiJobAnalysis.create({
    jobId: job.id,
    advertHash: hash,
    roleSummary: parsed.roleSummary,
    criteriaJson: JSON.stringify(parsed.criteria),
    provider: cred.provider,
    model: cred.model,
    createdByUserId: userId || null
  });
  return presentJobAnalysis(created, hash);
}

async function screenOne({ job, application, stages, departmentName, userId }) {
  const cred = await activeCredential();
  const filename = path.basename(application.attachmentUrl || '');
  if (!filename || /[\\/]/.test(filename) || filename.includes('..')) {
    throw new Error('This application has no stored CV.');
  }

  // Ensure the AI has first read and understood the Job Description
  const jobAnalysis = await analyzeJob({
    job,
    departmentName,
    userId,
    force: false
  });

  const prepared = await prepareDocument(
    path.join(UPLOAD_DIR, filename),
    application.attachmentMime,
    application.attachmentName
  );
  if (prepared.error) throw new Error(prepared.error);

  const nextKey = nextStageKey(stages, application.status);
  const raw = await complete({
    ...cred,
    prompt: userPrompt({
      advert: advertText(job, departmentName),
      jobAnalysis,
      applicant: application,
      stageLabel: stageLabel(stages, application.status),
      nextLabel: nextKey ? stageLabel(stages, nextKey) : ''
    }),
    parts: prepared.parts
  });

  const result = normalizeResult(raw);
  const note = [prepared.note, result.documentNote].filter(Boolean).join(' ');
  const target = suggestedKey(result.recommendation, stages, application.status);

  const row = await AiScreening.create({
    applicationId: application.id,
    jobId: job.id,
    stageKey: application.status,
    recommendation: result.recommendation,
    suggestedStageKey: target,
    summary: result.summary,
    checklistJson: JSON.stringify(result.checklist),
    documentNote: note || null,
    confidence: result.confidence,
    provider: cred.provider,
    model: cred.model,
    createdByUserId: userId
  });

  return present(row);
}

async function decideOne({ application, screening, stages, decision, userId }) {
  if (!screening || screening.applicationId !== application.id) {
    throw new Error('Screen this candidate before accepting a recommendation.');
  }
  if (screening.hrDecision !== 'pending') {
    throw new Error('This recommendation was already decided.');
  }

  if (decision === 'dismiss') {
    screening.hrDecision = 'dismissed';
    screening.decidedByUserId = userId;
    screening.decidedAt = new Date();
    await screening.save();
    return { moved: false, message: 'Recommendation dismissed. The application stage was not changed.' };
  }

  if (decision !== 'accept') throw new Error('Unknown decision.');

  if (screening.recommendation === 'hold' || !screening.suggestedStageKey) {
    screening.hrDecision = 'accepted';
    screening.decidedByUserId = userId;
    screening.decidedAt = new Date();
    await screening.save();
    return { moved: false, message: 'Recommendation accepted as Hold. No stage change was made.' };
  }

  const valid = stages.some((s) => s.key === screening.suggestedStageKey);
  if (!valid) throw new Error('The suggested stage is no longer on this job. Move the candidate with the stage menu.');
  if (screening.suggestedStageKey === application.status) {
    screening.hrDecision = 'accepted';
    screening.decidedByUserId = userId;
    screening.decidedAt = new Date();
    await screening.save();
    return { moved: false, message: 'The candidate is already in that stage.' };
  }

  const fromStatus = application.status;
  const toStatus = screening.suggestedStageKey;
  const reason = `Accepted AI recommendation (${screening.recommendation}). ${screening.summary}`.slice(0, 500);

  await sequelize.transaction(async (t) => {
    application.status = toStatus;
    await application.save({ transaction: t });
    await logStatusChange({
      applicationId: application.id,
      fromStatus,
      toStatus,
      changedByUserId: userId,
      reason,
      source: 'ai-accept',
      transaction: t
    });
    screening.hrDecision = 'accepted';
    screening.decidedByUserId = userId;
    screening.decidedAt = new Date();
    await screening.save({ transaction: t });
  });

  return {
    moved: true,
    toStatus,
    message: `Moved to ${stageLabel(stages, toStatus)} from the AI recommendation.`
  };
}

async function latestMap(applicationIds) {
  if (!applicationIds.length) return {};
  const { Op } = require('sequelize');
  const rows = await AiScreening.findAll({
    where: { applicationId: { [Op.in]: applicationIds } },
    order: [['createdAt', 'DESC']]
  });
  const map = {};
  for (const row of rows) {
    if (!map[row.applicationId]) map[row.applicationId] = present(row);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Server-Side Background Bulk Screening Queue                        */
/* ------------------------------------------------------------------ */
const bulkJobs = new Map();
const BULK_CONCURRENCY = 2;

function getBulkStatus(jobId) {
  return bulkJobs.get(Number(jobId)) || null;
}

function stopBulkJob(jobId) {
  const state = bulkJobs.get(Number(jobId));
  if (state && state.status === 'running') {
    state.stopRequested = true;
  }
  return state || null;
}

function startBulkJob({ job, applications, stages, departmentName, userId }) {
  const jobId = Number(job.id);
  const existing = bulkJobs.get(jobId);
  if (existing && existing.status === 'running') {
    return existing;
  }

  const queue = applications.slice();
  const state = {
    jobId,
    status: 'running',
    total: queue.length,
    completed: 0,
    failed: 0,
    currentNames: [],
    lastError: '',
    startedAt: Date.now(),
    finishedAt: null,
    stopRequested: false
  };
  bulkJobs.set(jobId, state);

  setImmediate(async () => {
    try {
      // Ensure JD rubric is analyzed once before parallel workers start
      await analyzeJob({ job, departmentName, userId, force: false });

      let index = 0;
      const runWorker = async (workerId) => {
        if (workerId > 0) {
          await new Promise((r) => setTimeout(r, workerId * 1200));
        }
        while (!state.stopRequested) {
          const i = index++;
          if (i >= queue.length) break;
          const app = queue[i];
          const name = app.fullName || `#${app.id}`;
          state.currentNames.push(name);
          try {
            await screenOne({ job, application: app, stages, departmentName, userId });
            state.completed++;
          } catch (err) {
            state.failed++;
            state.lastError = `${name}: ${err.message || 'Screening error'}`;
            console.error(`[AI BULK SCREEN] Candidate ${app.id} (${name}) failed:`, err.message);
            if (/no API key is configured/i.test(err.message || '')) {
              state.stopRequested = true;
              break;
            }
          } finally {
            state.currentNames = state.currentNames.filter((n) => n !== name);
          }
        }
      };

      const workerCount = Math.min(BULK_CONCURRENCY, Math.max(1, queue.length));
      await Promise.all(
        Array.from({ length: workerCount }, (_, w) => runWorker(w))
      );

      state.status = state.stopRequested ? 'stopped' : 'completed';
      state.finishedAt = Date.now();
    } catch (err) {
      state.status = 'error';
      state.lastError = err.message || 'Bulk screening stopped unexpectedly.';
      state.finishedAt = Date.now();
      state.currentNames = [];
    }
  });

  return state;
}

module.exports = {
  getJobAnalysis,
  analyzeJob,
  screenOne,
  decideOne,
  latestMap,
  startBulkJob,
  getBulkStatus,
  stopBulkJob
};
