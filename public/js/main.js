/**
 * Main application client script
 * Handles clipboard copy, modals, recovery codes download, tab switching, and password strength
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Copy to clipboard
  const copyButtons = document.querySelectorAll('[data-copy]');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetSelector = btn.getAttribute('data-copy');
      let textToCopy = '';

      if (targetSelector.startsWith('#') || targetSelector.startsWith('.')) {
        const targetEl = document.querySelector(targetSelector);
        if (targetEl) {
          textToCopy = targetEl.textContent.trim();
        }
      } else {
        textToCopy = targetSelector; // Direct string
      }

      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          const originalText = btn.innerHTML;
          btn.innerHTML = '✓ Copied!';
          btn.classList.add('btn-copied');

          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-copied');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy: ', err);
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = textToCopy;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          alert('Copied to clipboard!');
        }
      }
    });
  });

  // 2. Download Recovery Codes as .txt file
  const downloadCodesBtn = document.getElementById('downloadCodesBtn');
  if (downloadCodesBtn) {
    downloadCodesBtn.addEventListener('click', () => {
      const codePills = document.querySelectorAll('.recovery-code-pill');
      if (!codePills.length) return;

      const codes = Array.from(codePills).map((pill) => pill.getAttribute('data-code') || pill.textContent.replace(/^\s*\d+\.\s*/, '').trim());
      const fileContent = [
        '=====================================================',
        '  TWO-FACTOR AUTHENTICATION (2FA) RECOVERY CODES',
        '=====================================================',
        '',
        'IMPORTANT: Keep these recovery codes in a safe place.',
        'Each code can only be used once if you lose access to',
        'your authenticator device.',
        '',
        'Your Recovery Codes:',
        ...codes.map((code, idx) => `  ${idx + 1}. ${code}`),
        '',
        `Generated on: ${new Date().toUTCString()}`,
        '=====================================================',
      ].join('\n');

      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '2fa-recovery-codes.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // 2b. Copy All Recovery Codes
  const copyAllCodesBtn = document.getElementById('copyAllCodesBtn');
  if (copyAllCodesBtn) {
    copyAllCodesBtn.addEventListener('click', async () => {
      const codePills = document.querySelectorAll('.recovery-code-pill');
      if (!codePills.length) return;

      const codes = Array.from(codePills).map((pill) => pill.getAttribute('data-code') || pill.textContent.replace(/^\s*\d+\.\s*/, '').trim());
      const textToCopy = codes.join('\n');
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = copyAllCodesBtn.innerHTML;
        copyAllCodesBtn.innerHTML = '✓ Copied All Codes!';
        copyAllCodesBtn.classList.add('btn-copied');

        setTimeout(() => {
          copyAllCodesBtn.innerHTML = originalText;
          copyAllCodesBtn.classList.remove('btn-copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy all codes: ', err);
      }
    });
  }

  // 3. Modal Controls
  const openModalBtns = document.querySelectorAll('[data-modal-open]');
  const closeModalBtns = document.querySelectorAll('[data-modal-close]');

  openModalBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-modal-open');
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';

        // Auto-focus first input inside modal
        const firstInput = modal.querySelector('input:not([type="hidden"])');
        if (firstInput) {
          setTimeout(() => firstInput.focus(), 100);
        }
      }
    });
  });

  closeModalBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // Close modal when clicking backdrop
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Close modal with ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-backdrop.active');
      if (activeModal) {
        activeModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  });

  // 4. Tab switching for tabs across the application
  const tabBtns = document.querySelectorAll('[data-tab-target]');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-tab-target');

      // Scope active state to this button's nav bar
      const nav = btn.closest('.tabs-nav') || btn.parentElement;
      nav.querySelectorAll('[data-tab-target]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Scope panels to closest container or entire page
      const container = btn.closest('.tabs-container') || document;
      const panels = container.querySelectorAll('.tab-panel');
      panels.forEach((p) => (p.style.display = 'none'));

      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.style.display = 'block';
        // Auto-focus input if exists
        const firstInput = targetPanel.querySelector('input:not([type="hidden"])');
        if (firstInput) firstInput.focus();
      }
    });
  });

  // 5. Password Strength Meter (Registration page)
  const regPassword = document.getElementById('regPassword');
  const strengthBar = document.getElementById('passwordStrengthBar');
  const strengthText = document.getElementById('passwordStrengthText');

  if (regPassword && strengthBar && strengthText) {
    regPassword.addEventListener('input', () => {
      const val = regPassword.value;
      let score = 0;

      if (val.length >= 8) score += 1;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
      if (/\d/.test(val)) score += 1;
      if (/[^A-Za-z0-9]/.test(val)) score += 1;

      if (val.length === 0) {
        strengthBar.style.width = '0%';
        strengthBar.style.backgroundColor = '#e2e8f0';
        strengthText.textContent = '';
      } else if (score <= 1) {
        strengthBar.style.width = '25%';
        strengthBar.style.backgroundColor = '#ef4444';
        strengthText.textContent = 'Weak';
        strengthText.style.color = '#ef4444';
      } else if (score === 2) {
        strengthBar.style.width = '50%';
        strengthBar.style.backgroundColor = '#f59e0b';
        strengthText.textContent = 'Fair';
        strengthText.style.color = '#f59e0b';
      } else if (score === 3) {
        strengthBar.style.width = '75%';
        strengthBar.style.backgroundColor = '#3b82f6';
        strengthText.textContent = 'Good';
        strengthText.style.color = '#3b82f6';
      } else {
        strengthBar.style.width = '100%';
        strengthBar.style.backgroundColor = '#10b981';
        strengthText.textContent = 'Strong';
        strengthText.style.color = '#10b981';
      }
    });
  }
});
