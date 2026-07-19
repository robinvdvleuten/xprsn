/**
 * Tiny, CSP-safe expression language for JavaScript.
 * Expressions compile to a composition of closures — never to JS source —
 * so no string-to-code construct is ever used and strict CSP is satisfied.
 */

// Tokenizer: numbers, strings, identifiers, multi-char operators, any other
// symbol. Identifiers include `$` and `@` so callers can use them as scope
// anchors (e.g. `@` = current row, `$` = root) — they are ordinary variables.
// `?.` must not swallow the `?` of a ternary before a bare decimal (`a ?.5 : b`).
const TOKENS = /\d*\.?\d+(?:[eE][+-]?\d+)?|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[\w$@]+|\?\.(?!\d)|\?\?|[<>=!*]=|&&|\|\||\*\*|\S/g;

// Binary operator precedence (higher binds tighter). `**` is right-associative.
// `~` (string concat) sits below comparison and above `+`, so `"x: " ~ a + b`
// joins the sum and `a ~ b == "12"` compares the joined string.
const PREC = { '??': 1, or: 2, '||': 2, and: 3, '&&': 3, '==': 4, '!=': 4, in: 5, '<': 6, '>': 6, '<=': 6, '>=': 6, '~': 7, '+': 8, '-': 8, '*': 9, '/': 9, '%': 9, '**': 10 };

// Shared parser state; parsing is synchronous so this is safe.
// `nm` collects free variables, `fnm` the registry functions actually called.
let toks, i, fns, nm, fnm;

let err = msg => { throw SyntaxError(msg) };
let bad = () => err('Unexpected ' + (toks[i] ?? 'end of expression'));
let eat = t => toks[i] === t && (i++, !0);
let expect = t => eat(t) || bad();

// Guarded property read — the single gate for every dynamic key in the
// language. Blocks the prototype-chain escape hatches (`x.constructor.constructor`
// is `Function`) and gives readable errors on null bases.
let get = (o, k) => {
	if (o == null) throw TypeError('Cannot read "' + k + '" of ' + o);
	if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw TypeError('Cannot access "' + k + '"');
	return o[k];
};

// String literal → value. Single-quoted strings normalize to JSON first.
let str = t => JSON.parse(t[0] === '"' ? t : '"' + t.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');

// Identifier start (also a valid property name): letters, `_`, and the `$`/`@`
// scope anchors. Property keys still route through the get() guard.
let ID = /^[A-Za-z_$@]/;

let apply = (op, a, b) =>
	op === '+' ? a + b :
	op === '-' ? a - b :
	op === '*' ? a * b :
	op === '/' ? a / b :
	op === '%' ? a % b :
	op === '**' ? a ** b :
	op === '~' ? '' + a + b : // string concat, coerces both sides
	op === '==' ? a === b :
	op === '!=' ? a !== b :
	op === '<' ? a < b :
	op === '>' ? a > b :
	op === '<=' ? a <= b :
	op === '>=' ? a >= b :
	b && b.includes ? b.includes(a) : Object.hasOwn(b, a); // in

// Comma-separated expressions until `end` (call arguments, array items).
let list = end => {
	let items = [];
	if (!eat(end)) {
		do items.push(ternary()); while (eat(','));
		expect(end);
	}
	return items;
};

let primary = () => {
	let t = toks[i++] ?? bad();

	if (t === '(') {
		let e = ternary();
		expect(')');
		return e;
	}

	if (t === '[') {
		let items = list(']');
		return v => items.map(e => e(v));
	}

	if (t === '{') {
		let pairs = [];
		if (!eat('}')) {
			do {
				let k = toks[i++] ?? bad();
				k = /^["']/.test(k) ? str(k) : /^[\w.$@]/.test(k) ? k : (i--, bad());
				expect(':');
				pairs.push([k, ternary()]);
			} while (eat(','));
			expect('}');
		}
		// Null-prototype result: `{"__proto__": x}` stays inert data.
		return v => {
			let o = Object.create(null);
			for (let [k, e] of pairs) o[k] = e(v);
			return o;
		};
	}

	if (/^["']/.test(t)) {
		let s = str(t);
		return () => s;
	}

	if (/^[\d.]/.test(t)) {
		let n = +t;
		return () => n;
	}

	if (t === 'true') return () => !0;
	if (t === 'false') return () => !1;
	if (t === 'null') return () => null;

	if (ID.test(t)) {
		if (eat('(')) {
			// Functions resolve at compile time, only from the registry.
			Object.hasOwn(fns, t) || err(t + ' is not a function');
			fnm.add(t);
			let fn = fns[t], args = list(')');
			return v => fn(...args.map(e => e(v)));
		}
		nm.add(t);
		return v => get(v, t);
	}

	i--;
	bad();
};

// One postfix step off base `o`. `key(v)` is the member key; `opt` (the `?.`
// form) yields undefined on a nullish base instead of throwing, per step; a
// truthy `args` makes it a method call bound to the base.
let step = (o, key, opt, args) => v => {
	let b = o(v);
	if (opt && b == null) return undefined;
	let m = get(b, key(v));
	return args ? m.apply(b, args.map(a => a(v))) : m;
};

let postfix = () => {
	let e = primary();
	for (;;) {
		let opt = eat('?.'), computed = eat('['), key;
		if (computed) {
			key = ternary();
			expect(']');
		} else if (opt || eat('.')) {
			let k = toks[i++] ?? bad();
			ID.test(k) || (i--, bad());
			key = () => k;
		} else return e;
		// A trailing `(` is a method call, but not on a computed index.
		e = step(e, key, opt, !computed && eat('(') ? list(')') : 0);
	}
};

let unary = () => {
	let t = toks[i], e;
	if (t === '!' || t === 'not') return i++, e = unary(), v => !e(v);
	if (t === '-') return i++, e = unary(), v => -e(v);
	if (t === '+') return i++, e = unary(), v => +e(v);
	return postfix();
};

// Precedence climbing over PREC; `and`/`or` short-circuit.
let expr = (min = 1) => {
	let l = unary();
	for (let op, p; (p = PREC[op = toks[i]]) >= min; ) {
		i++;
		let r = expr(op === '**' ? p : p + 1);
		l = op === 'and' || op === '&&' ? (a => v => a(v) && r(v))(l)
			: op === 'or' || op === '||' ? (a => v => a(v) || r(v))(l)
			: op === '??' ? (a => v => a(v) ?? r(v))(l)
			: ((o, a) => v => apply(o, a(v), r(v)))(op, l);
	}
	return l;
};

let ternary = () => {
	let c = expr();
	if (!eat('?')) return c;
	if (eat(':')) {
		// `a ?: b` shorthand — yields the condition when truthy, else `b`.
		let e = ternary();
		return v => c(v) || e(v);
	}
	let t = ternary();
	expect(':');
	let e = ternary();
	return v => (c(v) ? t(v) : e(v));
};

/**
 * Compile an expression once, evaluate it many times.
 *
 * The returned evaluator exposes `names`: the free variables the expression
 * reads, deduplicated. Property names, hash keys, and function names are not
 * included. It also exposes `functions`: the registry functions the expression
 * calls, deduplicated (method names like `s.trim()` are not included).
 *
 * @param {string} src The expression, e.g. `'user.age > 18 and "admin" in user.roles'`.
 * @param {Record<string, Function>} [funcs] Functions callable from the expression.
 * @returns {{(values?: Record<string, any>): any, names: string[], functions: string[]}} Evaluator for the compiled expression.
 * @throws {SyntaxError} On malformed input or unknown function names.
 */
export function compile(src, funcs) {
	toks = String(src).match(TOKENS) || [];
	i = 0;
	fns = funcs || {};
	nm = new Set();
	fnm = new Set();
	let e = toks.length ? ternary() : bad();
	i < toks.length && bad();
	let f = v => e(v || {});
	// Array.from, not a spread: the bundler's transpile turns `[...set]` into
	// `[].concat(set)`, which wraps the Set instead of unpacking it.
	f.names = Array.from(nm);
	f.functions = Array.from(fnm);
	return f;
}

/**
 * Compile and evaluate an expression in one go.
 *
 * @param {string} src The expression to evaluate.
 * @param {Record<string, any>} [values] Variables available to the expression.
 * @param {Record<string, Function>} [funcs] Functions callable from the expression.
 * @returns {any} The expression result.
 */
export function evaluate(src, values, funcs) {
	return compile(src, funcs)(values);
}
