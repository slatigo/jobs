'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jobs', 'visibility', {
      type: Sequelize.ENUM('public', 'internal'),
      allowNull: false,
      defaultValue: 'public'
    });

    await queryInterface.addIndex('jobs', ['visibility']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('jobs', ['visibility']);
    await queryInterface.removeColumn('jobs', 'visibility');
  }
};