/* ================================================================== */
/* MODAL — simple global helper                                        */
/* ================================================================== */
(function () {
  'use strict';

  const modal      = document.getElementById('confirmModal');
  if (!modal) return;

  const elTitle    = document.getElementById('modalTitle');
  const elSubtitle = document.getElementById('modalSubtitle');
  const elMessage  = document.getElementById('modalMessage');
  const elIcon     = document.getElementById('modalIcon');
  const elReason   = document.getElementById('modalReason');
  const elReasonGrp= document.getElementById('modalReasonGroup');
  const btnConfirm = document.getElementById('modalConfirm');

  let onConfirm = null;

  /* ---------------------------------------------------------------- */
  /* openModal — public function used by page scripts                */
  /*   opts: { title, subtitle, message, tone, confirmLabel,          */
  /*           showReason, onConfirm(reason) }                        */
  /* ---------------------------------------------------------------- */
  window.openConfirmModal = function (opts) {
    opts = opts || {};

    elTitle.textContent    = opts.title    || 'Are you sure?';
    elSubtitle.textContent = opts.subtitle || 'This action may not be reversible.';
    elMessage.innerHTML    = opts.message  || '';

    const tone = opts.tone || 'danger';
    elIcon.className = 'modal-icon tone-' + tone;
    elIcon.innerHTML =
      tone === 'success' ? '<i class="fas fa-check-circle"></i>' :
      tone === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
                           '<i class="fas fa-exclamation-circle"></i>';

    btnConfirm.className = 'btn';
    btnConfirm.classList.add(
      tone === 'success' ? 'btn-success' :
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

    onConfirm = opts.onConfirm || null;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      if (opts.showReason) elReason.focus();
      else btnConfirm.focus();
    }, 50);
  };

  window.closeModal = function () {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    onConfirm = null;
  };

  /* ---------------------------------------------------------------- */
  /* Confirm button — runs the callback                              */
  /* ---------------------------------------------------------------- */
  btnConfirm.addEventListener('click', () => {
    const reason = elReason.value.trim();
    const cb = onConfirm;
    closeModal();
    if (typeof cb === 'function') cb(reason);
  });

  /* Backdrop + Esc */
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
})();