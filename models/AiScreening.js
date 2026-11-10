const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiScreening = sequelize.define('AiScreening', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  applicationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  jobId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  stageKey: { type: DataTypes.STRING(60), allowNull: false },
  recommendation: {
    type: DataTypes.ENUM('advance', 'hold', 'do_not_advance'),
    allowNull: false
  },
  suggestedStageKey: { type: DataTypes.STRING(60), allowNull: true },
  summary: { type: DataTypes.TEXT, allowNull: false },
  checklistJson: { type: DataTypes.TEXT('long'), allowNull: false },
  documentNote: { type: DataTypes.TEXT, allowNull: true },
  confidence: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    allowNull: false,
    defaultValue: 'medium'
  },
  provider: { type: DataTypes.STRING(20), allowNull: false },
  model: { type: DataTypes.STRING(80), allowNull: false },
  hrDecision: {
    type: DataTypes.ENUM('pending', 'accepted', 'dismissed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  decidedByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  decidedAt: { type: DataTypes.DATE, allowNull: true },
  createdByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }
}, {
  tableName: 'ai_screenings',
  indexes: [
    { fields: ['application_id'] },
    { fields: ['job_id'] }
  ]
});

module.exports = AiScreening;
