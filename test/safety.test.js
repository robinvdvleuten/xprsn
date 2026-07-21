import { readFileSync } from 'node:fs';
import test from 'tape';
import { compile, evaluate } from '../src/index.js';

test('prototype escape hatches are blocked', t => {
	t.throws(() => evaluate('a.constructor', { a: {} }), TypeError);
	t.throws(() => evaluate('a["constructor"]', { a: {} }), TypeError);
	t.throws(() => evaluate('a[key]', { a: {}, key: 'constructor' }), TypeError, 'computed key resolved at runtime');
	t.throws(() => evaluate('a.__proto__', { a: {} }), TypeError);
	t.throws(() => evaluate('a.prototype', { a: () => {} }), TypeError);
	t.throws(() => evaluate('constructor', {}), TypeError, 'bare variable lookup is guarded too');
	t.throws(() => evaluate('$.constructor', { $: {} }), TypeError, 'the $ anchor does not bypass the guard');
	t.throws(() => evaluate('@["__proto__"]', { '@': {} }), TypeError, 'the @ anchor does not bypass the guard');
	t.throws(() => evaluate('a?.constructor', { a: {} }), TypeError, 'null-safe access is still guarded');
	t.throws(() => evaluate('a?.["constructor"]', { a: {} }), TypeError);
	t.equal(evaluate('a?.constructor', { a: null }), null, 'nullish base short-circuits before the key is touched');
	t.throws(() => evaluate('__proto__', {}), TypeError);
	t.throws(
		() => evaluate('a.constructor.constructor("return 1")', { a: {} }),
		TypeError,
		'the classic Function escape'
	);
	t.end();
});

test('hash literals cannot pollute prototypes', t => {
	const before = {}.polluted;
	const h = evaluate('{"__proto__": {"polluted": true}}');
	t.equal({}.polluted, before, 'Object.prototype untouched');
	t.equal(Object.getPrototypeOf(h), null, 'hash results have a null prototype');
	t.deepEqual({ ...h.__proto__ }, { polluted: true }, '__proto__ is inert own data');
	t.end();
});

test('in does not see inherited properties', t => {
	t.equal(evaluate('"toString" in obj', { obj: {} }), false);
	t.equal(evaluate('"hasOwnProperty" in obj', { obj: { a: 1 } }), false);
	t.end();
});

test('null-base access throws a readable error', t => {
	t.throws(() => evaluate('a.b', { a: null }), /Cannot read "b" of null/);
	// `a` is absent, so it normalizes to null before the `.b` step reads through it.
	t.throws(() => evaluate('a.b.c', {}), /Cannot read "b" of null/);
	t.end();
});

test('null normalization does not relax the guards', t => {
	t.throws(() => evaluate('a.constructor', { a: {} }), TypeError, 'prototype keys still blocked');
	t.throws(() => evaluate('a.b', { a: null }), TypeError, 'reading through a null base still throws');
	t.throws(() => evaluate('a.b.c', { a: {} }), TypeError, 'missing key becomes null, then reading through it throws');
	t.end();
});

test('functions only resolve from the registry', t => {
	t.throws(() => evaluate('toString()'), SyntaxError, 'inherited names are not functions');
	t.throws(() => evaluate('boom()', { boom: () => 1 }), SyntaxError, 'values are not callable as functions');
	t.end();
});

test('lambda values cannot reach the Function constructor', t => {
	// Lambdas make function values first-class for the first time; every property
	// hop still routes through the get() guard, so the escape stays closed.
	t.throws(() => evaluate('(x => x).constructor'), TypeError, 'constructor blocked on a lambda value');
	t.throws(() => evaluate('(x => x)["constructor"]'), TypeError, 'computed constructor blocked too');
	t.throws(() => evaluate('(x => x).__proto__'), TypeError, '__proto__ (Function.prototype) blocked');
	t.throws(() => evaluate('(x => x).prototype'), TypeError, 'prototype blocked');
	// .call/.apply/.bind are readable but only re-invoke the safe closure; the
	// pivot to Function still needs .constructor, which the next hop blocks.
	t.throws(() => evaluate('(x => x).call.constructor'), TypeError, 'call chain terminates at the guard');
	t.throws(() => evaluate('(x => x).bind.constructor'), TypeError, 'bind chain terminates at the guard');
	const reducers = { map: (a, f) => a.map(x => f(x)) };
	t.throws(
		() => evaluate('map(rows, r => r.constructor.constructor("return 1"))', { rows: [{}] }, reducers),
		TypeError,
		'the classic escape is blocked inside a lambda body'
	);
	t.end();
});

test('a lambda param cannot be invoked as a function', t => {
	// Calls resolve only from the registry, so a lambda is never self-callable —
	// no Y-combinator, no expression-driven recursion.
	const reducers = { map: (a, f) => a.map(x => f(x)) };
	t.throws(() => compile('map(a, f => f(f))', reducers), SyntaxError, 'calling the param is a compile-time error');
	t.end();
});

test('a param named for a blocked key stays inert', t => {
	const reducers = { map: (a, f) => a.map(x => f(x)) };
	const before = {}.polluted;
	t.throws(() => evaluate('map(rows, __proto__ => __proto__.x)', { rows: [{ x: 1 }] }, reducers), TypeError, 'reading a __proto__ param is blocked');
	t.throws(() => evaluate('map(rows, constructor => constructor.x)', { rows: [{ x: 1 }] }, reducers), TypeError, 'reading a constructor param is blocked');
	t.equal({}.polluted, before, 'Object.prototype is untouched');
	t.end();
});

test('source contains no string-to-code constructs', t => {
	const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
	t.notOk(/\beval\b|\bFunction\s*\(|new\s+Function/.test(src));
	t.end();
});

test('tokenizer resists repeated unterminated quote prefixes', t => {
	const n = 30_000;
	const t0 = Date.now();
	for (const q of ['"', "'"]) {
		const src = q + ('\\' + q).repeat(n);
		t.throws(() => compile(src), SyntaxError, q + ' quote input is rejected');
	}
	t.ok(Date.now() - t0 < 1500, 'completes without quadratic rescanning');
	t.end();
});
