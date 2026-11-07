import { useCallback, useState } from "react";
import { generateCourse } from "./courseGen";
import Graph from "./Graph";
import { parseEquation } from "./parseEquation";

const styles = {
  page: { position: "fixed", inset: 0, background: "#fff", colorScheme: "light" },
  bar: {
    position: "absolute",
    left: "50%",
    bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
    transform: "translateX(-50%)",
    width: "min(92vw, 560px)",
    background: "#fff",
    border: "1px solid #c8c8c8",
    borderRadius: "10px",
    boxShadow: "0 4px 18px rgba(0, 0, 0, 0.15)",
    padding: "10px 14px",
    boxSizing: "border-box",
  },
  row: { display: "flex", alignItems: "center", gap: "10px" },
  label: { fontSize: "18px", color: "#555", fontFamily: "system-ui, sans-serif" },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "18px",
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    background: "transparent",
    color: "#111",
    caretColor: "#111",
    colorScheme: "light",
  },
  error: { marginTop: "6px", fontSize: "13px", color: "#c0392b", fontFamily: "system-ui, sans-serif" },
};

export default function GameScreen() {
  const [text, setText] = useState("");
  const [fn, setFn] = useState(null);
  const [error, setError] = useState(null);
  const [course] = useState(() => generateCourse(42));

  const onChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (!value.replace(/^\s*y\s*=/i, "").trim()) {
      setFn(null);
      setError(null);
      return;
    }
    try {
      const parsed = parseEquation(value);
      setFn(() => parsed);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const draw = useCallback(
    (ctx, toX, toY, scale) => {
      // --- course ---
      ctx.fillStyle = "#888";
      for (const wall of course.walls) {
        ctx.fillRect(toX(wall.x), toY(wall.y + wall.h), wall.w * scale, wall.h * scale);
      }

      ctx.fillStyle = "#2a9d4a";
      ctx.beginPath();
      ctx.arc(toX(course.hole.x), toY(course.hole.y), course.hole.r * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#d33";
            ctx.fillStyle = "#d33";
      ctx.beginPath();
      ctx.arc(toX(course.tee.x), toY(course.tee.y), 5, 0, Math.PI * 2);
      ctx.fill();

      // --- curve ---
      if (!fn) return;
      const w = ctx.canvas.clientWidth;
      const h = ctx.canvas.clientHeight;
      const x0 = toX(0);
      ctx.strokeStyle = "#2d70b3";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let penDown = false;
      let prevPy = 0;
      for (let px = -1; px <= w + 1; px += 1) {
        const y = fn((px - x0) / scale);
        const py = toY(y);
        if (!Number.isFinite(y) || Math.abs(py) > 1e6) { penDown = false; continue; }
        if (penDown && Math.abs(py - prevPy) > h) penDown = false;
        if (penDown) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
        penDown = true;
        prevPy = py;
      }
      ctx.stroke();
    },
    [fn, course]
  );

  return (
    <div style={styles.page}>
      <Graph draw={draw} />
      <div style={styles.bar}>
        <div style={styles.row}>
          <span style={styles.label}>y =</span>
          <input
            style={styles.input}
            value={text.replace(/^\s*y\s*=\s*/i, "")}
            onChange={(e) => onChange({ target: { value: e.target.value } })}
            placeholder="x^2, sin(x), 2x + 1"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}