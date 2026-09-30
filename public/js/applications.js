/* ================================================================== */
/* APPLICATIONS PAGE                                                   */
/* ================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

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

    /* ----------------------------------------------------------------
       Status change — called from onclick
       ---------------------------------------------------------------- */
    window.changeStatus = function (appId, status, name) {
      const jobId = getJobId();
      const safe = ['shortlisted', 'reviewed', 'pending'];

      if (safe.includes(status)) {
        postForm(`/jobs/${jobId}/applications/${appId}/status`, {
          status, reason: '', returnTo: currentUrl()
        });
        return;
      }

      const tones = {
        accepted: {
          tone: 'success', title: 'Accept Candidate', label: 'Accept Candidate',
          message: `Accept <strong>${name}</strong> as the selected candidate? They will be notified.`,
          reason: false
        },
        rejected: {
          tone: 'danger', title: 'Reject Application', label: 'Reject',
          message: `Reject <strong>${name}</strong>'s application? This is logged in the audit trail.`,
          reason: true
        }
      };

      const cfg = tones[status] || {
        tone: 'danger', title: 'Confirm', label: 'Confirm',
        message: `Mark <strong>${name}</strong> as ${status}?`, reason: false
      };

      openConfirmModal({
        title: cfg.title,
        message: cfg.message,
        confirmLabel: cfg.label,
        tone: cfg.tone,
        showReason: cfg.reason,
        onConfirm: (reason) => {
          postForm(`/jobs/${jobId}/applications/${appId}/status`, {
            status, reason: reason || '', returnTo: currentUrl()
          });
        }
      });
    };

    /* ----------------------------------------------------------------
       Bulk reject — called from onclick
       ---------------------------------------------------------------- */
    window.bulkReject = function (scope, count) {
      const jobId = getJobId();


      openConfirmModal({
        title: 'Bulk Reject',
        message: `Reject <strong>${count}</strong> ${scope} application${count === 1 ? '' : 's'}? This is logged in the audit trail.`,
        confirmLabel: `Reject ${count} Application${count === 1 ? '' : 's'}`,
        tone: 'danger',
        showReason: true,
        onConfirm: (reason) => {
          postForm(`/jobs/${jobId}/applications/bulk-reject`, {
            scope, reason: reason || '', returnTo: currentUrl()
          });
        }
      });
    };

    window.bulkRejectSelected = function () {

      const ids = Array.from(document.querySelectorAll('.app-checkbox:checked')).map(cb => cb.value);
      if (ids.length === 0){
        alert("here")
      };

      const jobId = getJobId();

      openConfirmModal({
        title: 'Reject Selected',
        message: `Reject <strong>${ids.length}</strong> selected application${ids.length === 1 ? '' : 's'}?`,
        confirmLabel: 'Reject Selected',
        tone: 'danger',
        showReason: true,
        onConfirm: (reason) => {
          const data = {
            scope: 'selected',
            reason: reason || '',
            returnTo: currentUrl()
          };
          ids.forEach((id, i) => {
            data[`applicationIds[${i}]`] = id;
          });
          postForm(`/jobs/${jobId}/applications/bulk-reject`, data);
        }
      });
    };

    /* ----------------------------------------------------------------
       Checkbox state + row expansion
       ---------------------------------------------------------------- */
    const selectAll       = document.getElementById('selectAll');
    const selectedCountEl = document.getElementById('selectedCount');
    const rejectSelBtn    = document.getElementById('bulkRejectSelected');
    const checkboxes      = Array.from(document.querySelectorAll('.app-checkbox'));

   function updateSelectedCount() {
     const n = checkboxes.filter(cb => cb.checked).length;

     if (selectedCountEl) {
       selectedCountEl.textContent = n === 0
         ? 'No rows selected'
         : n + ' row' + (n === 1 ? '' : 's') + ' selected';
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
        checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
        updateSelectedCount();
      });
    }

    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateSelectedCount);
      cb.addEventListener('click', e => e.stopPropagation());
    });
    updateSelectedCount();

    function toggleRowDrawer(appId) {
      const drawer = document.getElementById('details-' + appId);
      if (!drawer) return;
      drawer.classList.toggle('open');
      const btn = document.querySelector(`[data-expand-row="${appId}"]`);
      if (btn) btn.classList.toggle('open');
    }

    document.querySelectorAll('[data-expand-row]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleRowDrawer(btn.dataset.expandRow);
      });
    });

    document.querySelectorAll('.app-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button, a, input, label, form')) return;
        toggleRowDrawer(row.dataset.appId);
      });
    });
  });
})();