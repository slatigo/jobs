function isExpired(job) {
  if (!job || !job.deadline) return false;
  return new Date(job.deadline).getTime() < Date.now();
}

function isClosed(job) {
  if (!job) return true;
  if (job.status === 'closed') return true;
  return isExpired(job);
}

function closedReason(job) {
  if (!job) return 'not-found';
  if (job.status === 'closed') return 'manually-closed';
  if (isExpired(job)) return 'deadline-passed';
  return null;
}

module.exports = { isExpired, isClosed, closedReason };