// Turns text like "y = 2x^2 - sin(x)" into a JavaScript function of x.
// Uses a small hand-written parser instead of eval(), so user input can't run code.

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS = { pi: Math.PI, e: Math.E };
// Longest names first so "asin" matches before "sin"
const NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), "x"].sort(
  (a, b) => b.length - a.length
);

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) throw new Error("Bad number");
      tokens.push({ type: "num", value: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      const word = /^[a-zA-Z]+/.exec(src.slice(i))[0].toLowerCase();
      let rest = word;
      while (rest) {
        const name = NAMES.find((n) => rest.startsWith(n));
        if (!name) throw new Error(`Unknown name "${rest}"`);
        tokens.push({ type: "id", value: name });
        rest = rest.slice(name.length);
      }
      i += word.length;
      continue;
    }
    if ("+-*/^()".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }
  return tokens;
}

export function parseEquation(input) {
  const src = input.trim().replace(/^y\s*=/i, "");
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (t, v) => t && t.type === "op" && t.value === v;
  const startsPrimary = (t) => t && (t.type === "num" || t.type === "id" || isOp(t, "("));

  // expr = term (("+" | "-") term)*
  function parseExpr() {
    let left = parseTerm();
    while (isOp(peek(), "+") || isOp(peek(), "-")) {
      const op = next().value;
      const right = parseTerm();
      const l = left;
      left = op === "+" ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }

  // term = unary (("*" | "/" | implicit multiply) unary)*   e.g. 2x, 3(x+1)
  function parseTerm() {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      let op;
      if (isOp(t, "*") || isOp(t, "/")) op = next().value;
      else if (startsPrimary(t)) op = "*";
      else break;
      const right = parseUnary();
      const l = left;
      left = op === "*" ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
    }
    return left;
  }

  function parseUnary() {
    if (isOp(peek(), "-")) { next(); const f = parseUnary(); return (x) => -f(x); }
    if (isOp(peek(), "+")) { next(); return parseUnary(); }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (isOp(peek(), "^")) {
      next();
      const exp = parseUnary();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new Error("The equation ends too soon");
    if (t.type === "num") { const v = t.value; return () => v; }
    if (t.type === "id") {
      if (t.value === "x") return (x) => x;
      if (t.value in CONSTS) { const v = CONSTS[t.value]; return () => v; }
      const fn = FUNCS[t.value];
      if (!isOp(peek(), "(")) throw new Error(`${t.value} needs parentheses, like ${t.value}(x)`);
      next();
      const arg = parseExpr();
      if (!isOp(peek(), ")")) throw new Error("Missing )");
      next();
      return (x) => fn(arg(x));
    }
    if (isOp(t, "(")) {
      const f = parseExpr();
      if (!isOp(peek(), ")")) throw new Error("Missing )");
      next();
      return f;
    }
    throw new Error(`Unexpected "${t.value}"`);
  }

  const f = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].value}"`);
  return f;
}
