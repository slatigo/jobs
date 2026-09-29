const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: {
    type: DataTypes.STRING(160),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('applicant', 'employer', 'admin'),
    defaultValue: 'applicant'
  },
  phone: { type: DataTypes.STRING(30) },
  course: { type: DataTypes.STRING(120) },
  yearOfGraduation: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    validate: { min: 1950, max: 2100 }
  },
  company: { type: DataTypes.STRING(150) },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.comparePassword = function (password) {
  return bcrypt.compare(this.password, password);
};

User.prototype.toSafeJSON = function () {
  return { id: this.id, name: this.name, email: this.email, role: this.role };
};

User.ROLES = ['applicant', 'employer', 'admin'];

module.exports = User;