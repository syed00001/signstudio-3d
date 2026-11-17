import { DEFAULT_SIGNS } from './signs-data.js';

const STORAGE_CUSTOM_KEY = 'ss_custom_signs';
const STORAGE_EDITS_KEY = 'ss_sign_edits';
const STORAGE_DELETED_KEY = 'ss_deleted_signs';

const AVAILABLE_3D_POSES = [
  'Neutral',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'Num1',
  'Num2',
  'Num3',
  'Num4',
  'LoveYou',
  'Hello',
  'Thanks',
  'Hungry',
  'Help (2 Hands)',
];

const FINGER_LABELS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

let editingSignId = null;
let uploadedPreviewUrl = null;
let adminSearchQuery = '';
let draftFingerRules = ['any', 'any', 'any', 'any', 'any'];

/* ==========================================================================
   1. CURRICULUM PERSISTENCE (MERGES DEFAULT SIGNS + ADMIN CUSTOMIZATIONS)
   ========================================================================== */
function buildCustomTestFn(sign) {
  if (!Array.isArray(sign.fingerRules) || sign.fingerRules.length !== 5) {
    return (c) => c.n >= (sign.hands || 1);
  }
  return (c) => {
    if (c.n < (sign.hands || 1)) return false;
    return sign.fingerRules.every((rule, idx) => {
      if (rule === 'any') return true;
      if (rule === 'open') return c.f.st[idx] === 1;
      if (rule === 'curled') return c.f.st[idx] === 0;
      return true;
    });
  };
}

function hydrateCurriculum() {
  const { STATE } = window.SignStudio