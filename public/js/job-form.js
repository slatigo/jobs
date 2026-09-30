/* ================================================================== */
/* JOB FORM — AJAX submit handler                                      */
/* Works for both create (/jobs) and edit (/jobs/:id/edit)             */
/* Requires: window.quill (set by the page)                            */
/* ================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('jobForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
    const quill = window.quill;

    /* ============================================================== */
    /* Error display helpers                                          */
    /* ============================================================== */
    function clearErrors() {
      form.querySelectorAll('.form-group.has-error').forEach((g) => g.classList.remove('has-error'));
      form.querySelectorAll('.field-error').forEach((e) => e.remove());
    }

    function showFieldError(name, message) {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) return;
      const group = field.closest('.form-group') || field.parentElement;
      group.classList.add('has-error');
      let err = group.querySelector('.field-error');
      if (!err) {
        err = document.createElement('small');
        err.className = 'field-error';
        group.appendChild(err);
      }
      err.textContent = message;
    }

    function showErrorToast(message, fieldErrors) {
      let html = `<div class="swal-error-message">${message}</div>`;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        html += '<ul class="swal-error-list">';
        Object.entries(fieldErrors).forEach(([field, msg]) => {
          if (field === '_global') return;
          html += `<li><strong>${field}:</strong> ${msg}</li>`;
        });
        html += '</ul>';
      }

      if (window.Swal) {
        Swal.fire({
          icon: 'error',
          title: 'Please fix the following',
          html,
          confirmButtonText: 'OK',
          confirmButtonColor: '#1e40af',
          customClass: {
            popup: 'swal-mubs-popup',
            title: 'swal-mubs-title'
          }
        });
      } else {
        /* Fallback if SweetAlert CDN failed to load */
        alert(message);
      }
    }

    function showSuccessToast(message) {
      if (!window.Swal) return false;
      Swal.fire({
        icon: 'success',
        title: message || 'Saved successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true
      });
      return true;
    }

    function setLoading(loading) {
      if (!submitBtn) return;
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading
        ? '<i class="fas fa-circle-notch fa-spin"></i> Saving…'
        : originalBtnHTML;
    }

    /* ============================================================== */
    /* Submit handler                                                 */
    /* ============================================================== */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      /* ---- Sync Quill into the hidden input ---- */
      if (quill) {
        const html = quill.root.innerHTML.trim();
        if (!html || html === '<p><br></p>') {
          showFieldError('description', 'Description is required.');
          return;
        }
        document.getElementById('descriptionInput').value = html;
      }

      /* ---- Validate stages if the editor is present ---- */
      const stagesInput = document.getElementById('stagesInput');
      if (stagesInput) {
        try {
          const stages = JSON.parse(stagesInput.value || '[]');
          if (!Array.isArray(stages) || stages.length === 0) {
            showErrorToast('Please define at least one application stage.', null);
            return;
          }
        } catch {
          showErrorToast('Stages data is invalid. Please try again.', null);
          return;
        }
      }

      /* ---- Build URL-encoded body ---- */
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form)) params.append(k, v);

      const descInput = document.getElementById('descriptionInput');
      if (descInput) params.set('description', descInput.value);
      if (stagesInput) params.set('stages', stagesInput.value);

      setLoading(true);

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: params.toString(),
          credentials: 'same-origin'
        });

        /* Server fell back to redirect/HTML — follow it */
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          window.location.href = res.url || '/jobs/new';
          return;
        }

        const json = await res.json().catch(() => ({}));

        /* ---- Success ---- */
        if (res.ok && json.ok) {
          const redirect = json.redirect || '/jobs';

          if (!showSuccessToast(json.message)) {
            window.location.href = redirect;
            return;
          }

          /* Give the toast ~1s to be seen, then navigate */
          setTimeout(() => {
            window.location.href = redirect;
          }, 1000);
          return;
        }

        /* ---- Failure: highlight fields + SweetAlert ---- */
        if (json.errors && typeof json.errors === 'object') {
          Object.entries(json.errors).forEach(([field, msg]) => {
            if (field !== '_global') showFieldError(field, msg);
          });
        }

        showErrorToast(
          json.message || 'Please review the highlighted fields.',
          json.errors
        );

        /* Scroll the first field error into view */
        const firstErr = form.querySelector('.has-error');
        if (firstErr) {
          firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (err) {
        console.error('[SUBMIT]', err);
        showErrorToast('Network error. Please try again.', null);
      } finally {
        setLoading(false);
      }
    });
  });
})();