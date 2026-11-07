export const CONFIG = {
  regionWidth: 1000,
  regionHeight: 500,
  holeRadius: 10,
  minTeeHoleDist: 200,
  maxTeeHoleDist: 400,
  wallCount: 3,
  blockerMinT: 0.35, // how far along tee -> hole the blocker can sit
  blockerMaxT: 0.8,
  blockerMin: 50,    // min blocker width and height,
  wallMin: 20,
  wallMax: 100,
  gap: 20, // min clearance around walls, tee, and hole
};

// Seeded RNG (mulberry32): same seed -> same sequence
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng, min, max) => min + rng() * (max - min);

export function rectsOverlap(a, b, gap = 0) {
  return (
    a.x < b.x + b.w + gap &&
    b.x < a.x + a.w + gap &&
    a.y < b.y + b.h + gap &&
    b.y < a.y + a.h + gap
  );
}

// Works for a point too: pass r = 0
export function circleHitsRect(cx, cy, r, rect, gap = 0) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= (r + gap) * (r + gap);
}

export function generateCourse(seed) {
  const rng = makeRng(seed);
  const halfW = CONFIG.regionWidth / 2;
  const halfH = CONFIG.regionHeight / 2;
  const margin = 40;

  // Tee: anywhere in the region, away from the edges
  const tee = {
    x: randRange(rng, -halfW + margin, halfW - margin),
    y: randRange(rng, -halfH + margin, halfH - margin),
  };

  // Hole: random distance, random angle within 45 degrees of
  // straight left or right. Retry until it lands inside the region.
  let hole = null;
  for (let tries = 0; tries < 100 && !hole; tries++) {
    const dist = randRange(rng, CONFIG.minTeeHoleDist, CONFIG.maxTeeHoleDist);
    const angle = randRange(rng, -Math.PI / 4, Math.PI / 4);
    const side = rng() < 0.5 ? 1 : -1;
    const x = tee.x + side * dist * Math.cos(angle);
    const y = tee.y + dist * Math.sin(angle);
    if (Math.abs(x) <= halfW - margin && Math.abs(y) <= halfH - margin) {
      hole = { x, y, r: CONFIG.holeRadius };
    }
  }
  if (!hole) {
    hole = { x: tee.x + CONFIG.minTeeHoleDist, y: tee.y, r: CONFIG.holeRadius };
  }

  const walls = [];

  // Blocker: a wall centered on the straight line from tee to hole,
  // so the straight-line shot always hits it
  for (let tries = 0; tries < 30; tries++) {
    const t = randRange(rng, CONFIG.blockerMinT, CONFIG.blockerMaxT);
    const w = randRange(rng, CONFIG.blockerMin, CONFIG.wallMax);
    const h = randRange(rng, CONFIG.blockerMin, CONFIG.wallMax);
    const cx = tee.x + t * (hole.x - tee.x);
    const cy = tee.y + t * (hole.y - tee.y);
    const wall = { x: cx - w / 2, y: cy - h / 2, w, h };

    const inRegion =
      wall.x >= -halfW && wall.x + w <= halfW &&
      wall.y >= -halfH && wall.y + h <= halfH;
    const ok =
      inRegion &&
      !circleHitsRect(tee.x, tee.y, 0, wall, CONFIG.gap) &&
      !circleHitsRect(hole.x, hole.y, hole.r, wall, CONFIG.gap);
    if (ok) {
      walls.push(wall);
      break;
    }
  }

  // Extra clutter walls: random, skipped if they touch the tee, hole, or other walls
  for (let i = 0; i < CONFIG.wallCount; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const w = randRange(rng, CONFIG.wallMin, CONFIG.wallMax);
      const h = randRange(rng, CONFIG.wallMin, CONFIG.wallMax);
      const wall = {
        x: randRange(rng, -halfW, halfW - w),
        y: randRange(rng, -halfH, halfH - h),
        w,
        h,
      };
      const ok =
        !circleHitsRect(tee.x, tee.y, 0, wall, CONFIG.gap) &&
        !circleHitsRect(hole.x, hole.y, hole.r, wall, CONFIG.gap) &&
        !walls.some((other) => rectsOverlap(wall, other, CONFIG.gap));
      if (ok) {
        walls.push(wall);
        break;
      }
    }
  }

  return { tee, hole, walls };
}