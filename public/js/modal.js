/* ================================================================== */
/* CONFIRMATION MODAL                                                  */
/* ------------------------------------------------------------------ */
/* Any element with [data-confirm] opens the modal instead of using    */
/* window.confirm().                                                   */
/*                                                                     */
/* On a <form>:                                                        */
/*   <form action="..." method="POST" data-confirm="...">              */
/*                                                                     */
/* On a <button> inside a form:                                        */
/*   <button name="status" value="rejected" data-confirm="...">        */
/*                                                                     */
/* data-confirm         = Message shown in the modal                   */
/* data-confirm-title   = Optional heading (default: "Are you sure?")  */
/* data-confirm-label   = Optional confirm button text                 */
/* data-confirm-tone    = "danger" | "success" | "primary" | "warning" */
/* data-confirm-reason  = "true" to show the reason textarea           */
/* data-confirm-count   = Optional count text prepended to the message */
/* ================================================================== */
(function () {
  'use strict';

  // Don't run if the modal isn't on this page
  const modal = document.getElementById('confirmModal');
  if (!modal) return;

  const elTitle     = modal.querySelector('#modalTitle');
  const elSubtitle  = modal.querySelector('#modalSubtitle');
  const elMessage   = modal.querySelector('#modalMessage');
  const elIcon      = modal.querySelector('#modalIcon');
  const elReason    = modal.querySelector('#modalReason');
  const elReasonGrp = modal.querySelector('#modalReasonGroup');
  const btnCancel   = modal.querySelector('[data-modal-cancel]');
  const btnConfirm  = modal.querySelector('#modalConfirm');

  let pendingForm = null;
  let pendingReasonInputName = null;

  /* -------------------------------------------------------------- */
  /* Open / close                                                    */
  /* -------------------------------------------------------------- */
  function openModal(opts) {
    elTitle.textContent    = opts.title || 'Are you sure?';
    elSubtitle.textContent = opts.subtitle || 'This action may not be reversible.';

    if (opts.countText) {
      elMessage.innerHTML = `<p><strong>${opts.countText}</strong></p>` + (opts.message || '');
    } else {
      elMessage.innerHTML = opts.message || '';
    }

    const tone = opts.tone || 'danger';
    elIcon.className = 'modal-icon tone-' + tone;
    elIcon.innerHTML =
      tone === 'success' ? '<i class="fas fa-check-circle"></i>' :
      tone === 'primary' ? '<i class="fas fa-info-circle"></i>' :
      tone === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
                           '<i class="fas fa-exclamation-circle"></i>';

    btnConfirm.className = 'btn';
    btnConfirm.classList.add(
      tone === 'success' ? 'btn-success' :
      tone === 'primary' ? 'btn-primary' :
      tone === 'warning' ? 'btn-outline' :
                           'btn-danger'
    );
    btnConfirm.textContent = opts.confirmLabel || 'Confirm';

    if (opts.showReason) {
      elReasonGrp.style.display = 'block';
      elReason.value = '';
    } else {
      elReasonGrp.style.display = 'none';
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      if (opts.showReason) elReason.focus();
      else btnConfirm.focus();
    }, 50);
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    pendingForm = null;
    pendingReasonInputName = null;
  }

  /* -------------------------------------------------------------- */
  /* Read opts from an element's data-* attributes                   */
  /* -------------------------------------------------------------- */
  function optsFrom(el) {
    const ds = el.dataset;
    return {
      title:        ds.confirmTitle,
      subtitle:     ds.confirmSubtitle,
      message:      ds.confirm,
      confirmLabel: ds.confirmLabel,
      tone:         ds.confirmTone,
      showReason:   ds.confirmReason === 'true',
      countText:    ds.confirmCount
    };
  }

  /* -------------------------------------------------------------- */
  /* Intercept form submits (form-level data-confirm)                */
  /* -------------------------------------------------------------- */
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirmed === '1') return;
      e.preventDefault();

      pendingForm = form;
      pendingReasonInputName = 'reason';
      openModal(optsFrom(form));
    });
  });

  /* -------------------------------------------------------------- */
  /* Intercept button clicks (button-level data-confirm)             */
  /* -------------------------------------------------------------- */
  document.querySelectorAll('button[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const form = btn.closest('form');
      if (!form) return;
      e.preventDefault();

      pendingForm = form;
      pendingReasonInputName = 'reason';
      form.dataset.pendingSubmitName  = btn.name;
      form.dataset.pendingSubmitValue = btn.value;

      openModal(optsFrom(btn));
    });
  });

  /* -------------------------------------------------------------- */
  /* Modal buttons                                                   */
  /* -------------------------------------------------------------- */
  btnCancel.addEventListener('click', closeModal);

  btnConfirm.addEventListener('click', () => {
    if (!pendingForm) return closeModal();

    if (pendingReasonInputName) {
      const reasonVal = elReason.value.trim();
      let hidden = pendingForm.querySelector(`input[name="${pendingReasonInputName}"]`);
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = pendingReasonInputName;
        pendingForm.appendChild(hidden);
      }
      hidden.value = reasonVal;
    }

    if (pendingForm.dataset.pendingSubmitName) {
      let hidden = pendingForm.querySelector(
        `input[name="${pendingForm.dataset.pendingSubmitName}"]`
      );
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = pendingForm.dataset.pendingSubmitName;
        pendingForm.appendChild(hidden);
      }
      hidden.value = pendingForm.dataset.pendingSubmitValue;
      delete pendingForm.dataset.pendingSubmitName;
      delete pendingForm.dataset.pendingSubmitValue;
    }

    pendingForm.dataset.confirmed = '1';
    pendingForm.submit();
    closeModal();
  });

  /* -------------------------------------------------------------- */
  /* Backdrop click + Esc key                                        */
  /* -------------------------------------------------------------- */
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
})();