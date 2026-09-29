const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JOB_TYPES = ['Full-time', 'Part-time'];
const CONTRACT_TERMS = ['Permanent', 'Contract'];

const Job = sequelize.define('Job', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  jobRef: { type: DataTypes.STRING(60), allowNull: true },
  title: { type: DataTypes.STRING(180), allowNull: false },

  // FK to departments
  departmentId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'departments', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },

  location: { type: DataTypes.STRING(150), defaultValue: 'MUBS Main Campus, Nakawa' },
  type: { type: DataTypes.ENUM(...JOB_TYPES), defaultValue: 'Full-time' },
  contractTerms: { type: DataTypes.ENUM(...CONTRACT_TERMS), defaultValue: 'Permanent' },
  grade: { type: DataTypes.STRING(30), allowNull: true },
  vacancies: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },

  description: { type: DataTypes.TEXT('long'), allowNull: false },

  deadline: { type: DataTypes.DATE, allowNull: false },
  contactEmail: { type: DataTypes.STRING(160), allowNull: false, validate: { isEmail: true } },
  contactPhone: { type: DataTypes.STRING(30) },

  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  featured: { type: DataTypes.BOOLEAN, defaultValue: false },
  views: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'closed'), defaultValue: 'active' }
}, {
  tableName: 'jobs',
  indexes: [
    { fields: ['status'] },
    { fields: ['department_id'] },     // snake_case
    { fields: ['type'] },
    { fields: ['contract_terms'] },    // snake_case
    { fields: ['featured'] }
  ]
});

Job.JOB_TYPES = JOB_TYPES;
Job.CONTRACT_TERMS = CONTRACT_TERMS;

module.exports = Job;