import { useCallback, useEffect, useMemo, useState } from "react";
import { generateCourse } from "./courseGen";
import { traceShot } from "./shot";
import Graph from "./Graph";
import { parseEquation } from "./parseEquation";

const TURN_MS = 30 * 1000;
const MAX_SHOTS = 8;
const SERVER_URL =
  window.location.hostname === "localhost"
    ? "ws://localhost:8000/ws"
    : "wss://graph-golf-server.onrender.com/ws";
const styles = {
  page: { position: "fixed", inset: 0, background: "#fff", colorScheme: "light" },
  lobby: {
    position: "fixed",
    inset: 0,
    background: "#fff",
    colorScheme: "light",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    color: "#111",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    alignItems: "center",
    padding: "28px 32px",
    border: "1px solid #c8c8c8",
    borderRadius: "12px",
    boxShadow: "0 4px 18px rgba(0, 0, 0, 0.12)",
    minWidth: "280px",
    background: "#fff",
    color: "#111",
  },
  codeInput: {
    width: "110px",
    padding: "6px 8px",
    fontSize: "18px",
    textAlign: "center",
    letterSpacing: "4px",
    border: "1px solid #c8c8c8",
    borderRadius: "6px",
    color: "#111",
    background: "#fff",
    colorScheme: "light",
  },
  code: { fontSize: "40px", letterSpacing: "8px", fontWeight: 700 },
  banner: {
    position: "absolute",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#fff",
    color: "#111",
    border: "1px solid #c8c8c8",
    borderRadius: "10px",
    boxShadow: "0 4px 18px rgba(0, 0, 0, 0.15)",
    padding: "12px 18px",
    fontFamily: "system-ui, sans-serif",
    textAlign: "center",
  },
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

// replace one slot of a [p0, p1] array held in state
const setAt = (setter, i, v) => setter((arr) => arr.map((x, j) => (j === i ? v : x)));

function strokePath(ctx, toX, toY, points, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let prevY = null;
  points.forEach((p, i) => {
    const px = toX(p.x);
    const py = toY(p.y);
    if (i === 0 || Math.abs(p.y - prevY) > 50) ctx.moveTo(px, py); // lift the pen across jumps
    else ctx.lineTo(px, py);
    prevY = p.y;
  });
  ctx.stroke();
}

export default function GameScreen() {
  // --- lobby / connection ---
  const [phase, setPhase] = useState("lobby"); // lobby | waiting | playing | over
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobbyError, setLobbyError] = useState(null);

  // --- match state ---
  const [seed, setSeed] = useState(null);
  const [me, setMe] = useState(0);
  const [turn, setTurn] = useState(-1);
  const [balls, setBalls] = useState([null, null]);
  const [shots, setShots] = useState([0, 0]);
  const [finished, setFinished] = useState([false, false]);
  const [usedMs, setUsedMs] = useState(0); // my total thinking time, for the tiebreak
  const [results, setResults] = useState(null);
  const [oppTrace, setOppTrace] = useState(null);

  // --- my shot input ---
  const [text, setText] = useState("");
  const [fn, setFn] = useState(null);
  const [error, setError] = useState(null);
  const [dir, setDir] = useState(1);
  const [stopText, setStopText] = useState("");

  // --- turn clock ---
  const [turnStart, setTurnStart] = useState(0);
  const [now, setNow] = useState(0);

  const course = useMemo(() => (seed == null ? null : generateCourse(seed)), [seed]);
  const myTurn = phase === "playing" && turn === me && !finished[me];
  const secondsLeft = Math.max(0, Math.ceil((turnStart + TURN_MS - now) / 1000));

  const stopDx =
    stopText.trim() === "" || Number.isNaN(Number(stopText)) ? null : Number(stopText);

  const myBall = balls[me];
  const preview = useMemo(
    () => (myTurn && fn && course && myBall ? traceShot(course, fn, myBall, dir, stopDx) : null),
    [myTurn, fn, course, myBall, dir, stopDx]
  );

  const send = useCallback(
    (msg) => {
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    },
    [socket]
  );

  const startTurn = useCallback(() => {
    const t = Date.now();
    setTurnStart(t);
    setNow(t);
  }, []);

  const connect = (first) => {
    setLobbyError(null);
    const ws = new WebSocket(SERVER_URL);
    ws.onopen = () => ws.send(JSON.stringify(first));
    ws.onerror = () => setLobbyError("Can't reach the server. Is it running?");
    setSocket(ws);
  };

  // --- messages from the server ---
  const onMessage = useCallback(
    (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "created") {
        setRoomCode(msg.code);
        setPhase("waiting");
      } else if (msg.type === "error") {
        setLobbyError(msg.message);
        e.target.close();
        setSocket(null);
      } else if (msg.type === "start") {
        const c = generateCourse(msg.seed);
        setSeed(msg.seed);
        setMe(msg.you);
        setBalls([c.tee, c.tee]);
        setShots([0, 0]);
        setFinished([false, false]);
        setUsedMs(0);
        setResults(null);
        setOppTrace(null);
        setTurn(msg.turn);
        if (msg.turn === msg.you) startTurn();
        setPhase("playing");
      } else if (msg.type === "shot") {
        if (msg.player === me) return; // I already applied my own shot
        setAt(setShots, msg.player, msg.shots);
        setAt(setFinished, msg.player, msg.finished);
        if (msg.timeout || !course) {
          setOppTrace(null);
          return;
        }
        try {
          const f = parseEquation(msg.equation);
          const r = traceShot(course, f, balls[msg.player], msg.dir, msg.stopDx);
          setAt(setBalls, msg.player, r.end);
          setOppTrace(r.points);
        } catch {
          setOppTrace(null);
        }
      } else if (msg.type === "turn") {
        setTurn(msg.player);
        if (msg.player === me) startTurn();
      } else if (msg.type === "over") {
        setResults(msg.results);
        setPhase("over");
      } else if (msg.type === "left") {
        if (phase !== "over") {
          setLobbyError("Your opponent left the game");
          setPhase("lobby");
          e.target.close();
          setSocket(null);
        }
      }
    },
    [me, course, balls, phase, startTurn]
  );

  useEffect(() => {
    if (!socket) return;
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket, onMessage]);

  // --- shooting ---
  const fire = () => {
    if (!myTurn || !preview || preview.result === "invalid") return;
    const elapsed = Math.min(Date.now() - turnStart, TURN_MS);
    const newUsed = usedMs + elapsed;
    const newShots = shots[me] + 1;
    const done = preview.result === "hole" || newShots >= MAX_SHOTS;
    setAt(setBalls, me, preview.end);
    setAt(setShots, me, newShots);
    setAt(setFinished, me, done);
    setUsedMs(newUsed);
    setTurn(-1); // nobody's turn until the server says so
    setOppTrace(null);
    send({ type: "shot", equation: text, dir, stopDx, shots: newShots, timeMs: newUsed, finished: done });
  };

  const handleTimeout = useCallback(() => {
    const newShots = shots[me] + 1;
    const done = newShots >= MAX_SHOTS;
    const newUsed = usedMs + TURN_MS;
    setAt(setShots, me, newShots);
    setAt(setFinished, me, done);
    setUsedMs(newUsed);
    setTurn(-1);
    send({ type: "timeout", shots: newShots, timeMs: newUsed, finished: done });
  }, [me, shots, usedMs, send]);

  useEffect(() => {
    if (!myTurn) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= turnStart + TURN_MS) handleTimeout();
    }, 250);
    return () => clearInterval(id);
  }, [myTurn, turnStart, handleTimeout]);

  const onChange = (value) => {
    setText(value);
    if (!value.trim()) {
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

  // --- drawing ---
  const draw = useCallback(
    (ctx, toX, toY, scale) => {
      if (!course) return;

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

      if (oppTrace) strokePath(ctx, toX, toY, oppTrace, "#e67e22", 2.5); // opponent's last shot
      if (preview) strokePath(ctx, toX, toY, preview.points, "#2d70b3", 2.5); // my preview

      balls.forEach((b, i) => {
        if (!b) return;
        ctx.fillStyle = i === me ? "#fff" : "#e67e22";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(toX(b.x), toY(b.y), 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    },
    [course, preview, oppTrace, balls, me]
  );

  // --- lobby screens ---
  if (phase === "lobby" || phase === "waiting") {
    return (
      <div style={styles.lobby}>
        <div style={styles.card}>
          <h2 style={{ margin: 0, color: "#111" }}>Graph Golf</h2>
          {phase === "lobby" ? (
            <>
              <button onClick={() => connect({ type: "create" })}>Create game</button>
              <div style={styles.row}>
                <input
                  style={styles.codeInput}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  maxLength={4}
                />
                <button
                  onClick={() => connect({ type: "join", code: joinCode })}
                  disabled={joinCode.length < 4}
                >
                  Join
                </button>
              </div>
            </>
          ) : (
            <>
              <div>Share this code:</div>
              <div style={styles.code}>{roomCode}</div>
              <div>Waiting for the other player...</div>
            </>
          )}
          {lobbyError && <div style={styles.error}>{lobbyError}</div>}
        </div>
      </div>
    );
  }

  // --- game screen ---
  let resultText = "";
  if (phase === "over" && results) {
    const [a, b] = results;
    if (a.shots !== b.shots) resultText = (a.shots < b.shots ? 0 : 1) === me ? "You win!" : "You lose";
    else if (a.timeMs !== b.timeMs) resultText = (a.timeMs < b.timeMs ? 0 : 1) === me ? "You win on time!" : "You lose on time";
    else resultText = "Draw";
  }

  return (
    <div style={styles.page}>
      <Graph draw={draw} />

      {phase === "over" && results && (
        <div style={styles.banner}>
          <h2 style={{ margin: "0 0 6px", color: "#111" }}>{resultText}</h2>
          <div>
            You: {results[me].shots} shots, {(results[me].timeMs / 1000).toFixed(1)}s
          </div>
          <div>
            Opponent: {results[1 - me].shots} shots, {(results[1 - me].timeMs / 1000).toFixed(1)}s
          </div>
          <button style={{ marginTop: "8px" }} onClick={() => window.location.reload()}>
            Play again
          </button>
        </div>
      )}

      <div style={styles.bar}>
        <div style={styles.row}>
          <span style={styles.label}>y =</span>
          <input
            style={styles.input}
            value={text}
            onChange={(e) => onChange(e.target.value)}
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
          <button onClick={fire} disabled={!myTurn || !preview}>Fire</button>
          <span>You: {shots[me]} | Opponent: {shots[1 - me]}</span>
          {myTurn && (
            <strong style={{ color: secondsLeft <= 5 ? "#c0392b" : "#333" }}>{secondsLeft}s</strong>
          )}
          {phase === "playing" && !myTurn && (
            <span>{finished[me] ? "You're done, waiting for the opponent..." : "Opponent's turn..."}</span>
          )}
          {myTurn && preview && preview.result === "invalid" && <span>Curve undefined here</span>}
        </div>

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}