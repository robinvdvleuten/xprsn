import { readFileSync } from 'node:fs';
import test from 'tape';
import { evaluate } from '../src/index.js';

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

test('source contains no string-to-code constructs', t => {
	const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
	t.notOk(/\beval\b|\bFunction\s*\(|new\s+Function/.test(src));
	t.end();
});
