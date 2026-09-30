'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('application_status_history', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      application_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'applications', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      from_status: { type: Sequelize.STRING(60), allowNull: true },
      to_status: { type: Sequelize.STRING(60), allowNull: false },
      changed_by_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reason: { type: Sequelize.STRING(500), allowNull: true },
      source: { type: Sequelize.STRING(60), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('application_status_history', ['application_id']);
    await queryInterface.addIndex('application_status_history', ['changed_by_user_id']);
    await queryInterface.addIndex('application_status_history', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('application_status_history');
  }
};