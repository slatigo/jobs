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

// Active nav on scroll (bonus)