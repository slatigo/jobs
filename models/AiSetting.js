const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiSetting = sequelize.define('AiSetting', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  activeProvider: {
    type: DataTypes.ENUM('gemini', 'anthropic'),
    allowNull: false,
    defaultValue: 'gemini'
  },
  geminiModel: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'gemini-2.5-flash' },
  geminiKeyEnc: { type: DataTypes.TEXT, allowNull: true },
  anthropicModel: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'claude-sonnet-4-5' },
  anthropicKeyEnc: { type: DataTypes.TEXT, allowNull: true },
  updatedByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }
}, {
  tableName: 'ai_settings'
});

module.exports = AiSetting;
