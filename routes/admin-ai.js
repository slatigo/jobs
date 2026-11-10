const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const { publicSettings, saveSettings, activeCredential } = require('../utils/ai/settings');
const { testConnection } = require('../utils/ai/provider');
const { getSettings } = require('../utils/ai/settings');

router.get('/', isAdmin, async (req, res) => {
  try {
    const row = await getSettings();
    res.render('admin/ai', {
      title: 'AI settings',
      ai: publicSettings(row)
    });
  } catch (err) {
    console.error('[AI SETTINGS]', err.message);
    req.flash('error', err.message || 'Could not load AI settings.');
    res.redirect('/admin');
  }
});

router.post('/', isAdmin, async (req, res) => {
  try {
    await saveSettings({ body: req.body, userId: req.session.user.id });
    req.flash('success', 'AI settings saved. Keys stay on this server and are not shown again in full.');
    res.redirect('/admin/ai');
  } catch (err) {
    console.error('[AI SETTINGS SAVE]', err.message);
    req.flash('error', err.message || 'Could not save AI settings.');
    res.redirect('/admin/ai');
  }
});

router.post('/test', isAdmin, async (req, res) => {
  try {
    const cred = await activeCredential();
    await testConnection(cred);
    req.flash('success', `Connected to ${cred.provider} (${cred.model}).`);
  } catch (err) {
    console.error('[AI TEST]', err.message);
    req.flash('error', err.message || 'The API key was rejected.');
  }
  res.redirect('/admin/ai');
});

module.exports = router;
