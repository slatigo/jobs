// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.querySelector('.main-nav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));
  // Close when a link is clicked
  mainNav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => mainNav.classList.remove('open'))
  );
}

// Auto-dismiss alerts
document.querySelectorAll('.alert').forEach(alert => {
  const close = alert.querySelector('.alert-close');
  if (close) close.addEventListener('click', () => alert.remove());
  setTimeout(() => {
    alert.style.transition = 'opacity .3s, transform .3s';
    alert.style.opacity = '0';
    alert.style.transform = 'translateY(-8px)';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
});
/* ==================================================================
   COPY SHARE LINK
   ================================================================== */
window.copyShareLink = function (btn) {
  const card  = btn.closest('.share-card');
  const input = card ? card.querySelector('.share-link-input') : null;
  if (!input) return;

  /* Build the absolute URL from the input's relative value */
  let url = input.value.trim();
  if (url.startsWith('/')) {
    url = window.location.origin + url;
  }

  const label = btn.querySelector('span');
  const originalText = label ? label.textContent : '';

  const done = () => {
    if (label) label.textContent = 'Copied!';
    btn.classList.add('is-copied');
    setTimeout(() => {
      if (label) label.textContent = originalText;
      btn.classList.remove('is-copied');
    }, 1500);
  };

  const legacyCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, url.length);
    try {
      document.execCommand('copy');
      done();
    } catch (err) {
      console.error('[copy] failed', err);
      window.prompt('Copy this link:', url);
    } finally {
      document.body.removeChild(ta);
    }
  };


  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url)
      .then(done)
      .catch(legacyCopy);
  } else {
    legacyCopy();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');
      const target = document.getElementById(targetId);
      if (!target) return;

      const isOpen = !target.hidden;
      target.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.classList.toggle('is-open', !isOpen);
    });
  });

  // Auto-open if any non-search filter is active
  const anyActive = ['department','type','terms','location','status'].some((key) => {
    const el = document.querySelector(`[name="${key}"]`);
    return el && el.value && el.value !== 'All' && el.value !== '';
  });
  if (anyActive) {
    const toggle = document.querySelector('.filter-toggle');
    const panel = document.getElementById('filter-extra');
    if (toggle && panel) {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.classList.add('is-open');
    }
  }
});
// Active nav on scroll (bonus)