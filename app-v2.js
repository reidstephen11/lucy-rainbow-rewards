/* ────────────────────────────────────────────────────────────────────────
   Lucy's Rainbow v2 — core app
   Preserves the geometry/state model from v1 and adds:
     • Week strip (Mon–Sun cards)
     • Stats trio: this week / weekly streak / total stars
     • Theme + accent + motion swap API for Tweaks
   ──────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // === Constants ========================================================
  const STORAGE = {
    checkpoint: 'lucy-rainbow-checkpoint',
    totalStars: 'lucy-rainbow-total-stars',
    streak: 'lucy-rainbow-streak',
    lastWeekIso: 'lucy-rainbow-last-week-iso',
  };

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const TOTAL_POSITIONS = 8;
  const TOTAL_DAYS = DAYS.length;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const POT_OFFSET_X = 14;
  const POT_OFFSET_Y = -14;

  // === Refs =============================================================
  const root = document.documentElement;
  const centerPath = document.getElementById('center-path');
  const checkpointsGroup = document.getElementById('checkpoints');
  const avatar = document.getElementById('avatar');
  const avatarImage = document.getElementById('avatar-image');
  const avatarFallback = document.getElementById('avatar-fallback');
  const pot = document.getElementById('pot');
  const potAnchor = document.getElementById('pot-anchor');
  const doneBtn = document.getElementById('done-btn');
  const resetBtn = document.getElementById('reset-btn');
  const confettiHost = document.getElementById('confetti');
  const brandDate = document.getElementById('brand-date');
  const weekstrip = document.getElementById('weekstrip');
  const statWeek = document.getElementById('stat-week');
  const statStreak = document.getElementById('stat-streak');
  const statStars = document.getElementById('stat-stars');
  const streakNum = document.getElementById('streak-num');
  const footnote = document.getElementById('footnote');

  // === Path geometry ====================================================
  const pathLength = centerPath.getTotalLength();
  const positionLengths = [];
  const positionPoints = [];
  for (let i = 0; i < TOTAL_POSITIONS; i++) {
    const t = i / (TOTAL_POSITIONS - 1);
    const len = t * pathLength;
    const pt = centerPath.getPointAtLength(len);
    positionLengths.push(len);
    positionPoints.push({ x: pt.x, y: pt.y });
  }

  // Checkpoints — small dots on the arc, one per day.
  for (let i = 1; i < TOTAL_POSITIONS; i++) {
    const p = positionPoints[i];
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', 5.5);
    c.classList.add('checkpoint');
    c.dataset.dayIndex = String(i - 1);
    checkpointsGroup.appendChild(c);
  }

  // Pot of gold anchor
  const endPoint = positionPoints[TOTAL_POSITIONS - 1];
  potAnchor.setAttribute(
    'transform',
    `translate(${endPoint.x + POT_OFFSET_X}, ${endPoint.y + POT_OFFSET_Y})`
  );

  // Avatar fallback if image fails to load
  avatarImage.addEventListener('error', () => {
    avatarImage.style.display = 'none';
    avatarFallback.style.display = '';
  });

  // === Week strip ========================================================
  function buildWeekStrip() {
    weekstrip.innerHTML = '';
    DAYS.forEach((day, i) => {
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      cell.dataset.dayIndex = String(i);
      cell.innerHTML = `
        <span class="day-cell-label">${day}</span>
        <span class="day-cell-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      `;
      weekstrip.appendChild(cell);
    });
  }
  buildWeekStrip();

  // === State ============================================================
  let current = loadInt(STORAGE.checkpoint, 0, 0, TOTAL_POSITIONS - 1);
  let totalStars = loadInt(STORAGE.totalStars, 0, 0, Infinity);
  let streak = loadInt(STORAGE.streak, 0, 0, Infinity);
  let lastWeekIso = localStorage.getItem(STORAGE.lastWeekIso) || '';
  let currentLength = positionLengths[current];
  let animFrame = null;

  function loadInt(key, fallback, min, max) {
    const raw = localStorage.getItem(key);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function save() {
    localStorage.setItem(STORAGE.checkpoint, String(current));
    localStorage.setItem(STORAGE.totalStars, String(totalStars));
    localStorage.setItem(STORAGE.streak, String(streak));
    localStorage.setItem(STORAGE.lastWeekIso, lastWeekIso);
  }

  // === Date helpers ======================================================
  function isoWeekKey(d) {
    // YYYY-Www (ISO week-year + week)
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  brandDate.textContent = formatDate(new Date());

  // === Easing ===========================================================
  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // === Animation ========================================================
  function setAvatarAtLength(len) {
    const pt = centerPath.getPointAtLength(len);
    avatar.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
  }

  function travelTo(targetLength, onDone) {
    if (animFrame) cancelAnimationFrame(animFrame);
    avatar.classList.remove('floating');

    const travelMs = parseInt(getComputedStyle(root).getPropertyValue('--travel-ms'), 10) || 800;
    const start = performance.now();
    const from = currentLength;
    const distance = targetLength - from;

    function step(now) {
      const t = Math.min(1, (now - start) / travelMs);
      const eased = easeOutBack(t);
      setAvatarAtLength(from + distance * eased);

      if (t < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentLength = targetLength;
        animFrame = null;
        avatar.classList.add('floating');
        if (onDone) onDone();
      }
    }

    animFrame = requestAnimationFrame(step);
  }

  // === Renderers ========================================================
  function renderCheckpoints(position) {
    checkpointsGroup.querySelectorAll('.checkpoint').forEach((dot) => {
      const dayIndex = parseInt(dot.dataset.dayIndex, 10);
      dot.classList.toggle('reached', dayIndex + 1 <= position);
    });
  }

  function renderWeekStrip(position) {
    weekstrip.querySelectorAll('.day-cell').forEach((cell) => {
      const dayIndex = parseInt(cell.dataset.dayIndex, 10);
      const done = dayIndex + 1 <= position;
      const isToday = dayIndex + 1 === position;
      cell.classList.toggle('done', done);
      cell.classList.toggle('today', isToday);
    });
  }

  function renderStats() {
    statWeek.innerHTML = `${current}<span class="stat-denom">/7</span>`;
    statStreak.textContent = String(streak);
    statStars.textContent = String(totalStars);
    streakNum.textContent = String(streak);
  }

  function renderButtons(position) {
    const atEnd = position >= TOTAL_POSITIONS - 1;
    doneBtn.disabled = atEnd;
    const labelEl = doneBtn.querySelector('.btn-label');
    if (labelEl) labelEl.textContent = atEnd ? 'Week complete — well done, Lucy!' : 'Mark today\'s chore done';
  }

  // === Celebrations =====================================================
  function celebratePot() {
    pot.classList.remove('celebrate');
    void pot.getBoundingClientRect();
    pot.classList.add('celebrate');
  }

  function launchConfetti() {
    const accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff7aa2';
    const colours = [
      '#ff8da0', '#ffc290', '#ffe69a',
      '#a4f0c5', '#9bd3ff', '#b9b1ff', '#dcaaff',
      accent, '#ffffff'
    ];
    const count = 80;
    confettiHost.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'piece';
      piece.style.left = Math.random() * 100 + '%';
      const c = colours[i % colours.length];
      piece.style.background = c;
      piece.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiHost.appendChild(piece);
    }
    setTimeout(() => { confettiHost.innerHTML = ''; }, 4000);
  }

  function celebrate() {
    celebratePot();
    launchConfetti();
    // Streak: only count this week once.
    const thisWeek = isoWeekKey(new Date());
    if (lastWeekIso !== thisWeek) {
      streak += 1;
      lastWeekIso = thisWeek;
    }
  }

  // === Initial render ===================================================
  setAvatarAtLength(currentLength);
  if (current < TOTAL_POSITIONS - 1) avatar.classList.add('floating');
  renderCheckpoints(current);
  renderWeekStrip(current);
  renderStats();
  renderButtons(current);

  // === Actions ==========================================================
  doneBtn.addEventListener('click', () => {
    if (current >= TOTAL_POSITIONS - 1) return;
    current += 1;
    totalStars += 1;
    renderWeekStrip(current);
    renderButtons(current);
    renderStats();

    travelTo(positionLengths[current], () => {
      renderCheckpoints(current);
      if (current >= TOTAL_POSITIONS - 1) {
        celebrate();
        renderStats();
      }
      save();
    });
  });

  resetBtn.addEventListener('click', () => {
    if (!window.confirm('Reset this week back to Monday? Streak and total stars are kept.')) return;
    current = 0;
    renderButtons(current);
    renderWeekStrip(current);
    renderStats();
    travelTo(positionLengths[0], () => {
      renderCheckpoints(current);
      save();
    });
  });

  // === External theme/motion/accent API for Tweaks ======================
  function hexToOklchAccent(hex) {
    // Set CSS vars without recomputing — let the browser inherit colour;
    // we just paint --accent + a soft tint.
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-soft', hex + '2e'); // ~0.18 alpha
  }

  window.LucyApp = {
    setTheme(theme) {
      const valid = ['morning', 'twilight', 'meadow'];
      if (!valid.includes(theme)) return;
      root.setAttribute('data-theme', theme);
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        'content',
        theme === 'twilight' ? '#0c0a1f' : theme === 'meadow' ? '#eef2e6' : '#f5ecdf'
      );
    },
    setAccent(hex) { hexToOklchAccent(hex); },
    setMotion(motion) {
      const valid = ['calm', 'normal', 'lively'];
      if (!valid.includes(motion)) return;
      root.setAttribute('data-motion', motion);
    },
    setShowStats(show) {
      document.querySelector('.stats').style.display = show ? '' : 'none';
    },
    setShowFootnote(show) {
      footnote.style.display = show ? '' : 'none';
    },
  };
})();
