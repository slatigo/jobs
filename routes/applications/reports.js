const express = require('express');
const router = express.Router({ mergeParams: true });
const { isAuthenticated } = require('../../middleware/auth');
const {
  GROUPS, loadShortlist, peopleInGroup, canManage
} = require('../../utils/reports/shortlistData');
const { buildWorkbook } = require('../../utils/reports/shortlistExcel');
const { buildPdf } = require('../../utils/reports/shortlistPdf');

function slug(value) {
  return String(value || 'job').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function context(req, res) {
  const pack = await loadShortlist(req.params.id);
  if (!pack) {
    req.flash('error', 'Job not found');
    res.redirect('/jobs');
    return null;
  }
  if (!canManage(req.session.user, pack.job)) {
    req.flash('error', 'You are not allowed to open shortlisting reports for this job.');
    res.redirect(`/jobs/${pack.job.id}`);
    return null;
  }
  return pack;
}

router.get('/reports', isAuthenticated, async (req, res) => {
  try {
    const pack = await context(req, res);
    if (!pack) return;
    const allowed = ['list', 'pass', 'review', 'fail', 'all'];
    const requested = String(req.query.view || 'pass').toLowerCase();
    const view = allowed.includes(requested) ? requested : 'pass';
    const people = view === 'list'
      ? pack.people.slice().sort((a, b) => a.fullName.localeCompare(b.fullName))
      : peopleInGroup(pack.people, view);
    const titles = {
      list: 'All applicants',
      pass: 'Candidates who passed',
      review: 'Candidates for review',
      fail: 'Candidates who did not meet the requirements',
      all: 'All candidates'
    };
    res.render('jobs/shortlisting-reports', {
      title: `Shortlisting report - ${pack.job.title}`,
      job: pack.job,
      counts: pack.counts,
      view,
      viewTitle: titles[view],
      people
    });
  } catch (err) {
    console.error('[SHORTLIST REPORTS]', err);
    req.flash('error', 'Could not open the shortlisting reports.');
    res.redirect(`/jobs/${req.params.id}/applications`);
  }
});

router.get('/reports/:group.:ext', isAuthenticated, async (req, res) => {
  try {
    const requested = String(req.params.group || '').toLowerCase();
    const groupKey = requested === 'hold' ? 'review' : requested;
    const ext = String(req.params.ext || '').toLowerCase();
    if (!GROUPS[groupKey] || !['xlsx', 'pdf'].includes(ext)) {
      return res.status(404).send('Report not found.');
    }
    const pack = await context(req, res);
    if (!pack) return;
    const people = peopleInGroup(pack.people, groupKey);
    const filename = `shortlist-${slug(pack.job.title)}-${groupKey}.${ext}`;

    if (ext === 'xlsx') {
      const workbook = await buildWorkbook({
        job: pack.job,
        people,
        counts: pack.counts,
        groupKey
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    buildPdf({
      job: pack.job,
      people,
      counts: pack.counts,
      groupKey,
      stream: res
    });
  } catch (err) {
    console.error('[SHORTLIST EXPORT]', err);
    if (!res.headersSent) {
      req.flash('error', 'Could not prepare that report.');
      res.redirect(`/jobs/${req.params.id}/applications/reports`);
    }
  }
});

module.exports = router;
