import React, { useCallback, useState } from "react";
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
    color: "#111", // typed text is black
    caretColor: "#111",
    colorScheme: "light", // stops dark-mode browser styling from turning the text white
  },
  error: { marginTop: "6px", fontSize: "13px", color: "#c0392b", fontFamily: "system-ui, sans-serif" },
};

export default function GameScreen() {
  const [text, setText] = useState("");
  const [fn, setFn] = useState(null); // last equation that parsed successfully
  const [error, setError] = useState(null);

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
      setFn(() => parsed); // wrapped so React doesn't call it as an updater
      setError(null);
    } catch (err) {
      setError(err.message); // keep drawing the last good equation
    }
  };

  // Called by Graph after the grid is drawn; draws the curve for y = f(x)
  const draw = useCallback(
    (ctx, toX, toY, scale) => {
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
        if (penDown && Math.abs(py - prevPy) > h) penDown = false; // break at asymptotes
        if (penDown) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
        penDown = true;
        prevPy = py;
      }
      ctx.stroke();
    },
    [fn]
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
