import { CONFIG } from "./courseGen";

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

const pointInRect = (p, r) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

const lerp = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });

// start: {x, y} ball position. dir: 1 (right) or -1 (mirrored).
// stopDx: how far to travel from the ball, or null for "until something is hit".
export function traceShot(course, fn, start, dir, stopDx) {
  const { hole, walls } = course;
  const halfW = CONFIG.regionWidth / 2;
  const halfH = CONFIG.regionHeight / 2;
  const maxT = Number.isFinite(stopDx) && stopDx > 0 ? stopDx : Infinity;

  const f0 = fn(0);
  const points = [{ x: start.x, y: start.y }];
  if (!Number.isFinite(f0)) return { points, end: start, result: "invalid" };

  const DT = 0.5; // world units per step
  let prev = points[0];
  let t = 0;

  while (t < maxT) {
    t = Math.min(t + DT, maxT);
    const y = start.y + fn(t) - f0; // curve shifted to start at the ball
    if (!Number.isFinite(y)) return { points, end: prev, result: "invalid" };
    const cur = { x: start.x + dir * t, y };

    // a big vertical jump = discontinuity, so don't connect the two points
    const jump = Math.abs(cur.y - prev.y) > 50;

    // hole: exact distance from the hole's center to this little segment
    const dHole = jump
      ? Math.hypot(cur.x - hole.x, cur.y - hole.y)
      : distToSegment(hole, prev, cur);
    if (dHole <= hole.r) {
      points.push(cur);
      return { points, end: { x: hole.x, y: hole.y }, result: "hole" };
    }

    // walls: check points along the segment, at most 2 units apart
    const n = jump ? 1 : Math.max(1, Math.ceil(Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2));
    for (let i = 1; i <= n; i++) {
      if (walls.some((w) => pointInRect(lerp(prev, cur, i / n), w))) {
        const lastOutside = lerp(prev, cur, (i - 1) / n); // ball stops before the wall
        points.push(lastOutside);
        return { points, end: lastOutside, result: "wall" };
      }
    }

    points.push(cur);
    if (Math.abs(cur.x) > halfW || Math.abs(cur.y) > halfH) {
      return { points, end: prev, result: "edge" };
    }
    prev = cur;
  }
  return { points, end: prev, result: "stop" };
}