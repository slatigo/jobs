/* ================================================================== */
/* APPLICATIONS PAGE                                                   */
/* ------------------------------------------------------------------ */
/* Handles:                                                             */
/*   - Per-row status changes (single click)                            */
/*   - Bulk move to any stage (stage picker + "Apply")                  */
/*   - Reject-all-in-current-stage shortcut                             */
/*   - Row drawer expansion                                             */
/*   - Checkbox state                                                   */
/*   - Stage menu popover (portalled, fixed-position)                   */
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
    /* -------------------------------------------------------------- */
    window.bulkMoveSelected = function () {
      const ids = Array.from(document.querySelectorAll('.app-checkbox:checked'))
        .map((cb) => cb.value);

      if (ids.length === 0) {
        openConfirmModal({
          title: 'No applications selected',
          message: 'Tick at least one application before clicking Apply.',
          confirmLabel: 'OK',
          tone: 'warning',
          showReason: false,
          onConfirm: () => {}
        });
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
    /* Checkbox state                                                  */
    /* -------------------------------------------------------------- */
    const selectAll       = document.getElementById('selectAll');
    const selectedCountEl = document.getElementById('selectedCount');
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
        moveSelBtn.classList.toggle('is-dim', n === 0);
        // don't touch .disabled — let clicks through so we can show the modal
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

    /* -------------------------------------------------------------- */
    /* Stage menu popover — PORTALLED                                  */
    /* The menu element lives outside the table (see applications.pug) */
    /* and is positioned with position: fixed via JS.                  */
    /* -------------------------------------------------------------- */
    let openMenu = null;
    let openTrigger = null;

    function closeOpenMenu() {
      if (!openMenu) return;
      openMenu.hidden = true;
      if (openTrigger) openTrigger.setAttribute('aria-expanded', 'false');
      openMenu = null;
      openTrigger = null;
    }

    function positionMenu(menuEl, triggerEl) {
      const tRect = triggerEl.getBoundingClientRect();
      const mRect = menuEl.getBoundingClientRect();

      /* Default: below the trigger, aligned to its left edge */
      let top  = tRect.bottom + 6;
      let left = tRect.left;

      /* Flip above if it would overflow the bottom of the viewport */
      if (top + mRect.height > window.innerHeight - 8) {
        top = tRect.top - mRect.height - 6;
      }

      /* Flip to right-aligned if it would overflow the right edge */
      if (left + mRect.width > window.innerWidth - 8) {
        left = tRect.right - mRect.width;
      }

      /* Clamp inside the viewport */
      if (left < 8) left = 8;
      if (top  < 8) top  = 8;

      menuEl.style.top  = top  + 'px';
      menuEl.style.left = left + 'px';
    }

    function openStageMenu(appId, menuEl, triggerEl) {
      closeOpenMenu();

      /* Unhide FIRST so getBoundingClientRect returns real dimensions */
      menuEl.hidden = false;
      menuEl.dataset.forApp = appId;

      positionMenu(menuEl, triggerEl);

      triggerEl.setAttribute('aria-expanded', 'true');
      openMenu = menuEl;
      openTrigger = triggerEl;

      /* Focus first enabled item for keyboard users */
      const first = menuEl.querySelector('.stage-menu-item:not(:disabled)');
      if (first) first.focus();
    }

    document.querySelectorAll('[data-stage-menu]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const appId = trigger.dataset.stageMenu;
        const menu = document.getElementById(`stage-menu-${appId}`);
        if (!menu) return;

        if (openMenu === menu) {
          closeOpenMenu();
        } else {
          openStageMenu(appId, menu, trigger);
        }
      });
    });

    /* Item click → fire changeStatus */
    document.querySelectorAll('.stage-menu-item[data-target-key]').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const appId    = item.dataset.appId;
        const key      = item.dataset.targetKey;
        const label    = item.dataset.targetLabel;
        const appName  = item.dataset.appName;
        closeOpenMenu();
        window.changeStatus(appId, key, appName, label);
      });
    });

    /* Close on outside click */
    document.addEventListener('click', (e) => {
      if (!openMenu) return;
      if (e.target.closest('.stage-menu-portal') || e.target.closest('[data-stage-menu]')) return;
      closeOpenMenu();
    });

    /* Close on Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOpenMenu();
    });

    /* Reposition on scroll (fixed positioning means the menu must follow
       the trigger; closing here would be jarring). */
    window.addEventListener('scroll', () => {
      if (openMenu && openTrigger) positionMenu(openMenu, openTrigger);
    }, { passive: true, capture: true });

    /* Reposition on resize */
    window.addEventListener('resize', () => {
      if (openMenu && openTrigger) positionMenu(openMenu, openTrigger);
    });

  });
})();