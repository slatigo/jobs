/* ================================================================== */
/* AI SHORTLISTING & JD ANALYSIS CLIENT                               */
/* ================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const jdCard = document.getElementById('aiJdCard');
    const progressEl = document.getElementById('aiProgress');
    const progressText = document.getElementById('aiProgressText');
    const progressIcon = document.getElementById('aiProgressIcon');
    const progressClose = document.getElementById('aiProgressClose');

    function getJobId() {
      if (jdCard && jdCard.dataset.jobId) return jdCard.dataset.jobId;
      const m = window.location.pathname.match(/\/jobs\/(\d+)\//);
      return m ? m[1] : '';
    }

    function showProgress(msg, spinning = true, isError = false) {
      if (!progressEl || !progressText) return;
      progressEl.hidden = false;
      progressEl.classList.toggle('is-error', Boolean(isError));
      progressText.textContent = msg;
      if (progressIcon) {
        progressIcon.className = spinning
          ? 'fas fa-spinner fa-spin'
          : (isError ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle');
      }
    }

    function hideProgress() {
      if (progressEl) progressEl.hidden = true;
    }

    if (progressClose) {
      progressClose.addEventListener('click', hideProgress);
    }

    function escHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /* -------------------------------------------------------------- */
    /* Auto-expand drawer if saved in sessionStorage after screening  */
    /* -------------------------------------------------------------- */
    const autoOpenId = sessionStorage.getItem('mubs_ai_open_drawer');
    if (autoOpenId) {
      sessionStorage.removeItem('mubs_ai_open_drawer');
      const drawer = document.getElementById('details-' + autoOpenId);
      if (drawer) {
        drawer.classList.add('open');
        const btn = document.querySelector(`[data-expand-row="${autoOpenId}"]`);
        if (btn) btn.classList.add('open');
        setTimeout(() => {
          drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }
    }

    /* -------------------------------------------------------------- */
    /* 1. Background Job Description (JD) Analysis                    */
    /* -------------------------------------------------------------- */
    let jdAnalysisPromise = null;

    function renderJdAnalysis(analysis) {
      if (!jdCard || !analysis) return;
      jdCard.dataset.jdAnalyzed = '1';

      const badge = document.getElementById('aiJdStatusBadge');
      if (badge) {
        badge.className = 'ai-jd-status status-ready';
        badge.innerHTML = `<i class="fas fa-check-circle"></i> JD Understood (${analysis.counts.total} criteria)`;
      }

      const summaryEl = document.getElementById('aiJdSummaryText');
      if (summaryEl) {
        summaryEl.textContent = analysis.roleSummary;
      }

      const metricsEl = document.getElementById('aiJdMetrics');
      if (metricsEl) {
        metricsEl.hidden = false;
        let groupEl = metricsEl.querySelector('.ai-metric-group:not(.ai-judgement-totals)');
        if (!groupEl) {
          groupEl = document.createElement('div');
          groupEl.className = 'ai-metric-group';
          metricsEl.prepend(groupEl);
        }
        groupEl.innerHTML = `
          <span class="ai-metric-chip chip-mandatory"><i class="fas fa-asterisk"></i><strong>${analysis.counts.mandatory}</strong> Mandatory</span>
          <span class="ai-metric-chip chip-advantage"><i class="fas fa-plus-circle"></i><strong>${analysis.counts.advantage}</strong> Added Advantage</span>
          <span class="ai-metric-chip chip-docs"><i class="fas fa-file-check"></i><strong>${analysis.counts.documents}</strong> Required Docs</span>
        `;
      }

      const detailsEl = document.getElementById('aiJdDetails');
      const rubricBody = document.getElementById('aiJdRubricBody');
      if (detailsEl && rubricBody && Array.isArray(analysis.criteria)) {
        detailsEl.hidden = false;
        const rowsHtml = analysis.criteria.map((c) => {
          const slug = String(c.group || 'Other').toLowerCase().replace(/\s+/g, '-');
          return `
            <tr>
              <td><span class="ai-group-tag group-${escHtml(slug)}">${escHtml(c.group)}</span></td>
              <td><strong>${escHtml(c.criterion)}</strong></td>
              <td>${escHtml(c.details || '—')}</td>
            </tr>
          `;
        }).join('');
        rubricBody.innerHTML = `
          <table class="ai-checklist ai-jd-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Criterion</th>
                <th>Requirement Details from Job Advert</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      const btn = document.getElementById('aiAnalyzeJdBtn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Refresh JD Rubric</span>';
      }
    }

    async function runJdAnalysis(force = false) {
      const jobId = getJobId();
      if (!jobId) return null;

      if (jdAnalysisPromise && !force) return jdAnalysisPromise;

      const badge = document.getElementById('aiJdStatusBadge');
      if (badge) {
        badge.className = 'ai-jd-status status-pending';
        badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reading Job Description in background…';
      }

      const btn = document.getElementById('aiAnalyzeJdBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Reading JD…</span>';
      }

      jdAnalysisPromise = (async () => {
        try {
          const res = await fetch(`/jobs/${jobId}/applications/ai/analyze-job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Could not analyze Job Description.');
          }
          renderJdAnalysis(data.analysis);
          return data.analysis;
        } catch (err) {
          if (badge) {
            badge.className = 'ai-jd-status status-unconfigured';
            badge.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escHtml(err.message)}`;
          }
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Retry JD Read</span>';
          }
          return null;
        } finally {
          jdAnalysisPromise = null;
        }
      })();

      return jdAnalysisPromise;
    }

    // Automatically read the JD in the background when opening View Applications
    if (jdCard && jdCard.dataset.aiConfigured === '1' && jdCard.dataset.jdAnalyzed !== '1') {
      runJdAnalysis(false);
    }

    const analyzeBtn = document.getElementById('aiAnalyzeJdBtn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        runJdAnalysis(true);
      });
    }

    /* -------------------------------------------------------------- */
    /* 2. Open AI Details Drawer on Badge Click                       */
    /* -------------------------------------------------------------- */
    document.querySelectorAll('[data-ai-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const appId = el.dataset.aiOpen;
        const drawer = document.getElementById('details-' + appId);
        if (!drawer) return;
        const isOpen = drawer.classList.toggle('open');
        const toggleBtn = document.querySelector(`[data-expand-row="${appId}"]`);
        if (toggleBtn) toggleBtn.classList.toggle('open', isOpen);
        if (isOpen) {
          drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });

    /* -------------------------------------------------------------- */
    /* 3. Single Candidate Screening                                  */
    /* -------------------------------------------------------------- */
    async function screenCandidate(appId, appName) {
      const jobId = getJobId();
      if (jdCard && jdCard.dataset.jdAnalyzed !== '1') {
        showProgress('Step 1/2: Reading Job Description requirements…', true);
        await runJdAnalysis(false);
      }
      showProgress(`Screening ${appName || 'candidate'}'s CV & documents against JD rubric (may take 15–45s for scanned PDFs)…`, true);

      const res = await fetch(`/jobs/${jobId}/applications/ai/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Screening failed.');
      }
      return data.screening;
    }

    document.querySelectorAll('[data-ai-screen]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const appId = btn.dataset.aiScreen;
        const row = document.querySelector(`.app-row[data-app-id="${appId}"]`);
        const appName = row ? row.dataset.appName : 'Candidate';
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Screening…';

        try {
          await screenCandidate(appId, appName);
          sessionStorage.setItem('mubs_ai_open_drawer', String(appId));
          showProgress(`Finished screening ${appName}. Reloading results…`, false);
          window.location.reload();
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
          showProgress(err.message || 'Screening failed.', false, true);
        }
      });
    });

    /* -------------------------------------------------------------- */
    /* 4. Single Candidate HR Decision (Accept / Dismiss)             */
    /* -------------------------------------------------------------- */
    document.querySelectorAll('[data-ai-decide]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const appId = btn.dataset.appId;
        const decision = btn.dataset.aiDecide;
        const jobId = getJobId();
        btn.disabled = true;

        try {
          showProgress('Applying HR decision…', true);
          const res = await fetch(`/jobs/${jobId}/applications/ai/decide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: appId, decision })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Could not apply decision.');
          }
          showProgress(data.message || 'Decision saved.', false);
          window.location.reload();
        } catch (err) {
          btn.disabled = false;
          showProgress(err.message || 'Could not apply decision.', false, true);
        }
      });
    });

    /* -------------------------------------------------------------- */
    /* 5. Quick Select All "Pass" Candidates                          */
    /* -------------------------------------------------------------- */
    const selectPassBtn = document.getElementById('aiSelectPassed');
    if (selectPassBtn) {
      selectPassBtn.addEventListener('click', () => {
        document.querySelectorAll('.app-row').forEach((row) => {
          const cb = row.querySelector('.app-checkbox');
          if (!cb) return;
          cb.checked = row.dataset.aiJudgement === 'pass';
          cb.dispatchEvent(new Event('change'));
        });
      });
    }

    /* -------------------------------------------------------------- */
    /* 6. Bulk Screening (Selected or Entire Current List)            */
    /* -------------------------------------------------------------- */
    async function runBulkScreen(rows) {
      if (!rows.length) {
        showProgress('No applications selected to screen.', false, true);
        return;
      }

      if (jdCard && jdCard.dataset.jdAnalyzed !== '1') {
        showProgress('Reading and analyzing Job Description first…', true);
        await runJdAnalysis(false);
      }

      let completed = 0;
      let failed = 0;
      let lastError = '';

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const appId = row.dataset.appId;
        const appName = row.dataset.appName || `#${appId}`;
        showProgress(`Screening ${i + 1} of ${rows.length}: ${appName}…`, true);

        try {
          await screenCandidate(appId, appName);
          completed++;
        } catch (err) {
          failed++;
          lastError = err.message || 'Screening error';
          // Stop early if API key is missing
          if (/API key/i.test(lastError)) break;
        }
      }

      if (completed === 0 && failed > 0) {
        showProgress(`Screening stopped: ${lastError}`, false, true);
        return;
      }

      showProgress(
        `Screened ${completed} of ${rows.length} candidate(s)${failed ? ` (${failed} failed: ${lastError})` : ''}. Refreshing table…`,
        false
      );
      setTimeout(() => window.location.reload(), 600);
    }

    const screenSelectedBtn = document.getElementById('aiScreenSelected');
    if (screenSelectedBtn) {
      screenSelectedBtn.addEventListener('click', () => {
        const checkedIds = new Set(
          Array.from(document.querySelectorAll('.app-checkbox:checked')).map((cb) => cb.value)
        );
        if (checkedIds.size === 0) {
          showProgress('Tick at least one candidate row before clicking "Screen selected".', false, true);
          return;
        }
        const rows = Array.from(document.querySelectorAll('.app-row')).filter((r) =>
          checkedIds.has(r.dataset.appId)
        );
        runBulkScreen(rows);
      });
    }

    const screenListBtn = document.getElementById('aiScreenList');
    if (screenListBtn) {
      screenListBtn.addEventListener('click', () => {
        const allRows = Array.from(document.querySelectorAll('.app-row'));
        const unscreened = allRows.filter((r) => r.dataset.aiJudgement === 'unscreened');
        const targetRows = unscreened.length > 0 ? unscreened : allRows;
        runBulkScreen(targetRows);
      });
    }

    /* -------------------------------------------------------------- */
    /* 7. Bulk Apply AI Moves                                         */
    /* -------------------------------------------------------------- */
    const applyMovesBtn = document.getElementById('aiApplyMoves');
    if (applyMovesBtn) {
      applyMovesBtn.addEventListener('click', () => {
        const checkedIds = new Set(
          Array.from(document.querySelectorAll('.app-checkbox:checked')).map((cb) => cb.value)
        );
        const allRows = Array.from(document.querySelectorAll('.app-row'));
        const scopeRows = checkedIds.size > 0
          ? allRows.filter((r) => checkedIds.has(r.dataset.appId))
          : allRows;

        const actionable = scopeRows.filter((r) => {
          const rec = r.dataset.aiRecommendation;
          return rec === 'advance' || rec === 'do_not_advance';
        });

        if (actionable.length === 0) {
          showProgress('No pending AI Pass/Fail stage moves found in the current selection. Screen candidates first.', false, true);
          return;
        }

        const passCount = actionable.filter((r) => r.dataset.aiRecommendation === 'advance').length;
        const failCount = actionable.filter((r) => r.dataset.aiRecommendation === 'do_not_advance').length;

        const doApply = async () => {
          const jobId = getJobId();
          let applied = 0;
          for (let i = 0; i < actionable.length; i++) {
            const r = actionable[i];
            showProgress(`Applying AI recommendation ${i + 1} of ${actionable.length} (${r.dataset.appName})…`, true);
            const res = await fetch(`/jobs/${jobId}/applications/ai/decide`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ applicationId: r.dataset.appId, decision: 'accept' })
            });
            if (res.ok) applied++;
          }
          showProgress(`Applied ${applied} AI recommendation(s). Reloading…`, false);
          setTimeout(() => window.location.reload(), 500);
        };

        if (typeof window.openConfirmModal === 'function') {
          window.openConfirmModal({
            title: 'Apply AI Shortlisting Recommendations',
            message: `Apply pending AI stage recommendations for <strong>${actionable.length}</strong> candidate(s)?<br><br>• <strong>${passCount}</strong> Pass (Advance to next stage)<br>• <strong>${failCount}</strong> Fail (Move to Rejected)<br><br>Candidates marked <em>Hold / Review</em> will not be moved automatically.`,
            confirmLabel: `Apply ${actionable.length} AI Move${actionable.length === 1 ? '' : 's'}`,
            tone: 'warning',
            showReason: false,
            onConfirm: doApply
          });
        } else if (window.confirm(`Apply ${actionable.length} AI recommendations (${passCount} Pass, ${failCount} Fail)?`)) {
          doApply();
        }
      });
    }
  });
})();
