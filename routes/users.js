const express = require('express');
const router = express.Router();
const { User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { isAdmin } = require('../middleware/auth'); 

// GET /users - Admin User Directory
router.get('/', isAdmin, async (req, res) => {
  try {
    const { role, startDate, endDate } = req.query;

    // 1. Build the Where Clause for Filters
    let whereClause = {};

    // Filter by Role (Applicant vs Admin vs Employer)
    if (role && role !== 'all') {
      whereClause.role = role;
    }

    // Filter by Date Range
    if (startDate || endDate) {
      whereClause.createdAt = {};
      
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      
      if (endDate) {
        // Set to end of the selected day (23:59:59) so it includes the whole day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = end;
      }
    }

    // 2. Fetch Users with Application Count
    const users = await User.findAll({
      where: whereClause,
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM applications AS app
              WHERE app.user_id = User.id
            )`),
            'applicationCount'
          ]
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    // 3. Render the View (Passing filters back so the form stays filled)
    res.render('users/index', {
      title: 'User Directory',
      users,
      filters: { 
        role: role || 'all', 
        startDate: startDate || '', 
        endDate: endDate || '' 
      }
    });

  } catch (err) {
    console.error('[USERS LIST ERROR]', err);
    req.flash('error', 'Could not load users.');
    res.redirect('/admin');
  }
});

module.exports = router;