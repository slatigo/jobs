const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Application = sequelize.define('Application', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  jobId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fullName: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  coverLetter: { type: DataTypes.TEXT, allowNull: true },

  // Attachment (CV / resume)
  attachmentUrl:  { type: DataTypes.STRING(500), allowNull: false },
  attachmentName: { type: DataTypes.STRING(255), allowNull: false }, // original filename
  attachmentMime: { type: DataTypes.STRING(100), allowNull: false },
  attachmentSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // bytes

  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'applications',
  indexes: [
    { unique: true, fields: ['job_id', 'user_id'] }
  ]
});

module.exports = Application;