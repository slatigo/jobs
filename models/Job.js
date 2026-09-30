const { DataTypes, Op } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
const JOB_TYPES = ['Full-time', 'Part-time'];
const CONTRACT_TERMS = ['Permanent', 'Contract'];
const VISIBILITY = ['public', 'internal'];

const REF_CATEGORIES = [
  { code: 'ADM', label: 'Administrative' },
  { code: 'ACA', label: 'Academic' },
  { code: 'SUP', label: 'Support' },
  { code: 'TEC', label: 'Technical' },
  { code: 'INT', label: 'Internal' },
  { code: 'GEN', label: 'General' }
];

/* ------------------------------------------------------------------ */
/* Default stage template — fallback when a job has no rows in         */
/* job_stages (legacy jobs, or a job created without a custom workflow) */
/* ------------------------------------------------------------------ */
const DEFAULT_STAGES = [
  { key: 'pending',     label: 'Pending',     color: 'warning', order: 0, isTerminal: false },
  { key: 'reviewed',    label: 'Reviewed',    color: 'primary', order: 1, isTerminal: false },
  { key: 'shortlisted', label: 'Shortlisted', color: 'info',    order: 2, isTerminal: false },
  { key: 'interviewed', label: 'Interviewed', color: 'info',    order: 3, isTerminal: false },
  { key: 'accepted',    label: 'Accepted',    color: 'success', order: 4, isTerminal: true  },
  { key: 'rejected',    label: 'Rejected',    color: 'danger',  order: 5, isTerminal: true  }
];

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */
const Job = sequelize.define('Job', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  /* Reference ------------------------------------------------------- */
  jobRef: {
    type: DataTypes.STRING(60),
    allowNull: true,
    unique: false             // uniqueness enforced by app logic
  },
  refCategory: {
    type: DataTypes.ENUM('ADM', 'ACA', 'SUP', 'TEC', 'INT', 'GEN'),
    allowNull: false,
    defaultValue: 'GEN'
  },

  /* Core ------------------------------------------------------------ */
  title: { type: DataTypes.STRING(180), allowNull: false },

  departmentId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'departments', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },

  location: {
    type: DataTypes.STRING(150),
    defaultValue: 'MUBS Main Campus, Nakawa'
  },
  type: {
    type: DataTypes.ENUM(...JOB_TYPES),
    defaultValue: 'Full-time'
  },
  contractTerms: {
    type: DataTypes.ENUM(...CONTRACT_TERMS),
    defaultValue: 'Permanent'
  },
  grade: { type: DataTypes.STRING(30), allowNull: true },
  vacancies: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },

  /* Content --------------------------------------------------------- */
  description: { type: DataTypes.TEXT('long'), allowNull: false },

  /* Application details -------------------------------------------- */
  deadline: { type: DataTypes.DATE, allowNull: false },
  contactEmail: {
    type: DataTypes.STRING(160),
    allowNull: false,
    validate: { isEmail: true }
  },
  contactPhone: { type: DataTypes.STRING(30) },

  /* Ownership & status --------------------------------------------- */
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  featured: { type: DataTypes.BOOLEAN, defaultValue: false },
  views: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('active', 'closed'),
    defaultValue: 'active'
  },

  /* Shareable short code ------------------------------------------- */
  shortCode: {
    type: DataTypes.STRING(12),
    allowNull: true,
    unique: true
  },

  /* Internal vs public --------------------------------------------- */
  visibility: {
    type: DataTypes.ENUM(...VISIBILITY),
    allowNull: false,
    defaultValue: 'public'
  }
}, {
  tableName: 'jobs',

  indexes: [
    { fields: ['status'] },
    { fields: ['department_id'] },
    { fields: ['type'] },
    { fields: ['contract_terms'] },
    { fields: ['featured'] },
    { unique: true, fields: ['short_code'] },
    { fields: ['visibility'] },
    { fields: ['ref_category'] }
  ],

  hooks: {
    beforeCreate: async (job) => {
      /* ---------------------------------------------------------- */
      /* 1. Short code                                               */
      /* ---------------------------------------------------------- */
      if (!job.shortCode) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = Job.generateShortCode();
          const exists = await Job.findOne({ where: { shortCode: code } });
          if (!exists) {
            job.shortCode = code;
            break;
          }
        }
      }

      /* ---------------------------------------------------------- */
      /* 2. Job reference — only if not manually provided            */
      /* ---------------------------------------------------------- */
      if (!job.jobRef || !job.jobRef.trim()) {
        try {
          job.jobRef = await Job.generateJobRef(job.refCategory || 'GEN');
        } catch (err) {
          console.error('[JOB REF GENERATION]', err.message);
          /* Non-fatal: leave jobRef null */
        }
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* Static exports                                                      */
/* ------------------------------------------------------------------ */
Job.JOB_TYPES = JOB_TYPES;
Job.CONTRACT_TERMS = CONTRACT_TERMS;
Job.VISIBILITY = VISIBILITY;
Job.REF_CATEGORIES = REF_CATEGORIES;
Job.DEFAULT_STAGES = DEFAULT_STAGES;

/* ------------------------------------------------------------------ */
/* Static helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generate an 8-character share code.
 * Alphabet excludes I, O, 0, 1, l — visual lookalikes.
 */
Job.generateShortCode = function () {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
};

/**
 * Generate the next job reference for a category and year.
 * Format: MUBS/<CATEGORY>/<YEAR>/<SEQUENCE>
 * Sequence resets each year, per category.
 */
Job.generateJobRef = async function (categoryCode) {
  const validCodes = REF_CATEGORIES.map((c) => c.code);
  const code = validCodes.includes(categoryCode) ? categoryCode : 'GEN';

  const year = new Date().getFullYear();
  const prefix = `MUBS/${code}/${year}/`;

  const latest = await Job.findOne({
    where: {
      jobRef: { [Op.like]: `${prefix}%` }
    },
    order: [['jobRef', 'DESC']],
    attributes: ['jobRef'],
    raw: true
  });

  let nextSeq = 1;

  if (latest && latest.jobRef) {
    const tail = latest.jobRef.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!isNaN(n)) nextSeq = n + 1;
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Instance methods                                                    */
/* ------------------------------------------------------------------ */

/**
 * Return the ordered stages for a job.
 *   - Eager-loaded rows (via `include as: 'stageRows'`) → used directly
 *   - Otherwise query the association
 *   - Fall back to DEFAULT_STAGES when there are no rows
 */
Job.prototype.getStages = async function () {
  if (Array.isArray(this.stageRows) && this.stageRows.length > 0) {
    return this.stageRows;
  }
  const stages = await this.getStageRows();
  return stages.length > 0 ? stages : DEFAULT_STAGES;
};

/**
 * Full share URL for the job's short code.
 */
Job.prototype.getShareUrl = function () {
  const base = process.env.APP_URL || 'https://jobs.mubs.ac.ug';
  return `${base}/j/${this.shortCode}`;
};

/**
 * Category label (for display) — e.g. 'ADM' → 'Administrative'.
 */
Job.prototype.getRefCategoryLabel = function () {
  const cat = REF_CATEGORIES.find((c) => c.code === this.refCategory);
  return cat ? cat.label : 'General';
};

/**
 * Is the job still open to applications?
 */
Job.prototype.isOpen = function () {
  if (this.status !== 'active') return false;
  if (!this.deadline) return false;
  return new Date(this.deadline).getTime() > Date.now();
};

module.exports = Job;