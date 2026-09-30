'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('applications', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      job_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      full_name: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(160), allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: false },
      cover_letter: { type: Sequelize.TEXT, allowNull: true },
      attachment_url: { type: Sequelize.STRING(500), allowNull: false },
      attachment_name: { type: Sequelize.STRING(255), allowNull: false },
      attachment_mime: { type: Sequelize.STRING(100), allowNull: false },
      attachment_size: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      status: {
        type: Sequelize.STRING(60),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('applications', ['job_id', 'user_id'], {
      unique: true,
      name: 'applications_job_id_user_id'
    });
    await queryInterface.addIndex('applications', ['user_id']);
    await queryInterface.addIndex('applications', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('applications');
  }
};