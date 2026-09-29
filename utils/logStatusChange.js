/**
 * utils/logStatusChange.js
 *
 * Writes an audit-trail row every time an application's status changes.
 *
 * Why this exists:
 *   - Status changes are irreversible decisions (shortlist, accept, reject).
 *   - HR mistakes need to be traceable: who did it, when, and why.
 *   - Reports need funnel data: how many went shortlisted → accepted, etc.
 *
 * Every status change (single or bulk) MUST call this inside the same
 * transaction that updates the Application row, so both succeed or
 * both roll back.
 */

const { ApplicationStatusHistory } = require('../models');

/**
 * Write a single history row.
 *
 * @param {Object}   opts
 * @param {number}   opts.applicationId    - The application being changed
 * @param {string|null} opts.fromStatus    - Previous status, null on first insert
 * @param {string}   opts.toStatus         - New status
 * @param {number|null} opts.changedByUserId - The user making the change
 * @param {string}   [opts.reason]         - Optional free-text note
 * @param {string}   [opts.source]         - 'single' | 'bulk-pending' | 'submit' | ...
 * @param {Object}   [opts.transaction]    - Sequelize transaction (recommended)
 * @returns {Promise<ApplicationStatusHistory|null>}
 */
async function logStatusChange(opts) {
  const {
    applicationId,
    fromStatus = null,
    toStatus,
    changedByUserId = null,
    reason = null,
    source = 'single',
    transaction
  } = opts || {};

  // Sanity checks — a silent failure here would break the audit trail
  if (!applicationId) {
    throw new Error('[logStatusChange] applicationId is required');
  }
  if (!toStatus) {
    throw new Error('[logStatusChange] toStatus is required');
  }

  // No-op changes aren't worth recording
  if (fromStatus === toStatus) {
    return null;
  }

  return ApplicationStatusHistory.create(
    {
      applicationId,
      fromStatus,
      toStatus,
      changedByUserId: changedByUserId || null,
      reason: reason ? String(reason).slice(0, 500) : null,
      source: source ? String(source).slice(0, 60) : 'single'
    },
    { transaction }
  );
}

/**
 * Write many history rows in bulk — used by bulk-reject.
 *
 * @param {Array<{applicationId, fromStatus, toStatus, changedByUserId, reason, source}>} entries
 * @param {Object} [transaction]
 * @returns {Promise<number>} rows inserted
 */
async function logStatusChangeBulk(entries, transaction) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;

  const payload = entries
    .filter((e) => e && e.applicationId && e.toStatus)
    .filter((e) => e.fromStatus !== e.toStatus)
    .map((e) => ({
      applicationId: e.applicationId,
      fromStatus: e.fromStatus || null,
      toStatus: e.toStatus,
      changedByUserId: e.changedByUserId || null,
      reason: e.reason ? String(e.reason).slice(0, 500) : null,
      source: e.source ? String(e.source).slice(0, 60) : 'bulk'
    }));

  if (payload.length === 0) return 0;

  await ApplicationStatusHistory.bulkCreate(payload, { transaction });
  return payload.length;
}

module.exports = { logStatusChange, logStatusChangeBulk };