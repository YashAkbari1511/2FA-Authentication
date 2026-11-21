// Auto dismiss and close handler for alert banners
document.addEventListener('DOMContentLoaded', () => {
  const alerts = document.querySelectorAll('.alert');

  alerts.forEach((alert) => {
    // Add close button functionality
    const closeBtn = alert.querySelector('.alert-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dismissAlert(alert);
      });
    }

    // Auto-dismiss after 6 seconds (if not an error alert)
    if (!alert.classList.contains('alert-error') && !alert.classList.contains('alert-danger')) {
      setTimeout(() => {
        dismissAlert(alert);
      }, 6000);
    }
  });

  function dismissAlert(el) {
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      el.remove();
    }, 300);
  }
});
