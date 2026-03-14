/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS HELPER — 3D Glassmorphism Theme
   Auto-initializes: bell wobble, KPI count-up, stagger resets
═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ── Bell Wobble (every 5 seconds) ──
  function initBellWobble() {
    // Look for notification bell icons (in nav items with bell icon)
    const bells = document.querySelectorAll('.nav-item i.ri-notification-3-line, .notif-btn i.ri-notification-3-line');
    if (!bells.length) return;

    setInterval(() => {
      bells.forEach(bell => {
        const parent = bell.closest('.nav-item') || bell.closest('.notif-btn');
        if (parent) {
          parent.classList.add('bell-wobble');
          setTimeout(() => parent.classList.remove('bell-wobble'), 600);
        }
      });
    }, 5000);
  }

  // ── KPI Count-Up Animation ──
  function animateCountUp(el, target, duration) {
    if (isNaN(target) || target === 0) return;
    const start = 0;
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCountUp() {
    // Observe KPI values for changes and animate them
    const kpiValues = document.querySelectorAll('.kpi-value');
    if (!kpiValues.length) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const el = mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
          if (el && el.classList && el.classList.contains('kpi-value')) {
            const text = el.textContent.trim();
            const num = parseInt(text, 10);
            if (!isNaN(num) && num > 0 && !el.dataset.animated) {
              el.dataset.animated = '1';
              el.textContent = '0';
              animateCountUp(el, num, 800);
              // Reset flag after animation
              setTimeout(() => delete el.dataset.animated, 1000);
            }
          }
        }
      });
    });

    kpiValues.forEach(el => {
      observer.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  // ── Re-trigger stagger animations on section switch ──
  function initSectionTransitions() {
    // When sections become visible, re-trigger animations
    const originalShowSection = window.showSection;
    if (typeof originalShowSection === 'function') {
      window.showSection = function(name) {
        originalShowSection(name);
        // Re-trigger card enter animations
        const section = document.getElementById('section-' + name);
        if (section) {
          const cards = section.querySelectorAll('.card, .kpi-card');
          cards.forEach((card, i) => {
            card.style.animation = 'none';
            card.offsetHeight; // Trigger reflow
            card.style.animation = '';
            card.style.animationDelay = (i * 0.1) + 's';
          });
          // Re-trigger row animations
          const rows = section.querySelectorAll('tbody tr');
          rows.forEach((row, i) => {
            row.style.animation = 'none';
            row.offsetHeight;
            row.style.animation = '';
            row.style.animationDelay = (i * 0.05) + 's';
          });
        }
      };
    }
  }

  // ── Initialize on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to let page JS initialize first
    setTimeout(init, 100);
  }

  function init() {
    initBellWobble();
    initCountUp();
    initSectionTransitions();
  }
})();
