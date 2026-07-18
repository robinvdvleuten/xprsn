import test from 'tape';
import { compile, evaluate } from '../src/index.js';

test('literals', t => {
	t.equal(evaluate('42'), 42);
	t.equal(evaluate('4.2'), 4.2);
	t.equal(evaluate('.5'), 0.5);
	t.equal(evaluate('1e3'), 1000);
	t.equal(evaluate('"hello"'), 'hello');
	t.equal(evaluate("'hello'"), 'hello');
	t.equal(evaluate('"it\\"s"'), 'it"s');
	t.equal(evaluate("'it\\'s'"), "it's");
	t.equal(evaluate('"line\\nbreak"'), 'line\nbreak');
	t.equal(evaluate('true'), true);
	t.equal(evaluate('false'), false);
	t.equal(evaluate('null'), null);
	t.end();
});

test('arithmetic', t => {
	t.equal(evaluate('1 + 2'), 3);
	t.equal(evaluate('5 - 2'), 3);
	t.equal(evaluate('3 * 4'), 12);
	t.equal(evaluate('10 / 4'), 2.5);
	t.equal(evaluate('10 % 3'), 1);
	t.equal(evaluate('2 ** 10'), 1024);
	t.end();
});

test('precedence and associativity', t => {
	t.equal(evaluate('2 + 3 * 4'), 14);
	t.equal(evaluate('(2 + 3) * 4'), 20);
	t.equal(evaluate('2 ** 3 ** 2'), 512, '** is right-associative');
	t.equal(evaluate('10 - 3 - 2'), 5, '- is left-associative');
	t.equal(evaluate('1 + 2 > 2 and 1 < 2'), true);
	t.equal(evaluate('false or true and false'), false, 'and binds tighter than or');
	t.end();
});

test('unary operators', t => {
	t.equal(evaluate('-5'), -5);
	t.equal(evaluate('+5'), 5);
	t.equal(evaluate('--5'), 5);
	t.equal(evaluate('!true'), false);
	t.equal(evaluate('not true'), false);
	t.equal(evaluate('not not true'), true);
	t.equal(evaluate('-a', { a: 3 }), -3);
	t.end();
});

test('comparison', t => {
	t.equal(evaluate('1 == 1'), true);
	t.equal(evaluate('1 == "1"'), false, '== is strict');
	t.equal(evaluate('1 != "1"'), true, '!= is strict');
	t.equal(evaluate('2 < 3'), true);
	t.equal(evaluate('3 <= 3'), true);
	t.equal(evaluate('4 > 5'), false);
	t.equal(evaluate('5 >= 5'), true);
	t.end();
});

test('logical operators', t => {
	t.equal(evaluate('true and false'), false);
	t.equal(evaluate('true && true'), true);
	t.equal(evaluate('false or true'), true);
	t.equal(evaluate('false || false'), false);
	t.end();
});

test('short-circuiting', t => {
	let calls = 0;
	const boom = () => (calls++, true);
	t.equal(evaluate('false and boom()', {}, { boom }), false);
	t.equal(evaluate('true or boom()', {}, { boom }), true);
	t.equal(calls, 0, 'boom() never called');
	t.equal(evaluate('true and boom()', {}, { boom }), true);
	t.equal(calls, 1);
	t.end();
});

test('in operator', t => {
	t.equal(evaluate('"admin" in roles', { roles: ['user', 'admin'] }), true);
	t.equal(evaluate('"root" in roles', { roles: ['user', 'admin'] }), false);
	t.equal(evaluate('"a" in obj', { obj: { a: 1 } }), true);
	t.equal(evaluate('"b" in obj', { obj: { a: 1 } }), false);
	t.equal(evaluate('"ell" in "hello"'), true, 'substring check on strings');
	t.equal(evaluate('1 in [1, 2, 3]'), true);
	t.end();
});

test('arrays', t => {
	t.deepEqual(evaluate('[1, 2, 3]'), [1, 2, 3]);
	t.deepEqual(evaluate('[]'), []);
	t.deepEqual(evaluate('[1 + 1, "a", [true]]'), [2, 'a', [true]]);
	t.equal(evaluate('[1, 2, 3][1]'), 2);
	t.end();
});

test('hashes', t => {
	t.deepEqual({ ...evaluate('{"a": 1, "b": 2}') }, { a: 1, b: 2 });
	t.deepEqual({ ...evaluate('{a: 1}') }, { a: 1 }, 'bare-word keys');
	t.deepEqual({ ...evaluate("{'a': 1}") }, { a: 1 }, 'single-quoted keys');
	t.equal(evaluate('{a: 1 + 1}.a'), 2);
	t.deepEqual({ ...evaluate('{}') }, {});
	t.end();
});

test('ternary', t => {
	t.equal(evaluate('true ? "yes" : "no"'), 'yes');
	t.equal(evaluate('false ? "yes" : "no"'), 'no');
	t.equal(evaluate('1 > 2 ? "a" : 2 > 1 ? "b" : "c"'), 'b', 'nested ternary');
	t.equal(evaluate('"x" ?: "fallback"'), 'x', '?: shorthand keeps truthy value');
	t.equal(evaluate('"" ?: "fallback"'), 'fallback');
	t.end();
});

test('null coalescing', t => {
	t.equal(evaluate('null ?? "fallback"'), 'fallback');
	t.equal(evaluate('a ?? "fallback"', {}), 'fallback', 'missing variable is nullish');
	t.equal(evaluate('0 ?? "fallback"'), 0, 'falsy but not nullish');
	t.equal(evaluate('"" ?? "fallback"'), '', 'empty string survives');
	t.equal(evaluate('a ?? b ?? "last"', {}), 'last', 'chains');
	t.equal(evaluate('a ?? b', { a: null, b: 2 }), 2);
	t.equal(evaluate('1 + 2 ?? 9'), 3, 'binds looser than arithmetic');
	t.equal(evaluate('null ?? false or "x"'), 'x', 'binds looser than or');
	t.equal(evaluate('a ?? "d" == "d" ? "empty" : a', {}), 'empty', 'ternary is outermost');
	t.end();
});

test('null-safe access', t => {
	t.equal(evaluate('a?.b', { a: null }), undefined);
	t.equal(evaluate('a?.b', {}), undefined, 'missing base');
	t.equal(evaluate('a?.b', { a: { b: 1 } }), 1);
	t.equal(evaluate('a?.b?.c', { a: { b: null } }), undefined, 'chained');
	t.equal(evaluate('a?.[0]', { a: null }), undefined, 'null-safe index');
	t.equal(evaluate('a?.[i + 1]', { a: ['x', 'y'], i: 0 }), 'y');
	t.equal(evaluate('a?.toUpperCase()', { a: null }), undefined, 'null-safe method call');
	t.equal(evaluate('a?.toUpperCase()', { a: 'hi' }), 'HI');
	t.equal(evaluate('a?.b ?? "none"', { a: null }), 'none', 'pairs with ??');
	t.throws(() => evaluate('a?.b.c', { a: null }), TypeError, 'safety is per step, not per chain');
	t.end();
});

test('ternary before a bare decimal is not null-safe access', t => {
	t.equal(evaluate('a ?.5 : 1', { a: true }), 0.5);
	t.equal(evaluate('a?.5:1', { a: false }), 1);
	t.end();
});

test('property and index access', t => {
	const values = { user: { name: 'Robin', address: { city: 'Eindhoven' } }, items: [{ price: 60 }] };
	t.equal(evaluate('user.name', values), 'Robin');
	t.equal(evaluate('user.address.city', values), 'Eindhoven');
	t.equal(evaluate('user["name"]', values), 'Robin');
	t.equal(evaluate('items[0].price', values), 60);
	t.equal(evaluate('items[1 - 1].price', values), 60, 'computed index');
	t.equal(evaluate('items[0].price * qty > 100', { ...values, qty: 2 }), true);
	t.end();
});

test('method calls', t => {
	t.equal(evaluate('name.toUpperCase()', { name: 'robin' }), 'ROBIN');
	t.equal(evaluate('name.slice(1, 3)', { name: 'robin' }), 'ob');
	t.equal(evaluate('items.indexOf(2)', { items: [1, 2, 3] }), 1, 'this is bound to the object');
	t.end();
});

test('custom functions', t => {
	const funcs = { lower: s => s.toLowerCase(), max: Math.max };
	t.equal(evaluate('lower("HELLO")', {}, funcs), 'hello');
	t.equal(evaluate('max(1, 5, 3)', {}, funcs), 5);
	t.equal(evaluate('lower(name) == "robin"', { name: 'ROBIN' }, funcs), true);
	t.end();
});

test('compile once, evaluate many', t => {
	const fn = compile('a + b');
	t.equal(fn({ a: 1, b: 2 }), 3);
	t.equal(fn({ a: 10, b: 20 }), 30);
	t.end();
});

test('missing values default to undefined', t => {
	t.equal(evaluate('a', {}), undefined);
	t.equal(compile('1 + 1')(), 2, 'values argument is optional');
	t.end();
});
