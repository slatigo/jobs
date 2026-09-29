const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApplicationStatusHistory = sequelize.define('ApplicationStatusHistory', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  applicationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  fromStatus: {
    type: DataTypes.ENUM('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'),
    allowNull: true         // null on first insert (initial state)
  },
  toStatus: {
    type: DataTypes.ENUM('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'),
    allowNull: false
  },

  changedByUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true         // can be null if actor was deleted
  },

  reason: { type: DataTypes.STRING(500), allowNull: true },

  // Optional: tag where the change came from
  // e.g. 'single', 'bulk-pending', 'bulk-non-shortlisted', 'auto-accept-reject'
  source: { type: DataTypes.STRING(60), allowNull: true }
}, {
  tableName: 'application_status_history',
  updatedAt: false, // history rows never change
  indexes: [
    { fields: ['application_id'] },
    { fields: ['changed_by_user_id'] },
    { fields: ['created_at'] }
  ]
});

module.exports = ApplicationStatusHistory;