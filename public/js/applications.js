/* ================================================================== */
/* APPLICATIONS PAGE                                                   */
/* ------------------------------------------------------------------ */
/* Handles:                                                             */
/*   - Per-row status changes (single click)                            */
/*   - Bulk move to any stage (stage picker + "Apply")                  */
/*   - Reject-all-in-current-stage shortcut                             */
/*   - Row drawer expansion                                             */
/*   - Checkbox state                                                   */
/* ================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

    /* -------------------------------------------------------------- */
    /* Helpers                                                         */
    /* -------------------------------------------------------------- */
    function getJobId() {
      const m = window.location.pathname.match(/\/jobs\/(\d+)\//);
      return m ? m[1] : '';
    }

    function currentUrl() {
      return window.location.pathname + window.location.search;
    }

    async function postForm(url, data) {
      const body = new URLSearchParams(data).toString();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'follow'
      });
      window.location.href = res.url || currentUrl();
    }

    function toneFor(status) {
      if (status === 'accepted') return 'success';
      if (status === 'rejected') return 'danger';
      return 'warning';
    }

    /* -------------------------------------------------------------- */
    /* Single-row status change — called from row action buttons       */
    /* -------------------------------------------------------------- */
    window.changeStatus = function (appId, status, name, stageLabel) {
      const jobId = getJobId();
      const label = stageLabel || status;

      /* Safe / non-destructive moves submit immediately */
      const safe = ['shortlisted', 'reviewed', 'pending'];
      if (safe.includes(status)) {
        postForm(`/jobs/${jobId}/applications/${appId}/status`, {
          status,
          reason: '',
          returnTo: currentUrl()
        });
        return;
      }

      /* Destructive / terminal moves → confirm */
      openConfirmModal({
        title: `Move to ${label}`,
        message: `Move <strong>${name}</strong>'s application to <strong>${label}</strong>? This will be logged in the audit trail.`,
        confirmLabel: `Move to ${label}`,
        tone: toneFor(status),
        showReason: status === 'rejected',
        onConfirm: (reason) => {
          postForm(`/jobs/${jobId}/applications/${appId}/status`, {
            status,
            reason: reason || '',
            returnTo: currentUrl()
          });
        }
      });
    };

    /* -------------------------------------------------------------- */
    /* Bulk move — generic, target stage supplied by caller            */
    /*   scope: 'selected' | 'all' | 'pending' | 'pending,reviewed'    */
    /*   targetStage: any stage key from job_stages                    */
    /*   targetLabel: display label for the modal                      */
    /*   count: number of affected applications (for the modal)        */
    /* -------------------------------------------------------------- */
    window.bulkMove = function (scope, count, targetStage, targetLabel) {
      const jobId = getJobId();
      const label = targetLabel || targetStage;

      openConfirmModal({
        title: `Move to ${label}`,
        message: `Move <strong>${count}</strong> application${count === 1 ? '' : 's'} to <strong>${label}</strong>? This is logged in the audit trail.`,
        confirmLabel: `Move to ${label}`,
        tone: toneFor(targetStage),
        showReason: targetStage === 'rejected',
        onConfirm: (reason) => {
          postForm(`/jobs/${jobId}/applications/bulk-status`, {
            targetStage,
            scope,
            reason: reason || '',
            returnTo: currentUrl()
          });
        }
      });
    };

    /* -------------------------------------------------------------- */
    /* Bulk move for selected rows                                     */
    /* Reads the #bulkStageSelect dropdown                             */
    /* -------------------------------------------------------------- */
    window.bulkMoveSelected = function () {
      const ids = Array.from(document.querySelectorAll('.app-checkbox:checked'))
        .map((cb) => cb.value);

      if (ids.length === 0) {
        /* Button is disabled, but guard anyway */
        return;
      }

      const select = document.getElementById('bulkStageSelect');
      if (!select) return;

      const targetStage = select.value;
      if (!targetStage) {
        openConfirmModal({
          title: 'Pick a stage',
          message: 'Choose a stage from the dropdown before clicking Apply.',
          confirmLabel: 'OK',
          tone: 'warning',
          showReason: false,
          onConfirm: () => {}
        });
        return;
      }

      const targetLabel = select.options[select.selectedIndex].textContent.trim();
      const jobId = getJobId();

      openConfirmModal({
        title: `Move ${ids.length} to ${targetLabel}`,
        message: `Move <strong>${ids.length}</strong> selected application${ids.length === 1 ? '' : 's'} to <strong>${targetLabel}</strong>?`,
        confirmLabel: `Move to ${targetLabel}`,
        tone: toneFor(targetStage),
        showReason: targetStage === 'rejected',
        onConfirm: (reason) => {
          const data = {
            targetStage,
            scope: 'selected',
            reason: reason || '',
            returnTo: currentUrl()
          };
          ids.forEach((id, i) => {
            data[`applicationIds[${i}]`] = id;
          });
          postForm(`/jobs/${jobId}/applications/bulk-status`, data);
        }
      });
    };

    /* -------------------------------------------------------------- */
    /* Checkbox state + row expansion                                  */
    /* -------------------------------------------------------------- */
    const selectAll       = document.getElementById('selectAll');
    const selectedCountEl = document.getElementById('selectedCount');
    const rejectSelBtn    = document.getElementById('bulkRejectSelected'); // legacy
    const moveSelBtn      = document.getElementById('bulkMoveSelected');
    const checkboxes      = Array.from(document.querySelectorAll('.app-checkbox'));

    function updateSelectedCount() {
      const n = checkboxes.filter((cb) => cb.checked).length;

      if (selectedCountEl) {
        selectedCountEl.textContent = n === 0
          ? 'No rows selected'
          : n + ' row' + (n === 1 ? '' : 's') + ' selected';
      }

      if (moveSelBtn) {
        moveSelBtn.disabled = n === 0;
      }
      if (rejectSelBtn) {
        rejectSelBtn.disabled = n === 0;
        rejectSelBtn.title = n === 0
          ? 'Select at least one application first'
          : `Reject ${n} selected application${n === 1 ? '' : 's'}`;
      }

      if (selectAll) {
        selectAll.checked = n > 0 && n === checkboxes.length;
        selectAll.indeterminate = n > 0 && n < checkboxes.length;
      }
    }

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        checkboxes.forEach((cb) => { cb.checked = selectAll.checked; });
        updateSelectedCount();
      });
    }

    checkboxes.forEach((cb) => {
      cb.addEventListener('change', updateSelectedCount);
      cb.addEventListener('click', (e) => e.stopPropagation());
    });

    updateSelectedCount();

    /* -------------------------------------------------------------- */
    /* Row drawer expand / collapse                                    */
    /* -------------------------------------------------------------- */
    function toggleRowDrawer(appId) {
      const drawer = document.getElementById('details-' + appId);
      if (!drawer) return;
      drawer.classList.toggle('open');
      const btn = document.querySelector(`[data-expand-row="${appId}"]`);
      if (btn) btn.classList.toggle('open');
    }

    document.querySelectorAll('[data-expand-row]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRowDrawer(btn.dataset.expandRow);
      });
    });

    document.querySelectorAll('.app-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, label, form')) return;
        toggleRowDrawer(row.dataset.appId);
      });
    });

  });
})();