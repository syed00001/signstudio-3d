// Unified Sign Curriculum & Recognition Rules
export const dist = (a, b) =>
  Math.hypot(a.x - b.x, a.y - b.y, ((a.z || 0) - (b.z || 0)) * 0.5);

export const four = (f) => f.st[1] && f.st[2] && f.st[3] && f.st[4];
export const fist = (f) => !f.st[1] && !f.st[2] && !f.st[3] && !f.st[4];
export const curved = (f) => f.r.filter((x) => x > 1.25 && x < 1.85).length >= 3;

export const DEFAULT_SIGNS = [
  {
    id: 'sign-a',
    name: 'A',
    glyph: 'A',
    category: 'Alphabet',
    type: 'static',
    hands: 1,
    pose3D: 'A',
    video: 'videos/A.mp4',
    hint: 'Make a compact fist with the thumb resting upright against the side of your index finger.',
    test: (c) => fist(c.f) && c.f.r.every((x) => x < 1.3),
  },
  {
    id: 'sign-b',
    name: 'B',
    glyph: 'B',
    category: 'Alphabet',
    type: 'static',
    hands: 1,
    pose3D: 'B',
    video: 'videos/B.mp4',
    hint: 'Extend all four fingers straight up and together, with your thumb tucked across your palm.',
    test: (c) => four(c.f) && !c.f.st[0] && c.f.spread < 1.2,
  },
  {
    id: 'sign-c',
    name: 'C',
    glyph: 'C',
    category: 'Alphabet',
    type: 'static',
    hands: 1,
    pose3D: 'C',
    video: 'videos/C.mp4',
    hint: 'Curve all fingers and thumb into an open C shape, as if holding a cylinder.',
    test: (c) => curved(c.f) && c.f.ti > 0.35 && c.f.ti < 1.6,
  },
  {
    id: 'sign-d',
    name: 'D',
    glyph: 'D',
    category: 'Alphabet',
    type: 'static',
    hands: 1,
    pose3D: 'D',
    video: 'videos/D.mp4',
    hint: 'Point your index finger straight up while curling middle, ring, and pinky fingers to meet the thumb.',
    test: (c) =>
      c.f.st[1] && !c.f.st[2] && !c.f.st[3] && !c.f.st[4] && c.f.r[1] > 1.25 && c.f.tm < 0.7,
  },
  {
    id: 'sign-1',
    name: '1',
    glyph: '1',
    category: 'Numbers',
    type: 'static',
    hands: 1,
    pose3D: 'Num1',
    video: 'videos/1-5.mp4',
    start: 0,
    end: 4,
    hint: 'Extend only your index finger straight up; keep thumb and other fingers closed.',
    test: (c) =>
      c.f.st[1] && !c.f.st[2] && !c.f.st[3] && !c.f.st[4] && c.f.r[1] <= 1.25,
  },
  {
    id: 'sign-2',
    name: '2',
    glyph: '2',
    category: 'Numbers',
    type: 'static',
    hands: 1,
    pose3D: 'Num2',
    video: 'videos/1-5.mp4',
    start: 4,
    end: 8,
    hint: 'Raise your index and middle fingers in a V shape with your thumb tucked in.',
    test: (c) =>
      c.f.st[1] && c.f.st[2] && !c.f.st[3] && !c.f.st[4] && !c.f.st[0],
  },
  {
    id: 'sign-3',
    name: '3',
    glyph: '3',
    category: 'Numbers',
    type: 'static',
    hands: 1,
    pose3D: 'Num3',
    video: 'videos/1-5.mp4',
    start: 8,
    end: 12,
    hint: 'Extend your index, middle, and ring fingers upward while keeping pinky and thumb closed.',
    test: (c) =>
      !c.f.st[0] && c.f.st[1] && c.f.st[2] && c.f.st[3] && !c.f.st[4],
  },
  {
    id: 'sign-4',
    name: '4',
    glyph: '4',
    category: 'Numbers',
    type: 'static',
    hands: 1,
    pose3D: 'Num4',
    video: 'videos/1-5.mp4',
    start: 12,
    end: 16,
    hint: 'Spread all four fingers apart upright with your thumb folded across your palm.',
    test: (c) => four(c.f) && !c.f.st[0] && c.f.spread >= 1.2,
  },
  {
    id: 'sign-loveyou',
    name: 'Love You',
    glyph: '🤟',
    category: 'Phrases',
    type: 'static',
    hands: 1,
    pose3D: 'LoveYou',
    video: 'videos/LoveYou.mp4',
    hint: 'Extend your thumb, index finger, and pinky while keeping middle and ring fingers curled down.',
    test: (c) =>
      c.f.st[0] && c.f.st[1] && !c.f.st[2] && !c.f.st[3] && c.f.st[4],
  },
  {
    id: 'sign-hi',
    name: 'Hi',
    glyph: '👋',
    category: 'Phrases',
    type: 'move',
    hands: 1,
    pose3D: 'Hello',
    video: 'videos/Hi.mp4',
    hint: 'Hold an open flat hand near your forehead and sweep it outward sideways like a salute.',
    test: (c) =>
      c.n === 1 && four(c.f) && c.m.xr > 0.12 && Math.abs(c.m.dy) < 0.12,
  },
  {
    id: 'sign-thanks',
    name: 'Thanks',
    glyph: '🙏',
    category: 'Phrases',
    type: 'move',
    hands: 1,
    pose3D: 'Thanks',
    video: 'videos/Thanks.mp4',
    hint: 'Start with a flat hand touching near your chin, then move it forward and slightly downward.',
    test: (c) =>
      c.n === 1 &&
      four(c.f) &&
      c.m.xr < 0.14 &&
      (c.m.dy > 0.08 || c.m.grow > 1.2),
  },
  {
    id: 'sign-hungry',
    name: 'Hungry',
    glyph: '🍽️',
    category: 'Phrases',
    type: 'move',
    hands: 1,
    pose3D: 'Hungry',
    video: 'videos/Hungry.mp4',
    hint: 'Place a C-shaped hand at your upper chest and slide it straight downward.',
    test: (c) => c.n === 1 && curved(c.f) && c.m.dy > 0.08,
  },
  {
    id: 'sign-help',
    name: 'Help',
    glyph: '🤝',
    category: 'Phrases',
    type: 'move',
    hands: 2,
    pose3D: 'Help (2 Hands)',
    video: 'videos/Help.mp4',
    hint: 'Place a thumbs-up fist on top of your open flat palm and lift both hands upward together.',
    test: (c) =>
      c.n === 2 &&
      c.near &&
      ((fist(c.fs[0]) && four(c.fs[1])) || (fist(c.fs[1]) && four(c.fs[0]))) &&
      c.m.dy < -0.06,
  },
];