(function () {
  'use strict';

  const STORAGE_KEY = 'lucy-rainbow-checkpoint';
  const TOTAL_CHECKPOINTS = 7;
  const TRAVEL_MS = 800;
  const POPUP_MS = 2800;

  const centerPath = document.getElementById('center-path');
  const checkpointsGroup = document.getElementById('checkpoints');
  const avatar = document.getElementById('avatar');
  const avatarImage = document.getElementById('avatar-image');
  const avatarFallback = document.getElementById('avatar-fallback');
  const progressLabel = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const doneBtn = document.getElementById('done-btn');
  const resetBtn = document.getElementById('reset-btn');
  const confettiHost = document.getElementById('confetti');
  const rewardPopup = document.getElementById('reward-popup');

  // === Path / checkpoint geometry ===
  const pathLength = centerPath.getTotalLength();
  const checkpointLengths = [];
  const checkpointPositions = [];
  for (let i = 0; i < TOTAL_CHECKPOINTS; i++) {
    const t = i / (TOTAL_CHECKPOINTS - 1);
    const len = t * pathLength;
    const pt = centerPath.getPointAtLength(len);
    checkpointLengths.push(len);
    checkpointPositions.push({ x: pt.x, y: pt.y });
  }

  // Draw checkpoint circles
  checkpointPositions.forEach((p, i) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', 9);
    c.classList.add('checkpoint');
    c.dataset.index = String(i);
    checkpointsGroup.appendChild(c);
  });

  // Avatar fallback only on real load failure
  avatarImage.addEventListener('error', () => {
    avatarImage.style.display = 'none';
    avatarFallback.style.display = '';
  });

  // === State ===
  let current = loadCheckpoint();
  let currentLength = checkpointLengths[current];
  let animFrame = null;

  function loadCheckpoint() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(TOTAL_CHECKPOINTS - 1, n));
  }

  function saveCheckpoint(n) {
    localStorage.setItem(STORAGE_KEY, String(n));
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function setAvatarAtLength(len) {
    const pt = centerPath.getPointAtLength(len);
    avatar.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
  }

  // Animate Lucy along the arc from her current length to target
  function travelTo(targetLength, onDone) {
    if (animFrame) cancelAnimationFrame(animFrame);

    const start = performance.now();
    const from = currentLength;
    const to = targetLength;
    const distance = to - from;

    function step(now) {
      const t = Math.min(1, (now - start) / TRAVEL_MS);
      const eased = easeOutBack(t);
      const len = from + distance * eased;
      setAvatarAtLength(len);

      if (t < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentLength = to;
        animFrame = null;
        if (onDone) onDone();
      }
    }

    animFrame = requestAnimationFrame(step);
  }

  function updateCheckpoints(index) {
    const dots = checkpointsGroup.querySelectorAll('.checkpoint');
    dots.forEach((dot, i) => {
      dot.classList.toggle('reached', i <= index);
    });
  }

  function updateProgress(index, animated) {
    const total = TOTAL_CHECKPOINTS - 1;
    progressLabel.textContent = `${index} / ${total}`;
    progressFill.style.width = (index / total) * 100 + '%';
  }

  function updateButtons(index) {
    const atEnd = index >= TOTAL_CHECKPOINTS - 1;
    doneBtn.disabled = atEnd;
    const labelEl = doneBtn.querySelector('.btn-label');
    const iconEl = doneBtn.querySelector('.btn-icon');
    if (labelEl) labelEl.textContent = atEnd ? 'All done' : 'Chore done';
    if (iconEl)  iconEl.textContent  = atEnd ? '🎉' : '✨';
  }

  let popupTimer = null;
  function showRewardPopup() {
    rewardPopup.classList.remove('show');
    void rewardPopup.getBoundingClientRect();
    rewardPopup.classList.add('show');
    rewardPopup.setAttribute('aria-hidden', 'false');

    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(() => {
      rewardPopup.classList.remove('show');
      rewardPopup.setAttribute('aria-hidden', 'true');
    }, POPUP_MS);
  }

  function hideRewardPopup() {
    if (popupTimer) clearTimeout(popupTimer);
    rewardPopup.classList.remove('show');
    rewardPopup.setAttribute('aria-hidden', 'true');
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
    showRewardPopup();
    launchConfetti();
    playCheer();
  }

  // Initial paint (no animation)
  setAvatarAtLength(currentLength);
  updateCheckpoints(current);
  updateProgress(current);
  updateButtons(current);

  doneBtn.addEventListener('click', () => {
    if (current >= TOTAL_CHECKPOINTS - 1) return;
    current += 1;
    saveCheckpoint(current);
    updateProgress(current);
    updateButtons(current);

    travelTo(checkpointLengths[current], () => {
      updateCheckpoints(current);
      if (current >= TOTAL_CHECKPOINTS - 1) celebrate();
    });
  });

  resetBtn.addEventListener('click', () => {
    const ok = window.confirm('Reset Lucy back to the start?');
    if (!ok) return;
    current = 0;
    saveCheckpoint(current);
    hideRewardPopup();
    updateProgress(current);
    updateButtons(current);
    travelTo(checkpointLengths[0], () => {
      updateCheckpoints(current);
    });
  });
})();
