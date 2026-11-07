import React, { useEffect, useRef } from "react";

// Pick a "nice" grid step (1, 2, 5 x 10^n) close to a target size in world units
function niceStep(target) {
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const m = target / pow;
  const mant = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return { step: mant * pow, mant };
}

const fmt = (v) => String(parseFloat(v.toPrecision(10)));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function render(ctx, w, h, view, draw) {
  const { x: ox, y: oy, scale } = view; // ox, oy = world point at the center of the screen
  const toX = (wx) => w / 2 + (wx - ox) * scale;
  const toY = (wy) => h / 2 - (wy - oy) * scale;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const { step, mant } = niceStep(90 / scale);
  const minor = step / (mant === 2 ? 4 : 5);
  const xMin = ox - w / 2 / scale, xMax = ox + w / 2 / scale;
  const yMin = oy - h / 2 / scale, yMax = oy + h / 2 / scale;

  const gridLines = (stepSize, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(xMin / stepSize); i <= Math.floor(xMax / stepSize); i++) {
      const px = Math.round(toX(i * stepSize)) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let i = Math.ceil(yMin / stepSize); i <= Math.floor(yMax / stepSize); i++) {
      const py = Math.round(toY(i * stepSize)) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
  };

  gridLines(minor, "#ececec"); // minor lines
  gridLines(step, "#c8c8c8"); // major lines

  // Axes
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const ax = Math.round(toX(0)) + 0.5;
  const ay = Math.round(toY(0)) + 0.5;
  if (ax >= 0 && ax <= w) { ctx.moveTo(ax, 0); ctx.lineTo(ax, h); }
  if (ay >= 0 && ay <= h) { ctx.moveTo(0, ay); ctx.lineTo(w, ay); }
  ctx.stroke();

  // Number labels (kept on screen even if an axis is panned away)
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#444";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  const label = (text, x, y) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelY = clamp(toY(0) + 5, 4, h - 18);
  for (let i = Math.ceil(xMin / step); i <= Math.floor(xMax / step); i++) {
    if (i === 0) continue;
    label(fmt(i * step), toX(i * step), labelY);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const labelX = clamp(toX(0) - 6, 40, w - 4);
  for (let i = Math.ceil(yMin / step); i <= Math.floor(yMax / step); i++) {
    if (i === 0) continue;
    label(fmt(i * step), labelX, toY(i * step));
  }

  if (draw) draw(ctx, toX, toY, scale); // your game drawing goes on top of the grid
}

export default function Graph({ draw }) {
  const canvasRef = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const paintRef = useRef(null);

  // Repaint whenever the draw function changes (e.g. a new equation)
  useEffect(() => {
    if (paintRef.current) paintRef.current();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const view = { x: 0, y: 0, scale: 40 }; // scale = pixels per unit
    let w = 0, h = 0;

    const paint = () => render(ctx, w, h, view, drawRef.current);
    paintRef.current = paint;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Drag to pan
    let dragging = false, lastX = 0, lastY = 0;
    const onDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e) => {
      if (!dragging) return;
      view.x -= (e.clientX - lastX) / view.scale;
      view.y += (e.clientY - lastY) / view.scale;
      lastX = e.clientX;
      lastY = e.clientY;
      paint();
    };
    const onUp = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };

    // Scroll to zoom around the cursor
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = view.x + (mx - w / 2) / view.scale;
      const wy = view.y - (my - h / 2) / view.scale;
      view.scale = clamp(view.scale * Math.exp(-e.deltaY * 0.0015), 2, 5000);
      view.x = wx - (mx - w / 2) / view.scale;
      view.y = wy + (my - h / 2) / view.scale;
      paint();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }}
    />
  );
}
