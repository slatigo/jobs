'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('departments', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      mubs_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, unique: true },
      name: { type: Sequelize.STRING(220), allowNull: false, unique: true },
      short_name: { type: Sequelize.STRING(60), allowNull: true },
      slug: { type: Sequelize.STRING(240), allowNull: false, unique: true },
      type: {
        type: Sequelize.ENUM('Faculty', 'Directorate', 'Department', 'Office', 'Unit'),
        allowNull: false,
        defaultValue: 'Department'
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      active: { type: Sequelize.BOOLEAN, defaultValue: true },
      display_order: { type: Sequelize.INTEGER, defaultValue: 100 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('departments', ['slug']);
    await queryInterface.addIndex('departments', ['active']);
    await queryInterface.addIndex('departments', ['type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('departments');
  }
};