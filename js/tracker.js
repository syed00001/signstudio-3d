import {
  HandLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
import { dist } from './signs-data.js';

const HOLD_STATIC = 15;
const HOLD_MOVE = 3;
const TEMPLATE_THRESHOLD = 0.45;

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

let landmarker = null;
let landmarkerLoading = false;
let camStream = null;
let animFrameId = null;
let activeSign = null;

let holdCount = 0;
let passed = false;
let lastLm = null;
let history = [];
let lastTs = -1;

/* ==========================================================================
   1. MEDIAPIPE MODEL INITIALIZER (LAZY-LOADED ON FIRST TEST)
   ========================================================================== */
async function ensureLandmarker() {
  if (landmarker) return landmarker;
  if (landmarkerLoading) return null;

  landmarkerLoading = true;
  setFeedback('Loading MediaPipe AI hand model...', 'neutral');

  try {
    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    updateCamBadge('AI Vision Ready', 'ok');
    setFeedback('Show your hand clearly to the camera', 'neutral');
    return landmarker;
  } catch (err) {
    console.error('MediaPipe load error:', err);
    updateCamBadge('Model Load Failed', 'bad');
    setFeedback('Could not load the AI hand model. Check your internet connection.', 'bad');
    return null;
  } finally {
    landmarkerLoading = false;
  }
}

/* ==========================================================================
   2. LANDMARK FEATURE EXTRACTION & RECOGNITION MATH
   ========================================================================== */
function features(lm) {
  const palm = dist(lm[0], lm[9]) || 1;
  const n = (a, b) => dist(lm[a], lm[b]) / palm;
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const mcps = [5, 9, 13, 17];

  const st = [n(4, 5) > 0.55 ? 1 : 0];
  const r = [];

  tips.forEach((t, i) => {
    st.push(dist(lm[t], lm[0]) > dist(lm[pips[i]], lm[0]) * 1.08 ? 1 : 0);
    r.push(dist(lm[t], lm[0]) / dist(lm[mcps[i]], lm[0]));
  });

  return {
    st,
    r,
    palm,
    spread: dist(lm[8], lm[20]) / (dist(lm[5], lm[17]) || 1),
    tm: n(4, 12),
    ti: n(4, 8),
  };
}

function motion() {
  const now = performance.now();
  history = history.filter((s) => now - s.t < 1000);
  if (history.length < 6 || history[history.length - 1].t - history[0].t < 300) {
    return { xr: 0, dy: 0, grow: 1 };
  }
  const xs = history.map((s) => s.x);
  const a = history[0];
  const b = history[history.length - 1];
  return {
    xr: Math.max(...xs) - Math.min(...xs),
    dy: b.y - a.y,
    grow: b.palm / a.palm,
  };
}

function normalise(lm) {
  const s = dist(lm[0], lm[9]) || 1;
  return lm.flatMap((p) => [(p.x - lm[0].x) / s, (p.y - lm[0].y) / s, (p.z - lm[0].z) / s]);
}

function templateDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 3) {
    sum += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
  }
  return sum / (a.length / 3);
}

function getTemplate(name) {
  try {
    return JSON.parse(localStorage.getItem('tpl_' + name));
  } catch {
    return null;
  }
}

function checkSign(hands, sign) {
  const fs = hands.map(features);
  const near = hands.length === 2 && dist(hands[0][9], hands[1][9]) < 2.5 * fs[0].palm;
  const ctxObj = { f: fs[0], fs, n: hands.length, near, m: motion() };

  if (sign.type === 'static') {
    const tpl = getTemplate(sign.name);
    if (tpl) {
      return templateDistance(normalise(hands[0]), tpl) < TEMPLATE_THRESHOLD;
    }
  }

  if (typeof sign.test === 'function') {
    return !!sign.test(ctxObj);
  }

  // Fallback for admin-added custom signs before calibration
  return hands.length >= (sign.hands || 1);
}

/* ==========================================================================
   3. TEST ARENA UI & CAMERA LIFECYCLE (#view-test)
   ========================================================================== */
function openTestStage(sign) {
  const { STATE, navigate } = window.SignStudio;
  STATE.activeSign = sign;
  activeSign = sign;

  const currentIndex = STATE.signs.findIndex((s) => s.id === sign.id);
  const nextSign = currentIndex < STATE.signs.length - 1 ? STATE.signs[currentIndex + 1] : null;
  const isAlreadyMastered = STATE.mastered.includes(sign.id);
  const hasCustomTpl = !!getTemplate(sign.name);

  const testEl = document.getElementById('view-test');
  testEl.innerHTML = `
    <div class="lesson-topbar">
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button id="btn-test-back-vid" class="btn btn-ghost btn-sm">
          <i class="fa-solid fa-video"></i> Watch Video Again
        </button>
        <button id="btn-test-to-3d" class="btn btn-cyan btn-sm">
          <i class="fa-solid fa-cube"></i> Inspect in 3D
        </button>
      </div>

      <div class="lesson-step-indicator mono">
        LIVE VISION TEST &bull; SIGN ${currentIndex + 1} OF ${STATE.signs.length}
      </div>

      <button id="btn-test-lib" class="btn btn-ghost btn-sm">
        <i class="fa-solid fa-grid-2"></i> Library
      </button>
    </div>

    <div class="test-grid">
      <!-- LEFT: MIRRORED WEBCAM & SKELETON OVERLAY -->
      <div class="stage-card">
        <div class="cam-frame">
          <video id="test-cam" class="mirror" autoplay muted playsinline></video>
          <canvas id="test-overlay" class="mirror"></canvas>

          <div id="cam-status-badge" class="cam-hud-badge">
            <span class="pulse-dot"></span>
            <span id="cam-status-text">Initializing Camera...</span>
          </div>

          <div class="cam-bottom-hud">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.35rem;">
              <span>Sign Match Stability</span>
              <span id="hold-pct" class="mono">0%</span>
            </div>
            <div class="progress-track" style="height: 8px; background: rgba(255,255,255,0.12);">
              <div id="hold-bar" class="progress-fill"></div>
            </div>
          </div>
        </div>

        <!-- LIVE FINGER TELEMETRY PILLS -->
        <div class="telemetry-bar">
          <div class="telemetry-label mono">LIVE FINGER STATE</div>
          <div id="finger-pills" class="finger-pills">
            ${FINGER_NAMES.map(
              (name) => `<span class="finger-chip" data-finger="${name}">${name}: —</span>`
            ).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: TARGET SIGN HUD, FEEDBACK & CALIBRATION -->
      <div class="stage-card lesson-sidebar">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
            <span class="badge">${sign.category}</span>
            <span class="badge ${sign.type === 'move' ? 'move' : ''}">
              ${sign.type === 'move' ? 'Dynamic Motion' : 'Static Hold'}
            </span>
            <span id="mastered-pill" class="badge done ${isAlreadyMastered ? '' : 'hidden'}">
              <i class="fa-solid fa-check"></i> Mastered
            </span>
          </div>

          <h2 class="lesson-sign-title">
            ${sign.type === 'move' ? 'Perform Sign:' : 'Show Sign:'} "${sign.name}"
          </h2>

          <div class="hint-callout">
            <div class="hint-label"><i class="fa-solid fa-bullseye"></i> Target Posture</div>
            <p>${sign.hint}</p>
          </div>

          <!-- LIVE FEEDBACK BANNER -->
          <div id="test-feedback" class="feedback-banner neutral">
            <i class="fa-solid fa-hand"></i>
            <span id="test-feedback-text">Starting camera...</span>
          </div>

          <!-- CUSTOM CALIBRATION BOX (STATIC SIGNS) -->
          <div id="calibration-box" class="calibration-box ${sign.type === 'move' ? 'hidden' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">
                <i class="fa-solid fa-sliders" style="color: var(--accent-cyan);"></i> Personal Hand Calibration
              </span>
              <span id="tpl-badge" class="badge ${hasCustomTpl ? 'done' : ''}">
                ${hasCustomTpl ? 'Custom Saved' : 'Default Rules'}
              </span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
              Want the AI to match your exact hand proportions? Hold the sign cleanly and save it as your reference.
            </p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button id="btn-save-tpl" class="btn btn-ghost btn-sm" style="flex: 1;">
                <i class="fa-solid fa-bookmark"></i> Save My Hand Pose
              </button>
              <button id="btn-clear-tpl" class="btn btn-ghost btn-sm ${hasCustomTpl ? '' : 'hidden'}" title="Reset to default AI rules">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="decision-box">
          <button id="btn-retry-test" class="btn btn-ghost decision-btn">
            <i class="fa-solid fa-rotate-right"></i> Reset Attempt
          </button>
          <button id="btn-next-sign" class="btn btn-primary decision-btn" ${isAlreadyMastered ? '' : 'disabled'}>
            ${nextSign ? `Next Sign: "${nextSign.name}" <i class="fa-solid fa-arrow-right"></i>` : 'Complete Course & Return to Library <i class="fa-solid fa-trophy"></i>'}
          </button>
        </div>
      </div>
    </div>
  `;

  navigate('test');
  resetAttemptState();
  wireTestButtons(sign, nextSign);
  startCameraAndDetection();
}

function wireTestButtons(sign, nextSign) {
  const { navigate } = window.SignStudio;

  document.getElementById('btn-test-back-vid').addEventListener('click', () => {
    stopCamera();
    window.openLearnStage(sign);
  });

  document.getElementById('btn-test-to-3d').addEventListener('click', () => {
    stopCamera();
    window.open3DStage(sign);
  });

  document.getElementById('btn-test-lib').addEventListener('click', () => {
    stopCamera();
    navigate('library');
  });

  document.getElementById('btn-retry-test').addEventListener('click', () => {
    resetAttemptState();
    setFeedback('Show your hand to try again', 'neutral');
  });

  document.getElementById('btn-save-tpl').addEventListener('click', () => {
    if (!lastLm) {
      setFeedback('Hold your hand in front of the camera first, then click Save.', 'bad');
      return;
    }
    localStorage.setItem('tpl_' + sign.name, JSON.stringify(normalise(lastLm)));
    resetAttemptState();
    const tplBadge = document.getElementById('tpl-badge');
    tplBadge.textContent = 'Custom Saved';
    tplBadge.classList.add('done');
    document.getElementById('btn-clear-tpl').classList.remove('hidden');
    setFeedback('Custom hand posture saved! Test it now.', 'ok');
  });

  document.getElementById('btn-clear-tpl').addEventListener('click', () => {
    localStorage.removeItem('tpl_' + sign.name);
    resetAttemptState();
    const tplBadge = document.getElementById('tpl-badge');
    tplBadge.textContent = 'Default Rules';
    tplBadge.classList.remove('done');
    document.getElementById('btn-clear-tpl').classList.add('hidden');
    setFeedback('Reverted to default AI recognition rules.', 'neutral');
  });

  document.getElementById('btn-next-sign').addEventListener('click', () => {
    stopCamera();
    if (nextSign) {
      window.openLearnStage(nextSign);
    } else {
      navigate('library');
    }
  });
}

function resetAttemptState() {
  holdCount = 0;
  passed = false;
  history = [];
  updateHoldMeter(0);
}

async function startCameraAndDetection() {
  const videoEl = document.getElementById('test-cam');
  const overlayEl = document.getElementById('test-overlay');
  if (!videoEl || !overlayEl) return;

  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    videoEl.srcObject = camStream;
    await videoEl.play();

    overlayEl.width = videoEl.videoWidth || 640;
    overlayEl.height = videoEl.videoHeight || 480;

    updateCamBadge('Camera Active', 'ok');
    await ensureLandmarker();

    lastTs = -1;
    animFrameId = requestAnimationFrame(detectionLoop);
  } catch (err) {
    console.error('Camera access error:', err);
    updateCamBadge('Camera Blocked', 'bad');
    setFeedback('Camera permission denied. Allow camera access in your browser and reload.', 'bad');
  }
}

function stopCamera() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (camStream) {
    camStream.getTracks().forEach((track) => track.stop());
    camStream = null;
  }
}

/* ==========================================================================
   4. REAL-TIME DETECTION & HUD RENDER LOOP
   ========================================================================== */
function detectionLoop() {
  const testView = document.getElementById('view-test');
  if (!testView || testView.classList.contains('hidden')) {
    stopCamera();
    return;
  }

  animFrameId = requestAnimationFrame(detectionLoop);

  const videoEl = document.getElementById('test-cam');
  const overlayEl = document.getElementById('test-overlay');
  if (!landmarker || !videoEl || videoEl.readyState < 2) return;

  const now = performance.now();
  if (now === lastTs) return;
  lastTs = now;

  const ctx = overlayEl.getContext('2d');
  const res = landmarker.detectForVideo(videoEl, now);
  ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);

  const hands = res.landmarks || [];
  lastLm = hands[0] || null;

  if (!hands.length) {
    holdCount = 0;
    history = [];
    lastLm = null;
    updateFingerPills(null);
    if (!passed) {
      updateHoldMeter(0);
      setFeedback('No hand detected — raise your hand into frame.', 'neutral');
    }
    return;
  }

  // Record palm trajectory for dynamic movement signs
  history.push({
    t: now,
    x: hands.reduce((sum, h) => sum + h[9].x, 0) / hands.length,
    y: hands.reduce((sum, h) => sum + h[9].y, 0) / hands.length,
    palm: dist(hands[0][0], hands[0][9]),
  });

  const f = features(hands[0]);
  updateFingerPills(f);

  const isMatch = checkSign(hands, activeSign);
  hands.forEach((h) => drawSkeleton(ctx, overlayEl.width, overlayEl.height, h, isMatch || passed));

  if (passed) return;

  const neededFrames = activeSign.type === 'move' ? HOLD_MOVE : HOLD_STATIC;

  if (isMatch) {
    holdCount++;
    const pct = Math.min(Math.round((holdCount / neededFrames) * 100), 100);
    updateHoldMeter(pct);

    if (activeSign.type === 'move') {
      setFeedback(`Tracking movement... ${pct}%`, 'ok');
    } else {
      setFeedback(`Great form! Hold steady... ${pct}%`, 'ok');
    }

    if (holdCount >= neededFrames) {
      markSignPassed();
    }
  } else {
    holdCount = Math.max(0, holdCount - 1);
    const pct = Math.min(Math.round((holdCount / neededFrames) * 100), 100);
    updateHoldMeter(pct);
    setFeedback(
      activeSign.type === 'move'
        ? 'Perform the full sign motion clearly.'
        : 'Adjust finger positions to match the target posture.',
      'warn'
    );
  }
}

function markSignPassed() {
  passed = true;
  updateHoldMeter(100);
  setFeedback(`Verified! You mastered "${activeSign.name}".`, 'ok');

  const { STATE } = window.SignStudio;
  if (!STATE.mastered.includes(activeSign.id)) {
    STATE.mastered.push(activeSign.id);
    localStorage.setItem('ss_mastered', JSON.stringify(STATE.mastered));
  }

  document.getElementById('mastered-pill')?.classList.remove('hidden');
  const nextBtn = document.getElementById('btn-next-sign');
  if (nextBtn) nextBtn.disabled = false;
}

function drawSkeleton(ctx, w, h, lm, ok) {
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = ok ? '#10b981' : '#818cf8';
  ctx.fillStyle = ok ? '#a7f3d0' : '#ffffff';

  CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  });

  lm.forEach((p, idx) => {
    const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, isTip ? 5 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ==========================================================================
   5. HUD HELPER UPDATERS
   ========================================================================== */
function setFeedback(text, state) {
  const banner = document.getElementById('test-feedback');
  const textEl = document.getElementById('test-feedback-text');
  if (!banner || !textEl) return;

  banner.className = `feedback-banner ${state}`;
  textEl.textContent = text;
}

function updateHoldMeter(pct) {
  const bar = document.getElementById('hold-bar');
  const label = document.getElementById('hold-pct');
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
}

function updateCamBadge(text, state) {
  const badge = document.getElementById('cam-status-badge');
  const label = document.getElementById('cam-status-text');
  if (!badge || !label) return;
  badge.className = `cam-hud-badge ${state}`;
  label.textContent = text;
}

function updateFingerPills(f) {
  const container = document.getElementById('finger-pills');
  if (!container) return;

  if (!f) {
    container.innerHTML = FINGER_NAMES.map(
      (name) => `<span class="finger-chip">${name}: —</span>`
    ).join('');
    return;
  }

  container.innerHTML = FINGER_NAMES.map((name, i) => {
    const open = f.st[i] === 1;
    return `<span class="finger-chip ${open ? 'open' : ''}">${name}: ${open ? 'Open' : 'Curled'}</span>`;
  }).join('');
}

window.openTestStage = openTestStage;