'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('jobs', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      job_ref: { type: Sequelize.STRING(60), allowNull: true },
      title: { type: Sequelize.STRING(180), allowNull: false },
      department_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'departments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      location: {
        type: Sequelize.STRING(150),
        defaultValue: 'MUBS Main Campus, Nakawa'
      },
      type: {
        type: Sequelize.ENUM('Full-time', 'Part-time'),
        defaultValue: 'Full-time'
      },
      contract_terms: {
        type: Sequelize.ENUM('Permanent', 'Contract'),
        defaultValue: 'Permanent'
      },
      grade: { type: Sequelize.STRING(30), allowNull: true },
      vacancies: { type: Sequelize.INTEGER.UNSIGNED, defaultValue: 1 },
      description: { type: Sequelize.TEXT('long'), allowNull: false },
      deadline: { type: Sequelize.DATE, allowNull: false },
      contact_email: { type: Sequelize.STRING(160), allowNull: false },
      contact_phone: { type: Sequelize.STRING(30), allowNull: true },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      featured: { type: Sequelize.BOOLEAN, defaultValue: false },
      views: { type: Sequelize.INTEGER.UNSIGNED, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('active', 'closed'),
        defaultValue: 'active'
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('jobs', ['status']);
    await queryInterface.addIndex('jobs', ['department_id']);
    await queryInterface.addIndex('jobs', ['type']);
    await queryInterface.addIndex('jobs', ['contract_terms']);
    await queryInterface.addIndex('jobs', ['featured']);
    await queryInterface.addIndex('jobs', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('jobs');
  }
};