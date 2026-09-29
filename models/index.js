const sequelize = require('../config/database');
const User = require('./User');
const Department = require('./Department');
const Job = require('./Job');
const Application = require('./Application');
const ApplicationStatusHistory = require('./ApplicationStatusHistory');

/* ------------------------------------------------------------------ */
/* Department ↔ Jobs                                                   */
/* ------------------------------------------------------------------ */
Department.hasMany(Job, { foreignKey: 'departmentId', as: 'jobs', onDelete: 'RESTRICT' });
Job.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

/* ------------------------------------------------------------------ */
/* User (employer) → Jobs                                              */
/* ------------------------------------------------------------------ */
User.hasMany(Job, { foreignKey: 'userId', as: 'postedJobs', onDelete: 'SET NULL' });
Job.belongsTo(User, { foreignKey: 'userId', as: 'postedBy' });

/* ------------------------------------------------------------------ */
/* User ↔ Jobs via Applications                                        */
/* ------------------------------------------------------------------ */
User.belongsToMany(Job, {
  through: Application,
  foreignKey: 'userId',
  otherKey: 'jobId',
  as: 'applications'
});
Job.belongsToMany(User, {
  through: Application,
  foreignKey: 'jobId',
  otherKey: 'userId',
  as: 'applicants'
});

/* ------------------------------------------------------------------ */
/* Direct Application references                                       */
/* ------------------------------------------------------------------ */
Job.hasMany(Application, { foreignKey: 'jobId', as: 'applicationRecords', onDelete: 'CASCADE' });
Application.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

User.hasMany(Application, { foreignKey: 'userId', as: 'applicationRecords', onDelete: 'CASCADE' });
Application.belongsTo(User, { foreignKey: 'userId', as: 'applicant' });

/* ------------------------------------------------------------------ */
/* Application ↔ Status History                                        */
/* ------------------------------------------------------------------ */
Application.hasMany(ApplicationStatusHistory, {
  foreignKey: 'applicationId',
  as: 'history',
  onDelete: 'CASCADE'
});
ApplicationStatusHistory.belongsTo(Application, {
  foreignKey: 'applicationId',
  as: 'application'
});

User.hasMany(ApplicationStatusHistory, {
  foreignKey: 'changedByUserId',
  as: 'statusChanges',
  onDelete: 'SET NULL'
});
ApplicationStatusHistory.belongsTo(User, {
  foreignKey: 'changedByUserId',
  as: 'changedBy'
});

module.exports = {
  sequelize,
  User,
  Department,
  Job,
  Application,
  ApplicationStatusHistory
};