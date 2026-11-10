const crypto = require('crypto');

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function advertText(job, departmentName) {
  const lines = [
    `Title: ${job.title}`,
    job.jobRef ? `Reference: ${job.jobRef}` : '',
    departmentName ? `Department: ${departmentName}` : '',
    job.location ? `Location: ${job.location}` : '',
    job.type ? `Type: ${job.type}` : '',
    job.contractTerms ? `Contract: ${job.contractTerms}` : '',
    job.grade ? `Grade: ${job.grade}` : '',
    job.vacancies ? `Vacancies: ${job.vacancies}` : '',
    '',
    htmlToText(job.description)
  ].filter(Boolean);

  const text = lines.join('\n');
  if (text.length <= 30000) return text;
  return `${text.slice(0, 30000)}\n\n[Advert truncated]`;
}

function advertHash(job, departmentName) {
  return crypto
    .createHash('sha256')
    .update(advertText(job, departmentName))
    .digest('hex');
}

function nextStageKey(stages, currentKey) {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const idx = ordered.findIndex((s) => s.key === currentKey);
  if (idx < 0 || idx >= ordered.length - 1) return null;
  const candidate = ordered[idx + 1];
  if (candidate.key === 'rejected') return null;
  return candidate.key;
}

function rejectStageKey(stages) {
  const rejected = stages.find((s) => s.key === 'rejected');
  if (rejected) return rejected.key;
  const danger = stages.find((s) => s.isTerminal && s.color === 'danger');
  return danger ? danger.key : null;
}

function stageLabel(stages, key) {
  const found = stages.find((s) => s.key === key);
  return found ? found.label : key;
}

module.exports = {
  htmlToText,
  advertText,
  advertHash,
  nextStageKey,
  rejectStageKey,
  stageLabel
};
