const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiJobAnalysis = sequelize.define('AiJobAnalysis', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  jobId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  advertHash: { type: DataTypes.STRING(64), allowNull: false },
  roleSummary: { type: DataTypes.TEXT, allowNull: false },
  criteriaJson: { type: DataTypes.TEXT('long'), allowNull: false },
  provider: { type: DataTypes.STRING(20), allowNull: false },
  model: { type: DataTypes.STRING(80), allowNull: false },
  createdByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }
}, {
  tableName: 'ai_job_analyses',
  indexes: [
    { unique: true, fields: ['job_id'] }
  ]
});

module.exports = AiJobAnalysis;
