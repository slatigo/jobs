const GROUPS = new Set(['Mandatory', 'Added advantage', 'Documents submitted', 'Other']);
const RESULTS = new Set(['met', 'partial', 'not_met', 'unclear', 'not_applicable']);
const RECS = new Set(['advance', 'hold', 'do_not_advance']);
const CONF = new Set(['high', 'medium', 'low']);

function parseModelJson(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('The AI model did not return valid JSON.');
  }
}

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeJobAnalysis(raw) {
  const parsed = parseModelJson(raw);
  const rawCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];
  const criteria = rawCriteria.slice(0, 40).map((item) => {
    const group = GROUPS.has(item.group) ? item.group : 'Mandatory';
    return {
      group,
      criterion: clip(item.criterion, 240),
      details: clip(item.details || item.requirement || '', 320)
    };
  }).filter((item) => item.criterion);

  if (criteria.length === 0) {
    throw new Error('The AI model could not extract screening criteria from this job description.');
  }

  return {
    roleSummary: clip(parsed.roleSummary || parsed.summary, 1200) || 'Job description analyzed for candidate shortlisting.',
    criteria
  };
}

function normalizeResult(raw) {
  const parsed = parseModelJson(raw);
  const checklist = Array.isArray(parsed.checklist) ? parsed.checklist : [];
  const clean = checklist.slice(0, 40).map((item) => {
    const result = RESULTS.has(item.result) ? item.result : 'unclear';
    const group = GROUPS.has(item.group) ? item.group : 'Other';
    return {
      group,
      criterion: clip(item.criterion, 240) || 'Requirement',
      result,
      evidence: clip(item.evidence, 400)
    };
  }).filter((item) => item.criterion);

  if (clean.length === 0) {
    throw new Error('The AI model returned an empty checklist.');
  }

  return {
    recommendation: RECS.has(parsed.recommendation) ? parsed.recommendation : 'hold',
    summary: clip(parsed.summary, 1200) || 'No summary returned.',
    confidence: CONF.has(parsed.confidence) ? parsed.confidence : 'low',
    documentNote: clip(parsed.documentNotes || parsed.documentNote, 1500),
    checklist: clean
  };
}

module.exports = { parseModelJson, normalizeJobAnalysis, normalizeResult };
