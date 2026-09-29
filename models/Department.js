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

module.exports = Department;