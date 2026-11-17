import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const PI = Math.PI;

/* ==========================================================================
   1. 3D HAND POSE DICTIONARY (ALL 13 CURRICULUM SIGNS + BONUS POSES)
   ========================================================================== */
function createHandPose(preset) {
  const def = { thumb: {}, index: {}, middle: {}, ring: {}, pinky: {} };
  const states = {
    straight: { mcp: 0, pip: 0, dip: 0 },
    fist: { mcp: PI / 3, pip: PI / 2, dip: PI / 5 },
    curve: { mcp: PI / 4, pip: PI / 4, dip: PI / 4 },
    tight: { mcp: PI / 1.5, pip: PI / 1.5, dip: PI / 1.5 },
  };

  Object.keys(def).forEach((f) => {
    if (preset[f]) {
      if (typeof preset[f] === 'string') Object.assign(def[f], states[preset[f]]);
      else Object.assign(def[f], preset[f]);
    } else if (preset.all) {
      if (typeof preset.all === 'string') Object.assign(def[f], states[preset.all]);
      else Object.assign(def[f], preset.all);
    } else {
      Object.assign(def[f], states.straight);
    }
  });

  if (preset.wrist) def.wrist = preset.wrist;
  if (preset.posOffset) def.posOffset = preset.posOffset;
  return def;
}

const PoseDictionary = {
  Neutral: { type: 'single', right: createHandPose({ all: 'straight' }) },
  A: {
    type: 'single',
    right: createHandPose({ all: 'fist', thumb: { mcp: PI / 5, pip: PI / 6, dip: 0, spreadZ: 0 } }),
  },
  B: {
    type: 'single',
    right: createHandPose({ all: 'straight', thumb: { mcp: PI / 2, pip: PI / 2, dip: 0, spreadZ: PI / 8 } }),
  },
  C: {
    type: 'single',
    right: createHandPose({ all: 'curve', thumb: { mcp: PI / 3, pip: PI / 3, dip: 0, spreadZ: -PI / 8 } }),
  },
  D: {
    type: 'single',
    right: createHandPose({
      all: 'fist',
      index: 'straight',
      thumb: { mcp: PI / 3, pip: PI / 3, dip: 0, spreadZ: PI / 8 },
    }),
  },
  E: {
    type: 'single',
    right: createHandPose({ all: 'tight', thumb: { mcp: PI / 2, pip: PI / 2, dip: 0, spreadZ: -PI / 8 } }),
  },
  F: {
    type: 'single',
    right: createHandPose({
      all: 'straight',
      index: { mcp: PI / 5, pip: PI / 2, dip: PI / 3 },
      thumb: { mcp: PI / 3, pip: PI / 3, dip: 0, spreadZ: PI / 8 },
    }),
  },
  Num1: {
    type: 'single',
    right: createHandPose({
      all: 'fist',
      index: 'straight',
      thumb: { mcp: PI / 2.3, pip: PI / 2.3, dip: 0, spreadZ: PI / 8 },
    }),
  },
  Num2: {
    type: 'single',
    right: createHandPose({
      all: 'fist',
      index: 'straight',
      middle: 'straight',
      thumb: { mcp: PI / 2.3, pip: PI / 2.3, dip: 0, spreadZ: PI / 8 },
    }),
  },
  Num3: {
    type: 'single',
    right: createHandPose({
      all: 'fist',
      index: 'straight',
      middle: 'straight',
      ring: 'straight',
      thumb: { mcp: PI / 2.2, pip: PI / 2.2, dip: 0, spreadZ: PI / 8 },
    }),
  },
  Num4: {
    type: 'single',
    right: createHandPose({
      all: 'straight',
      thumb: { mcp: PI / 2, pip: PI / 2, dip: 0, spreadZ: PI / 8 },
    }),
  },
  LoveYou: {
    type: 'single',
    right: createHandPose({
      all: 'fist',
      thumb: { mcp: 0, pip: 0, dip: 0, spreadZ: -PI / 5 },
      index: 'straight',
      pinky: 'straight',
    }),
  },
  Hello: {
    type: 'single',
    motion: 'wave',
    right: createHandPose({ all: 'straight', wrist: { z: -PI / 10 } }),
  },
  Thanks: {
    type: 'single',
    motion: 'thanks',
    right: createHandPose({
      all: 'straight',
      thumb: { mcp: PI / 4, pip: PI / 5, dip: 0, spreadZ: -PI / 10 },
      wrist: { x: -PI / 6 },
    }),
  },
  Hungry: {
    type: 'single',
    motion: 'hungry',
    right: createHandPose({
      all: 'curve',
      thumb: { mcp: PI / 3, pip: PI / 3, dip: 0, spreadZ: -PI / 8 },
      wrist: { x: -PI / 4 },
    }),
  },
  'Help (2 Hands)': {
    type: 'double',
    motion: 'help',
    right: createHandPose({
      all: 'fist',
      thumb: { mcp: PI / 5, pip: PI / 6, dip: 0, spreadZ: 0 },
      posOffset: { x: -3, y: 1.6, z: 0 },
    }),
    left: createHandPose({
      all: 'straight',
      wrist: { z: PI / 2 },
      posOffset: { x: 3, y: 1.4, z: 0 },
    }),
  },
};

/* ==========================================================================
   2. VIDEO LESSON STAGE (#view-learn)
   ========================================================================== */
function openLearnStage(sign) {
  const { STATE, navigate } = window.SignStudio;
  STATE.activeSign = sign;

  const currentIndex = STATE.signs.findIndex((s) => s.id === sign.id);
  const prevSign = currentIndex > 0 ? STATE.signs[currentIndex - 1] : null;
  const nextSign = currentIndex < STATE.signs.length - 1 ? STATE.signs[currentIndex + 1] : null;

  const learnEl = document.getElementById('view-learn');
  learnEl.innerHTML = `
    <div class="lesson-topbar">
      <button id="btn-back-lib" class="btn btn-ghost btn-sm">
        <i class="fa-solid fa-arrow-left"></i> Back to Library
      </button>
      <div class="lesson-step-indicator mono">
        STEP 1 OF 2 &bull; REFERENCE VIDEO (${currentIndex + 1}/${STATE.signs.length})
      </div>
      <div class="lesson-nav-arrows">
        <button id="btn-prev-lesson" class="btn btn-ghost btn-sm" ${prevSign ? '' : 'disabled'}>
          <i class="fa-solid fa-chevron-left"></i> Prev
        </button>
        <button id="btn-next-lesson" class="btn btn-ghost btn-sm" ${nextSign ? '' : 'disabled'}>
          Next <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <div class="lesson-grid">
      <!-- LEFT: VIDEO PLAYER -->
      <div class="stage-card">
        <div class="video-frame">
          <video id="lesson-video" loop muted playsinline></video>
          <div id="video-missing" class="video-fallback hidden">
            <i class="fa-solid fa-film" style="font-size: 2rem; color: var(--accent-cyan); margin-bottom: 0.75rem;"></i>
            <p style="font-weight: 700; margin-bottom: 0.35rem;">Reference video not found at <code class="mono">${sign.video}</code></p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 380px; margin-bottom: 1rem;">
              You can still inspect the exact 3D hand posture right now or jump straight into the camera test.
            </p>
            <button id="btn-fallback-3d" class="btn btn-cyan btn-sm">
              <i class="fa-solid fa-cube"></i> Open 3D Hand Model Instead
            </button>
          </div>
        </div>

        <div class="video-controls">
          <button id="btn-vid-replay" class="btn btn-ghost btn-sm">
            <i class="fa-solid fa-rotate-right"></i> Replay
          </button>
          <div class="speed-group">
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-right: 0.35rem;">Speed:</span>
            <button class="speed-btn" data-rate="0.5">0.5x</button>
            <button class="speed-btn" data-rate="0.75">0.75x</button>
            <button class="speed-btn active" data-rate="1">1.0x</button>
          </div>
        </div>
      </div>

      <!-- RIGHT: POSTURE GUIDE & DECISION GATE -->
      <div class="stage-card lesson-sidebar">
        <div>
          <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.75rem;">
            <span class="badge">${sign.category}</span>
            <span class="badge ${sign.type === 'move' ? 'move' : ''}">
              ${sign.type === 'move' ? 'Dynamic Motion' : 'Static Hold'}
            </span>
            <span class="badge">${sign.hands} Hand${sign.hands > 1 ? 's' : ''}</span>
          </div>

          <h2 class="lesson-sign-title">Sign: "${sign.name}"</h2>

          <div class="hint-callout">
            <div class="hint-label"><i class="fa-solid fa-hand-sparkles"></i> Hand &amp; Finger Posture</div>
            <p>${sign.hint}</p>
          </div>

          <ul class="checklist-tips">
            <li><i class="fa-solid fa-check"></i> Watch finger curl, thumb placement, and palm orientation.</li>
            <li><i class="fa-solid fa-cube"></i> Unsure about depth or finger overlap? Inspect the 3D hand rig from any angle.</li>
          </ul>
        </div>

        <div class="decision-box">
          <div class="decision-prompt">How confident do you feel with this sign?</div>
          <button id="btn-ready-test" class="btn btn-primary decision-btn">
            <i class="fa-solid fa-camera"></i> I'm Ready — Start Live Test
          </button>
          <button id="btn-not-ready-3d" class="btn btn-cyan decision-btn">
            <i class="fa-solid fa-cube"></i> Not Ready — Inspect in 3D Space
          </button>
        </div>
      </div>
    </div>
  `;

  navigate('learn');

  // Wire video playback & segment loop
  const videoEl = document.getElementById('lesson-video');
  const missingEl = document.getElementById('video-missing');

  videoEl.src = sign.video;
  videoEl.onloadedmetadata = () => {
    if (sign.start) videoEl.currentTime = sign.start;
    videoEl.play().catch(() => {});
  };
  videoEl.ontimeupdate = () => {
    if (sign.end && videoEl.currentTime >= sign.end) {
      videoEl.currentTime = sign.start || 0;
    }
  };
  videoEl.onerror = () => {
    videoEl.classList.add('hidden');
    missingEl.classList.remove('hidden');
  };

  document.getElementById('btn-vid-replay').addEventListener('click', () => {
    videoEl.currentTime = sign.start || 0;
    videoEl.play().catch(() => {});
  });

  learnEl.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      learnEl.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      videoEl.playbackRate = parseFloat(btn.dataset.rate);
    });
  });

  // Navigation & Decision Gate buttons
  document.getElementById('btn-back-lib').addEventListener('click', () => {
    videoEl.pause();
    navigate('library');
  });

  if (prevSign) {
    document.getElementById('btn-prev-lesson').addEventListener('click', () => openLearnStage(prevSign));
  }
  if (nextSign) {
    document.getElementById('btn-next-lesson').addEventListener('click', () => openLearnStage(nextSign));
  }

  const goTo3D = () => {
    videoEl.pause();
    open3DStage(sign);
  };

  const goToTest = () => {
    videoEl.pause();
    if (window.openTestStage) {
      window.openTestStage(sign);
    } else {
      const testEl = document.getElementById('view-test');
      testEl.innerHTML = `
        <div class="stage-card">
          <button class="btn btn-ghost btn-sm" id="btn-temp-back">
            <i class="fa-solid fa-arrow-left"></i> Back to Lesson
          </button>
          <h2 style="margin-top: 1rem;">Live Camera Arena: "${sign.name}"</h2>
          <p style="color: var(--text-secondary); margin: 0.5rem 0 1rem;">
            Part 2 flow verified! Ready to attach <strong>Part 3 (MediaPipe Live Webcam Test)</strong>.
          </p>
          <button class="btn btn-cyan btn-sm" id="btn-temp-3d">
            <i class="fa-solid fa-cube"></i> Inspect "${sign.name}" in 3D Space
          </button>
        </div>
      `;
      navigate('test');
      document.getElementById('btn-temp-back').onclick = () => openLearnStage(sign);
      document.getElementById('btn-temp-3d').onclick = () => open3DStage(sign);
    }
  };

  document.getElementById('btn-not-ready-3d').addEventListener('click', goTo3D);
  document.getElementById('btn-fallback-3d').addEventListener('click', goTo3D);
  document.getElementById('btn-ready-test').addEventListener('click', goToTest);
}

/* ==========================================================================
   3. THREE.JS 3D HAND INSPECTION STAGE (#view-3d)
   ========================================================================== */
let threeInitialized = false;
let scene, camera, renderer, controls, resizeObserver;
let rightHandRoot, leftHandRoot;
const poseBones = [];
let currentPoseName = 'Neutral';
let activeMotionName = null;
let motionPaused = false;
let modelLoaded = false;

const motionRightPos = new THREE.Vector3();
const motionLeftPos = new THREE.Vector3();
const motionAxis = new THREE.Vector3(0, 0, 1);
const motionTurn = new THREE.Quaternion();
const motionRightQuat = new THREE.Quaternion();
const motionLeftQuat = new THREE.Quaternion();

function open3DStage(sign) {
  const { STATE, navigate } = window.SignStudio;
  STATE.activeSign = sign;

  const view3d = document.getElementById('view-3d');
  if (!view3d.dataset.mounted) {
    view3d.innerHTML = `
      <div class="lesson-topbar">
        <button id="btn-3d-back-vid" class="btn btn-ghost btn-sm">
          <i class="fa-solid fa-video"></i> Back to Video
        </button>
        <div class="lesson-step-indicator mono">
          3D SPATIAL INSPECTOR &bull; DRAG TO ORBIT &bull; SCROLL TO ZOOM
        </div>
        <button id="btn-3d-to-test" class="btn btn-primary btn-sm">
          Got It — Start Live Test <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      <div class="viewer3d-shell">
        <div id="three-viewport" class="three-viewport">
          <div id="three-loader" class="three-status">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading 3D Hand Rig...
          </div>
        </div>

        <!-- TOP-LEFT SIGN INFO OVERLAY -->
        <div class="hud-top-left">
          <div class="badge" style="margin-bottom: 0.4rem;">3D Hand Rig</div>
          <h2 id="hud-sign-title" style="font-size: 1.4rem; font-weight: 800;">Sign</h2>
          <p id="hud-sign-hint" style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.35rem;"></p>
        </div>

        <!-- TOP-RIGHT CAMERA PRESETS & CONTROLS -->
        <div class="hud-top-right">
          <div class="hud-section-label">Camera Angle Presets</div>
          <div class="preset-grid">
            <button class="preset-btn active" data-cam="front">Front</button>
            <button class="preset-btn" data-cam="side">Side Profile</button>
            <button class="preset-btn" data-cam="top">Top-Down</button>
            <button class="preset-btn" data-cam="pov">Your POV</button>
          </div>

          <div class="hud-section-label" style="margin-top: 0.9rem;">Compare Pose</div>
          <select id="hud-pose-select" class="form-input" style="padding: 0.5rem 0.75rem; font-size: 0.82rem;"></select>

          <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
            <button id="btn-toggle-motion" class="btn btn-ghost btn-sm" style="flex: 1;">
              <i class="fa-solid fa-pause"></i> Pause Motion
            </button>
            <button id="btn-reset-cam" class="btn btn-ghost btn-sm" title="Reset Camera">
              <i class="fa-solid fa-crosshairs"></i>
            </button>
          </div>
        </div>

        <!-- BOTTOM ACTION BAR -->
        <div class="hud-bottom-bar">
          <span style="font-size: 0.82rem; color: var(--text-secondary);">
            <i class="fa-solid fa-hand-pointer" style="color: var(--accent-cyan);"></i>
            Rotate around the fingers to verify thumb &amp; knuckle angles before testing.
          </span>
          <button id="btn-3d-ready-bottom" class="btn btn-primary">
            <i class="fa-solid fa-camera"></i> Ready — Proceed to Camera Test
          </button>
        </div>
      </div>
    `;
    view3d.dataset.mounted = 'true';
    wire3DControls();
  }

  // Update HUD text for the active sign
  document.getElementById('hud-sign-title').textContent = `Sign: "${sign.name}"`;
  document.getElementById('hud-sign-hint').textContent = sign.hint;

  navigate('3d');

  // Initialize Three.js after #view-3d is visible so container dimensions are non-zero
  if (!threeInitialized) {
    initThreeEngine();
  }

  const poseKey = PoseDictionary[sign.pose3D] ? sign.pose3D : 'Neutral';
  document.getElementById('hud-pose-select').value = poseKey;
  setPose(poseKey);
  setCameraPreset('front');
}

function wire3DControls() {
  const select = document.getElementById('hud-pose-select');
  Object.keys(PoseDictionary).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  });

  select.addEventListener('change', (e) => setPose(e.target.value));

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setCameraPreset(btn.dataset.cam);
    });
  });

  document.getElementById('btn-reset-cam').addEventListener('click', () => setCameraPreset('front'));

  const motionBtn = document.getElementById('btn-toggle-motion');
  motionBtn.addEventListener('click', () => {
    motionPaused = !motionPaused;
    motionBtn.innerHTML = motionPaused
      ? '<i class="fa-solid fa-play"></i> Resume Motion'
      : '<i class="fa-solid fa-pause"></i> Pause Motion';
  });

  document.getElementById('btn-3d-back-vid').addEventListener('click', () => {
    openLearnStage(window.SignStudio.STATE.activeSign);
  });

  const proceedToTest = () => {
    const sign = window.SignStudio.STATE.activeSign;
    if (window.openTestStage) {
      window.openTestStage(sign);
    } else {
      document.getElementById('btn-ready-test')?.click() || openLearnStage(sign);
    }
  };

  document.getElementById('btn-3d-to-test').addEventListener('click', proceedToTest);
  document.getElementById('btn-3d-ready-bottom').addEventListener('click', proceedToTest);
}

function setCameraPreset(preset) {
  if (!camera || !controls) return;
  controls.target.set(0, 4.2, 0);
  if (preset === 'front') camera.position.set(0, 8, 28);
  else if (preset === 'side') camera.position.set(26, 6, 2);
  else if (preset === 'top') camera.position.set(0, 28, 6);
  else if (preset === 'pov') camera.position.set(0, 12, -24);
  controls.update();
}

function initThreeEngine() {
  const container = document.getElementById('three-viewport');
  const width = container.clientWidth || 900;
  const height = container.clientHeight || 560;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e17);

  camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 8, 28);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 4.2, 0);

  // Studio 3-point lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
  keyLight.position.set(10, 20, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.6);
  rimLight.position.set(-14, 8, -14);
  scene.add(rimLight);

  scene.add(new THREE.GridHelper(40, 40, 0x28324a, 0x161c2c));

  createHands();

  resizeObserver = new ResizeObserver(() => {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  resizeObserver.observe(container);

  threeInitialized = true;
  animateThree();
}

function createHands() {
  rightHandRoot = createHandRoot(false);
  leftHandRoot = createHandRoot(true);
  rightHandRoot.position.set(3, 2, 0);
  leftHandRoot.position.set(-3, 2, 0);
  rightHandRoot.userData.targetPos.copy(rightHandRoot.position);
  leftHandRoot.userData.targetPos.copy(leftHandRoot.position);
  leftHandRoot.visible = false;
  scene.add(rightHandRoot, leftHandRoot);

  const loader = new GLTFLoader();
  loader.load(
    './models/wooden_hand%20).glb',
    (gltf) => {
      installHandModel(rightHandRoot, gltf.scene, false);
      installHandModel(leftHandRoot, gltf.scene, true);
      modelLoaded = true;
      document.getElementById('three-loader')?.classList.add('hidden');
      setPose(currentPoseName);
    },
    undefined,
    (err) => {
      console.error('Could not load 3D hand model:', err);
      const loaderEl = document.getElementById('three-loader');
      if (loaderEl) {
        loaderEl.innerHTML =
          '<span style="color: var(--status-bad);">Missing <code>models/wooden_hand ).glb</code> — verify the file is inside your <code>models/</code> folder.</span>';
      }
    }
  );
}

function createHandRoot(isLeft) {
  const root = new THREE.Group();
  root.userData.targetQuat = new THREE.Quaternion();
  root.userData.targetPos = new THREE.Vector3();
  root.userData.fingers = {};
  if (isLeft) root.scale.x = -1;
  return root;
}

function installHandModel(handRoot, source, isLeft) {
  const model = cloneSkeleton(source);
  model.rotation.z = PI / 2;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 5 / size.y;
  const center = bounds.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(scale);
  model.position.x -= center.x * scale;
  model.position.y -= bounds.min.y * scale;
  model.position.z -= center.z * scale;
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  handRoot.add(model);

  const fingerNodes = {
    thumb: ['Thumb1_18', 'Thumb2_17'],
    index: ['Index1_16', 'Index2_15', 'Index3_14'],
    middle: ['Middle1_13', 'Middle2_12', 'Middle3_11'],
    ring: ['Ring1_10', 'Ring2_9', 'Ring3_8'],
    pinky: ['Pinky1_7', 'Pinky2_6', 'Pinky3_5'],
  };

  Object.entries(fingerNodes).forEach(([finger, names]) => {
    const bones = names.map((name) => model.getObjectByName(name));
    if (bones.some((b) => !b)) return;
    bones.forEach((bone) => {
      bone.userData.restQuaternion = bone.quaternion.clone();
      bone.userData.targetQuat = bone.quaternion.clone();
      poseBones.push(bone);
    });
    handRoot.userData.fingers[finger] = { mcp: bones[0], pip: bones[1], dip: bones[2] };
  });
}

function setBoneTarget(bone, flex, spread = 0) {
  if (!bone) return;
  const rel = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spread - flex);
  bone.userData.targetQuat.copy(bone.userData.restQuaternion).multiply(rel);
}

function applyAnatomicalPose(handRoot, poseDef, isLeft) {
  const fingers = handRoot.userData.fingers;
  Object.keys(fingers).forEach((fName) => {
    const fData = fingers[fName];
    const pData = poseDef[fName];
    if (!pData) return;

    if (fName === 'thumb') {
      setBoneTarget(
        fData.mcp,
        THREE.MathUtils.clamp(pData.mcp || 0, -0.1, PI / 2),
        THREE.MathUtils.clamp(pData.spreadZ || 0, -PI / 4, PI / 3)
      );
      setBoneTarget(fData.pip, THREE.MathUtils.clamp(pData.pip || 0, 0, PI / 2));
      setBoneTarget(fData.dip, THREE.MathUtils.clamp(pData.dip || 0, 0, PI / 2));
    } else {
      const spreadZ = pData.spreadZ !== undefined ? pData.spreadZ : 0;
      setBoneTarget(
        fData.mcp,
        THREE.MathUtils.clamp(pData.mcp || 0, -0.1, PI / 1.5),
        isLeft ? -spreadZ : spreadZ
      );
      setBoneTarget(fData.pip, THREE.MathUtils.clamp(pData.pip || 0, 0, PI / 1.2));
      setBoneTarget(fData.dip, THREE.MathUtils.clamp(pData.dip || 0, 0, PI / 1.2));
    }
  });

  handRoot.userData.targetQuat.setFromEuler(
    new THREE.Euler(poseDef.wrist?.x || 0, poseDef.wrist?.y || 0, poseDef.wrist?.z || 0)
  );

  const baseX = isLeft ? -3 : 3;
  handRoot.userData.targetPos.set(
    baseX + (poseDef.posOffset?.x || 0),
    2 + (poseDef.posOffset?.y || 0),
    poseDef.posOffset?.z || 0
  );
}

function setPose(poseName) {
  const pose = PoseDictionary[poseName];
  if (!pose || !rightHandRoot) return;
  currentPoseName = poseName;
  activeMotionName = pose.motion || null;

  if (pose.type === 'single') {
    leftHandRoot.visible = false;
    applyAnatomicalPose(rightHandRoot, pose.right, false);
    rightHandRoot.userData.targetPos.set(0, 2, 0);
  } else {
    leftHandRoot.visible = true;
    applyAnatomicalPose(rightHandRoot, pose.right, false);
    applyAnatomicalPose(leftHandRoot, pose.left, true);
  }
}

function animateThree() {
  requestAnimationFrame(animateThree);
  if (!threeInitialized || !modelLoaded) return;

  const speed = 0.14;
  const time = motionPaused ? 0 : performance.now() / 1000;

  motionRightPos.copy(rightHandRoot.userData.targetPos);
  motionLeftPos.copy(leftHandRoot.userData.targetPos);
  motionRightQuat.copy(rightHandRoot.userData.targetQuat);
  motionLeftQuat.copy(leftHandRoot.userData.targetQuat);

  if (!motionPaused) {
    if (activeMotionName === 'help') {
      const lift = (0.45 * (1 - Math.cos(time * 2.4))) / 2;
      motionRightPos.y += lift;
      motionLeftPos.y += lift;
    } else if (activeMotionName === 'wave') {
      const sway = Math.sin(time * 3) * 0.22;
      motionTurn.setFromAxisAngle(motionAxis, sway);
      motionRightQuat.multiply(motionTurn);
      motionRightPos.x += Math.sin(time * 3) * 0.4;
    } else if (activeMotionName === 'thanks') {
      const phase = (1 - Math.cos(time * 2.2)) / 2;
      motionRightPos.z += phase * 0.9;
      motionRightPos.y -= phase * 0.45;
    } else if (activeMotionName === 'hungry') {
      const slide = (1 - Math.cos(time * 2.2)) / 2;
      motionRightPos.y -= slide * 0.9;
    }
  }

  poseBones.forEach((bone) => bone.quaternion.slerp(bone.userData.targetQuat, speed));
  rightHandRoot.quaternion.slerp(motionRightQuat, speed);
  leftHandRoot.quaternion.slerp(motionLeftQuat, speed);
  rightHandRoot.position.lerp(motionRightPos, speed);
  leftHandRoot.position.lerp(motionLeftPos, speed);

  controls.update();
  renderer.render(scene, camera);
}

window.openLearnStage = openLearnStage;
window.open3DStage = open3DStage;