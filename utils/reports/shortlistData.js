const { Job, Application, JobStage, Department } = require('../../models');
const { latestMap } = require('../ai/screen');

const GROUPS = {
  pass: { key: 'pass', title: 'Candidates who passed', short: 'Pass', recommendation: 'advance' },
  review: { key: 'review', title: 'Candidates for review', short: 'Review', recommendation: 'hold' },
  fail: { key: 'fail', title: 'Candidates who did not meet the requirements', short: 'Fail', recommendation: 'do_not_advance' },
  all: { key: 'all', title: 'All candidates', short: 'All', recommendation: null }
};

function labelFor(recommendation) {
  if (recommendation === 'advance') return 'Pass';
  if (recommendation === 'hold') return 'Review';
  if (recommendation === 'do_not_advance') return 'Fail';
  return 'Not screened';
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function loadShortlist(jobId) {
  const job = await Job.findByPk(jobId, {
    include: [{ model: Department, as: 'department' }]
  });
  if (!job) return null;

  const stageRows = await JobStage.findAll({
    where: { jobId: job.id },
    order: [['order', 'ASC']]
  });
  const stages = stageRows.length
    ? stageRows.map((s) => ({ key: s.key, label: s.label }))
    : Job.DEFAULT_STAGES;

  const applications = await Application.findAll({
    where: { jobId: job.id },
    order: [['fullName', 'ASC']]
  });
  const ai = await latestMap(applications.map((a) => a.id));

  const people = applications.map((app) => {
    const screening = ai[app.id] || null;
    return {
      id: app.id,
      fullName: app.fullName,
      email: app.email,
      phone: app.phone || '',
      applied: formatDate(app.createdAt),
      recommendation: screening ? screening.recommendation : null,
      judgement: screening ? screening.judgement : 'Not screened',
      judgementCode: screening ? screening.judgementCode : 'unscreened',
      mandatoryMet: screening ? screening.mandatoryMet : null,
      mandatoryTotal: screening ? screening.mandatoryTotal : null,
      scoreLabel: screening && screening.mandatoryTotal
        ? `${screening.mandatoryMet} of ${screening.mandatoryTotal}`
        : '',
      confidence: screening ? screening.confidence : '',
      summary: screening ? screening.summary : 'This application has not been screened.',
      documentNote: screening ? (screening.documentNote || '') : '',
      checklist: screening ? screening.checklist : [],
      hrDecision: screening ? screening.hrDecision : ''
    };
  });

  const counts = {
    pass: people.filter((p) => p.recommendation === 'advance').length,
    review: people.filter((p) => p.recommendation === 'hold').length,
    fail: people.filter((p) => p.recommendation === 'do_not_advance').length,
    unscreened: people.filter((p) => !p.recommendation).length,
    all: people.length
  };

  return { job, stages, people, counts };
}

function peopleInGroup(people, groupKey) {
  const group = GROUPS[groupKey];
  if (!group) return [];
  const rows = group.recommendation
    ? people.filter((p) => p.recommendation === group.recommendation)
    : people.slice();
  const rank = { advance: 0, hold: 1, do_not_advance: 2 };
  rows.sort((a, b) => {
    const ra = rank[a.recommendation] ?? 3;
    const rb = rank[b.recommendation] ?? 3;
    if (ra !== rb) return ra - rb;
    const sa = a.mandatoryMet == null ? -1 : a.mandatoryMet;
    const sb = b.mandatoryMet == null ? -1 : b.mandatoryMet;
    if (sa !== sb) return sb - sa;
    return a.fullName.localeCompare(b.fullName);
  });
  return rows;
}

function canManage(user, job) {
  if (!user || !job) return false;
  return user.role === 'admin' || user.id === job.userId;
}

module.exports = {
  GROUPS,
  labelFor,
  loadShortlist,
  peopleInGroup,
  canManage
};
