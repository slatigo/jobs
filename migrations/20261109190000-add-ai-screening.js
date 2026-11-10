'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = new Set(await queryInterface.showAllTables());

    if (!existing.has('ai_settings')) {
      await queryInterface.createTable('ai_settings', {
        id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
        active_provider: {
          type: Sequelize.ENUM('gemini', 'anthropic'),
          allowNull: false,
          defaultValue: 'gemini'
        },
        gemini_model: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'gemini-2.5-flash' },
        gemini_key_enc: { type: Sequelize.TEXT, allowNull: true },
        anthropic_model: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'claude-sonnet-4-5' },
        anthropic_key_enc: { type: Sequelize.TEXT, allowNull: true },
        updated_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false }
      });
    }

    if (!existing.has('ai_job_analyses')) {
      await queryInterface.createTable('ai_job_analyses', {
        id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
        job_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        advert_hash: { type: Sequelize.STRING(64), allowNull: false },
        role_summary: { type: Sequelize.TEXT, allowNull: false },
        criteria_json: { type: Sequelize.TEXT('long'), allowNull: false },
        provider: { type: Sequelize.STRING(20), allowNull: false },
        model: { type: Sequelize.STRING(80), allowNull: false },
        created_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false }
      });
    }

    if (!existing.has('ai_screenings')) {
      await queryInterface.createTable('ai_screenings', {
        id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
        application_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'applications', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        job_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        stage_key: { type: Sequelize.STRING(60), allowNull: false },
        recommendation: {
          type: Sequelize.ENUM('advance', 'hold', 'do_not_advance'),
          allowNull: false
        },
        suggested_stage_key: { type: Sequelize.STRING(60), allowNull: true },
        summary: { type: Sequelize.TEXT, allowNull: false },
        checklist_json: { type: Sequelize.TEXT('long'), allowNull: false },
        document_note: { type: Sequelize.TEXT, allowNull: true },
        confidence: {
          type: Sequelize.ENUM('high', 'medium', 'low'),
          allowNull: false,
          defaultValue: 'medium'
        },
        provider: { type: Sequelize.STRING(20), allowNull: false },
        model: { type: Sequelize.STRING(80), allowNull: false },
        hr_decision: {
          type: Sequelize.ENUM('pending', 'accepted', 'dismissed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        decided_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        created_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false }
      });

      await queryInterface.addIndex('ai_screenings', ['application_id']);
      await queryInterface.addIndex('ai_screenings', ['job_id']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_screenings');
    await queryInterface.dropTable('ai_job_analyses');
    await queryInterface.dropTable('ai_settings');
  }
};
