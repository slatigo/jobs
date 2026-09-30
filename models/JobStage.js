const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobStage = sequelize.define('JobStage', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  jobId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'jobs', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },

  key: {
    type: DataTypes.STRING(60),
    allowNull: false,
    validate: { is: /^[a-z0-9_]+$/ }
  },

  label: { type: DataTypes.STRING(120), allowNull: false },

  color: {
    type: DataTypes.ENUM('warning', 'primary', 'info', 'success', 'danger'),
    defaultValue: 'primary'
  },

  order: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0
  },

  isTerminal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'job_stages',
  indexes: [
    { unique: true, fields: ['job_id', 'key'] },
    { fields: ['job_id', 'order'] }
  ]
});

module.exports = JobStage;