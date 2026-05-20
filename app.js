(function () {
  'use strict';

  const STORAGE_KEY = 'lucy-rainbow-checkpoint';
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const TOTAL_POSITIONS = 8;          // 0 = start (before Monday), 1–7 = Mon–Sun
  const TOTAL_DAYS = DAYS.length;     // 7
  const TRAVEL_MS = 800;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const ARC_CX = 200;
  const ARC_CY = 220;
  const LABEL_R = 200;
  const POT_OFFSET_X = 14;
  const POT_OFFSET_Y = -14;

  const centerPath = document.getElementById('center-path');
  const checkpointsGroup = document.getElementById('checkpoints');
  const dayLabelsGroup = document.getElementById('day-labels');
  const avatar = document.getElementById('avatar');
  const avatarImage = document.getElementById('avatar-image');
  const avatarFallback = document.getElementById('avatar-fallback');
  const pot = document.getElementById('pot');
  const potAnchor = document.getElementById('pot-anchor');
  const progressLabel = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const doneBtn = document.getElementById('done-btn');
  const resetBtn = document.getElementById('reset-btn');
  const confettiHost = document.getElementById('confetti');

  // === Path geometry ===
  // 8 evenly-spaced positions along the rainbow.
  // Position 0 is the starting line (before Monday); positions 1–7 are the days.
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

  // Draw a checkpoint dot for each day (positions 1–7). Position 0 has no dot —
  // Lucy just sits there at the start of the rainbow before any day is done.
  for (let i = 1; i < TOTAL_POSITIONS; i++) {
    const p = positionPoints[i];
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', 8);
    c.classList.add('checkpoint');
    c.dataset.dayIndex = String(i - 1); // 0 = Mon, …, 6 = Sun
    checkpointsGroup.appendChild(c);
  }

  // === Day labels (Mon–Sun at positions 1–7) ===
  // Radially outward from the arc centre. Tilt Sun's label down so it doesn't
  // sit underneath the pot of gold at the end of the rainbow.
  function labelAngleDeg(dayIndex) {
    // Position index along the arc = dayIndex + 1 (since 0 is the start).
    const posIndex = dayIndex + 1;
    const t = posIndex / (TOTAL_POSITIONS - 1);
    const base = 180 + t * 180; // upper arc: 180° → 360° in SVG (y-down) coords
    if (dayIndex === TOTAL_DAYS - 1) return 10;   // Sun: tilt down-right
    return base;
  }

  DAYS.forEach((day, dayIndex) => {
    const rad = labelAngleDeg(dayIndex) * Math.PI / 180;
    const lx = ARC_CX + Math.cos(rad) * LABEL_R;
    const ly = ARC_CY + Math.sin(rad) * LABEL_R;

    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('day-label');
    g.dataset.dayIndex = String(dayIndex);
    g.setAttribute('transform', `translate(${lx}, ${ly})`);

    const pill = document.createElementNS(SVG_NS, 'rect');
    pill.setAttribute('x', -17);
    pill.setAttribute('y', -9);
    pill.setAttribute('width', 34);
    pill.setAttribute('height', 18);
    pill.setAttribute('rx', 9);
    pill.classList.add('day-pill');

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0.5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.classList.add('day-text');
    text.textContent = day;

    g.appendChild(pill);
    g.appendChild(text);
    dayLabelsGroup.appendChild(g);
  });

  // === Pot of gold position (always at the end of the rainbow) ===
  const endPoint = positionPoints[TOTAL_POSITIONS - 1];
  potAnchor.setAttribute(
    'transform',
    `translate(${endPoint.x + POT_OFFSET_X}, ${endPoint.y + POT_OFFSET_Y})`
  );

  // Avatar fallback only on actual load failure
  avatarImage.addEventListener('error', () => {
    avatarImage.style.display = 'none';
    avatarFallback.style.display = '';
  });

  // === State ===
  // `current` is the position index (0–7). 0 = start, 7 = pot of gold.
  // Days completed = current (so 0 means none done, 7 means all 7 done).
  let current = loadCheckpoint();
  let currentLength = positionLengths[current];
  let animFrame = null;

  function loadCheckpoint() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(TOTAL_POSITIONS - 1, n));
  }

  function saveCheckpoint(n) {
    localStorage.setItem(STORAGE_KEY, String(n));
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function setAvatarAtLength(len) {
    const pt = centerPath.getPointAtLength(len);
    avatar.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
  }

  function travelTo(targetLength, onDone) {
    if (animFrame) cancelAnimationFrame(animFrame);

    const start = performance.now();
    const from = currentLength;
    const distance = targetLength - from;

    function step(now) {
      const t = Math.min(1, (now - start) / TRAVEL_MS);
      const eased = easeOutBack(t);
      setAvatarAtLength(from + distance * eased);

      if (t < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentLength = targetLength;
        animFrame = null;
        if (onDone) onDone();
      }
    }

    animFrame = requestAnimationFrame(step);
  }

  // `position` is the current path position (0–7). Days completed = position.
  function updateCheckpoints(position) {
    // Each checkpoint dot is a day (1 = Mon … 7 = Sun). Mark it reached once
    // Lucy has actually landed on it.
    checkpointsGroup.querySelectorAll('.checkpoint').forEach((dot) => {
      const dayIndex = parseInt(dot.dataset.dayIndex, 10);
      dot.classList.toggle('reached', dayIndex + 1 <= position);
    });
  }

  function updateDayLabels(position) {
    // Highlight the most recently completed day; nothing highlighted at start.
    dayLabelsGroup.querySelectorAll('.day-label').forEach((label) => {
      const dayIndex = parseInt(label.dataset.dayIndex, 10);
      label.classList.toggle('today', dayIndex + 1 === position);
    });
  }

  function updateProgress(position) {
    progressLabel.textContent = `${position} / ${TOTAL_DAYS}`;
    progressFill.style.width = (position / TOTAL_DAYS) * 100 + '%';
  }

  function updateButtons(position) {
    const atEnd = position >= TOTAL_POSITIONS - 1;
    doneBtn.disabled = atEnd;
    const labelEl = doneBtn.querySelector('.btn-label');
    const iconEl = doneBtn.querySelector('.btn-icon');
    if (labelEl) labelEl.textContent = atEnd ? 'All done' : 'Chore done';
    if (iconEl)  iconEl.textContent  = atEnd ? '🎉' : '✨';
  }

  function celebratePot() {
    pot.classList.remove('celebrate');
    void pot.getBoundingClientRect();
    pot.classList.add('celebrate');
  }

  function launchConfetti() {
    const colours = [
      '#ff5b6e', '#ffa552', '#ffd86b',
      '#6ee7a8', '#5ab8ff', '#8a7dff', '#c77dff',
      '#ff5b9e', '#ffffff'
    ];
    const count = 70;
    confettiHost.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.color = colours[i % colours.length];
      piece.style.background = colours[i % colours.length];
      piece.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiHost.appendChild(piece);
    }
    setTimeout(() => { confettiHost.innerHTML = ''; }, 4000);
  }

  function playCheer() {
    try {
      const audio = new Audio('assets/cheer.mp3');
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch (_) {}
  }

  function celebrate() {
    celebratePot();
    launchConfetti();
    playCheer();
  }

  // === Initial render ===
  setAvatarAtLength(currentLength);
  updateCheckpoints(current);
  updateDayLabels(current);
  updateProgress(current);
  updateButtons(current);

  doneBtn.addEventListener('click', () => {
    if (current >= TOTAL_POSITIONS - 1) return;
    current += 1;
    saveCheckpoint(current);
    updateProgress(current);
    updateButtons(current);
    updateDayLabels(current);

    travelTo(positionLengths[current], () => {
      updateCheckpoints(current);
      if (current >= TOTAL_POSITIONS - 1) celebrate();
    });
  });

  resetBtn.addEventListener('click', () => {
    if (!window.confirm('Reset Lucy back to the start?')) return;
    current = 0;
    saveCheckpoint(current);
    updateProgress(current);
    updateButtons(current);
    updateDayLabels(current);
    travelTo(positionLengths[0], () => {
      updateCheckpoints(current);
    });
  });
})();
