'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_stages', {
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
      key: { type: Sequelize.STRING(60), allowNull: false },
      label: { type: Sequelize.STRING(120), allowNull: false },
      color: {
        type: Sequelize.ENUM('warning', 'primary', 'info', 'success', 'danger'),
        defaultValue: 'primary'
      },
      order: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      is_terminal: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('job_stages', ['job_id', 'key'], {
      unique: true,
      name: 'job_stages_job_id_key'
    });
    await queryInterface.addIndex('job_stages', ['job_id', 'order'], {
      name: 'job_stages_job_id_order'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('job_stages');
  }
};