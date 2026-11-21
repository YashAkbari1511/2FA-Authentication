/**
 * 6-Digit OTP Input Handler
 * Features: Auto-advance, backspace navigation, paste handling, autofill support, and hidden input syncing.
 */
document.addEventListener('DOMContentLoaded', () => {
  const otpContainers = document.querySelectorAll('.otp-container');

  otpContainers.forEach((container) => {
    const boxes = container.querySelectorAll('.otp-box');
    const form = container.closest('form');
    const hiddenInput = form ? form.querySelector('input[type="hidden"].otp-hidden-value') : null;

    if (!boxes.length) return;

    // Only auto-focus if not inside a hidden modal and no other input on page has autofocus
    const isInsideModal = container.closest('.modal-backdrop');
    const hasOtherAutofocus = document.querySelector('input[autofocus]:not(.otp-box)');
    if (!isInsideModal && !hasOtherAutofocus) {
      setTimeout(() => {
        if (boxes[0]) boxes[0].focus();
      }, 150);
    }

    const syncValue = () => {
      let fullCode = '';
      boxes.forEach((box) => {
        fullCode += box.value.trim();
      });
      if (hiddenInput) {
        hiddenInput.value = fullCode;
      }
    };

    boxes.forEach((box, index) => {
      // Keydown handler
      box.addEventListener('keydown', (e) => {
        // Handle Backspace
        if (e.key === 'Backspace') {
          if (!box.value && index > 0) {
            boxes[index - 1].focus();
            boxes[index - 1].value = '';
          } else {
            box.value = '';
          }
          syncValue();
          e.preventDefault();
          return;
        }

        // Handle Arrow Left
        if (e.key === 'ArrowLeft' && index > 0) {
          boxes[index - 1].focus();
          e.preventDefault();
          return;
        }

        // Handle Arrow Right
        if (e.key === 'ArrowRight' && index < boxes.length - 1) {
          boxes[index + 1].focus();
          e.preventDefault();
          return;
        }
      });

      // Input handler (handles typed single digits and multi-digit browser autofills)
      box.addEventListener('input', () => {
        const val = box.value;
        const digits = val.replace(/\D/g, '');

        if (digits.length > 1) {
          // Multi-digit paste or password manager autofill
          for (let i = 0; i < digits.length && (index + i) < boxes.length; i++) {
            boxes[index + i].value = digits.charAt(i);
          }
          syncValue();
          const nextIndex = Math.min(index + digits.length, boxes.length - 1);
          boxes[nextIndex].focus();
        } else if (digits.length === 1) {
          box.value = digits;
          syncValue();
          // Advance to next box
          if (index < boxes.length - 1) {
            boxes[index + 1].focus();
          }
        } else {
          box.value = '';
          syncValue();
        }
      });

      // Paste handler
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData).getData('text');
        const cleanDigits = pastedData.replace(/\D/g, '').slice(0, boxes.length);

        if (cleanDigits) {
          cleanDigits.split('').forEach((char, i) => {
            if (boxes[i]) {
              boxes[i].value = char;
            }
          });
          syncValue();
          // Focus the next empty box or the last box
          const targetIndex = Math.min(cleanDigits.length, boxes.length - 1);
          boxes[targetIndex].focus();
        }
      });
    });

    // Ensure hidden input is updated before form submission
    if (form) {
      form.addEventListener('submit', () => {
        syncValue();
      });
    }
  });
});
