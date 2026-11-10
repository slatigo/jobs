const sequelize = require('../config/database');
const User = require('./User');
const Department = require('./Department');
const Job = require('./Job');
const JobStage = require('./JobStage');
const Application = require('./Application');
const ApplicationStatusHistory = require('./ApplicationStatusHistory');
const AiSetting = require('./AiSetting');
const AiScreening = require('./AiScreening');
const AiJobAnalysis = require('./AiJobAnalysis');

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
/* Job ↔ JobStage                                                      */
/* ------------------------------------------------------------------ */
Job.hasMany(JobStage, {
  foreignKey: 'jobId',
  as: 'stageRows',              // ← avoids clashing with Job.prototype.getStages
  onDelete: 'CASCADE'
});
JobStage.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

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

Application.hasMany(AiScreening, {
  foreignKey: 'applicationId',
  as: 'aiScreenings',
  onDelete: 'CASCADE'
});
AiScreening.belongsTo(Application, { foreignKey: 'applicationId', as: 'application' });

Job.hasOne(AiJobAnalysis, {
  foreignKey: 'jobId',
  as: 'aiAnalysis',
  onDelete: 'CASCADE'
});
AiJobAnalysis.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

module.exports = {
  sequelize,
  User,
  Department,
  Job,
  JobStage,
  Application,
  ApplicationStatusHistory,
  AiSetting,
  AiScreening,
  AiJobAnalysis
};