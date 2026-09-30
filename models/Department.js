const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DEPARTMENT_TYPES = ['Faculty', 'Directorate', 'Department', 'Office', 'Unit'];

const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  // Original MUBS numeric code from the CSV — kept for traceability
  mubsId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    unique: true
  },

  name: { type: DataTypes.STRING(220), allowNull: false, unique: true },
  shortName: { type: DataTypes.STRING(60), allowNull: true },
  slug: { type: DataTypes.STRING(240), allowNull: false, unique: true },
  type: {
    type: DataTypes.ENUM(...DEPARTMENT_TYPES),
    allowNull: false,
    defaultValue: 'Department'
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  displayOrder: { type: DataTypes.INTEGER, defaultValue: 100 }
}, {
  tableName: 'departments',
  indexes: [
    { fields: ['slug'] },
    { fields: ['active'] },
    { fields: ['type'] }
  ],
  hooks: {
    beforeValidate: (dept) => {
      if (dept.name && !dept.slug) {
        dept.slug = dept.name
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[’']/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
    }
  }
});

Department.TYPES = DEPARTMENT_TYPES;
/**
 * Return a short code for the department, suitable for job references.
 * Priority:
 *   1. shortName if set
 *   2. First letters of significant words (e.g. "Faculty of Commerce" → "FOC")
 *   3. First 3 letters of the name as last resort
 */
Department.prototype.getRefCode = function () {
  if (this.shortName && this.shortName.trim()) {
    return this.shortName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  const name = (this.name || '').toUpperCase();

  /* Skip common stop words */
  const skip = new Set(['OF', 'AND', 'THE', 'FOR', '&', ',', '-']);
  const words = name
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !skip.has(w));

  if (words.length === 0) return 'GEN';

  /* If the name already starts with an acronym in parens, use it */
  const parenMatch = this.name.match(/\(([A-Z]{2,6})\)/);
  if (parenMatch) return parenMatch[1];

  /* 2-4 letter acronym from initial letters */
  if (words.length >= 2) {
    const acronym = words.slice(0, 4).map((w) => w[0]).join('');
    return acronym.slice(0, 4);
  }

  /* Single word — first 3 letters */
  return words[0].slice(0, 3);
};
module.exports = Department;