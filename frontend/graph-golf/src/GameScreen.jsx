import { useCallback, useEffect, useMemo, useState } from "react";
import { generateCourse } from "./courseGen";
import { traceShot } from "./shot";
import Graph from "./Graph";
import { parseEquation } from "./parseEquation";

const TURN_MS = 30 * 1000;

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
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
    flexWrap: "wrap",
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    color: "#333",
  },
  stopInput: {
    width: "110px",
    padding: "4px 6px",
    border: "1px solid #c8c8c8",
    borderRadius: "6px",
    color: "#111",
    background: "#fff",
    colorScheme: "light",
  },
  error: { marginTop: "6px", fontSize: "13px", color: "#c0392b", fontFamily: "system-ui, sans-serif" },
};

export default function GameScreen() {
  const [text, setText] = useState("");
  const [fn, setFn] = useState(null);
  const [error, setError] = useState(null);

  const [seed, setSeed] = useState(
    () => Number(new URLSearchParams(window.location.search).get("seed")) || 42
  );
  const course = useMemo(() => generateCourse(seed), [seed]);

  const [ball, setBall] = useState(() => course.tee);
  const [dir, setDir] = useState(1); // 1 = right, -1 = mirrored
  const [stopText, setStopText] = useState("");
  const [shots, setShots] = useState(0);
  const [won, setWon] = useState(false);

  // Turn clock: driven by a start timestamp, so a server can supply it later
  const [turnStart, setTurnStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((turnStart + TURN_MS - now) / 1000));

  const startTurn = useCallback(() => {
    const t = Date.now();
    setTurnStart(t);
    setNow(t);
  }, []);

  useEffect(() => {
    if (won) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= turnStart + TURN_MS) {
        // time's up: skipped turn counts as a shot, ball stays where it is
        setShots((s) => s + 1);
        setTurnStart(t);
      }
    }, 250);
    return () => clearInterval(id);
  }, [turnStart, won]);

  const stopDx =
    stopText.trim() === "" || Number.isNaN(Number(stopText)) ? null : Number(stopText);

  // The preview and the real shot are the same trace
  const preview = useMemo(
    () => (fn ? traceShot(course, fn, ball, dir, stopDx) : null),
    [course, fn, ball, dir, stopDx]
  );

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

  const fire = () => {
    if (!preview || won || preview.result === "invalid") return;
    setBall(preview.end);
    setShots((s) => s + 1);
    if (preview.result === "hole") setWon(true);
    else startTurn(); // fresh 30 seconds for the next shot
  };

  const newCourse = () => {
    const s = Math.floor(Math.random() * 1e9);
    setSeed(s);
    setBall(generateCourse(s).tee);
    setShots(0);
    setWon(false);
    startTurn();
    window.history.replaceState(null, "", `?seed=${s}`);
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
      ctx.beginPath();
      ctx.arc(toX(course.tee.x), toY(course.tee.y), 5, 0, Math.PI * 2);
      ctx.fill();

      // --- preview of the shot ---
      if (preview && !won) {
        ctx.strokeStyle = "#2d70b3";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        let prevY = null;
        preview.points.forEach((p, i) => {
          const px = toX(p.x);
          const py = toY(p.y);
          if (i === 0 || Math.abs(p.y - prevY) > 50) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          prevY = p.y;
        });
        ctx.stroke();
      }

      // --- ball ---
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(ball.x), toY(ball.y), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
    [course, preview, ball, won]
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
            onKeyDown={(e) => {
              if (e.key === "Enter") fire();
            }}
            placeholder="x^2, sin(x), 2x + 1"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </div>

        <div style={styles.controls}>
          <button onClick={() => setDir((d) => -d)}>{dir === 1 ? "Aim: →" : "Aim: ←"}</button>
          <input
            style={styles.stopInput}
            value={stopText}
            onChange={(e) => setStopText(e.target.value)}
            placeholder="stop after (optional)"
            inputMode="decimal"
          />
          <button onClick={fire} disabled={!preview || won}>Fire</button>
          <button onClick={newCourse}>New course</button>
          <span>Shots: {shots}</span>
          {!won && (
            <strong style={{ color: secondsLeft <= 5 ? "#c0392b" : "#333" }}>
              {secondsLeft}s
            </strong>
          )}
          {won && <strong>Hole in {shots}!</strong>}
          {preview && !won && preview.result === "invalid" && <span>Curve undefined here</span>}
        </div>

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}