// A small expression parser for students' typed gradients.
//
// Grammar (lowest to highest precedence):
//   expr  := term (("+" | "-") term)*
//   term  := unary (("*" | "/") unary | unary)*     juxtaposition multiplies
//   unary := ("-" | "+") unary | power
//   power := atom ("^" unary)?                       right associative
//   atom  := number | name | name "(" expr ")" | "(" expr ")"
// so -w0^2 is -(w0^2) and 2w0 or 3(w1 - 1) multiply. Variables are w0, w1
// (also written w₀, w_0); constants e, pi.

const EXPR_FUNCS = {
  exp: Math.exp, log: Math.log, ln: Math.log, sqrt: Math.sqrt,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs,
  sign: Math.sign, sigma: z => 1 / (1 + Math.exp(-z)),
};
EXPR_FUNCS.sigmoid = EXPR_FUNCS.sigma;
const EXPR_CONSTS = { e: Math.E, pi: Math.PI };

/** Rewrite typographic forms (−, ·, ², w₀, σ) into the parser's ASCII. */
function normalizeExpr(src) {
  return src
    .replace(/[−–]/g, "-").replace(/[·⋅×]/g, "*").replace(/\*\*/g, "^")
    .replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/w_?₀|w_0/g, "w0").replace(/w_?₁|w_1/g, "w1")
    .replace(/σ/g, "sigma").replace(/π/g, "pi");
}

/**
 * Compile an expression in w0, w1.
 *
 * Returns:
 *   fn (function): (w) => number, for w = [w0, w1]
 *
 * Raises:
 *   Error: with a short message naming what could not be read
 */
function compileExpr(src) {
  const s = normalizeExpr(src);
  const toks = [];
  const re = /\s*(\d*\.\d+(?:e[+-]?\d+)?|\d+(?:\.\d*)?(?:e[+-]?\d+)?|[a-z_]\w*|[-+*/^()])/iy;
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) {
      if (/^\s*$/.test(s.slice(pos))) break;
      throw new Error(`can't read "${s.slice(pos).trim()[0]}"`);
    }
    toks.push(m[1]);
    pos = re.lastIndex;
  }
  if (!toks.length) throw new Error("empty");
  let i = 0;
  const peek = () => toks[i];
  const eat = t => {
    if (toks[i] !== t) throw new Error(`expected "${t}"`);
    i += 1;
  };
  const startsAtom = t => t !== undefined && (t === "(" || /^[\w.]/.test(t));

  function expr() {
    let f = term();
    while (peek() === "+" || peek() === "-") {
      const op = toks[i++], a = f, b = term();
      f = op === "+" ? w => a(w) + b(w) : w => a(w) - b(w);
    }
    return f;
  }
  function term() {
    let f = unary();
    for (;;) {
      const t = peek();
      if (t === "*" || t === "/") {
        i += 1;
        const a = f, b = unary();
        f = t === "*" ? w => a(w) * b(w) : w => a(w) / b(w);
      } else if (startsAtom(t)) {
        const a = f, b = unary();
        f = w => a(w) * b(w);
      } else {
        return f;
      }
    }
  }
  function unary() {
    if (peek() === "-") { i += 1; const a = unary(); return w => -a(w); }
    if (peek() === "+") { i += 1; return unary(); }
    return power();
  }
  function power() {
    const a = atom();
    if (peek() === "^") {
      i += 1;
      const b = unary();
      return w => a(w) ** b(w);
    }
    return a;
  }
  function atom() {
    const t = toks[i++];
    if (t === undefined) throw new Error("ends too soon");
    if (t === "(") { const a = expr(); eat(")"); return a; }
    if (/^[\d.]/.test(t)) { const v = parseFloat(t); return () => v; }
    const name = t.toLowerCase();
    if (name === "w0") return w => w[0];
    if (name === "w1") return w => w[1];
    if (name in EXPR_FUNCS) {
      const fn = EXPR_FUNCS[name];
      if (peek() !== "(") throw new Error(`${t} needs parentheses`);
      i += 1;
      const a = expr();
      eat(")");
      return w => fn(a(w));
    }
    if (name in EXPR_CONSTS) { const v = EXPR_CONSTS[name]; return () => v; }
    throw new Error(`unknown name "${t}"`);
  }

  const fn = expr();
  if (i < toks.length) throw new Error(`unexpected "${toks[i]}"`);
  return fn;
}
