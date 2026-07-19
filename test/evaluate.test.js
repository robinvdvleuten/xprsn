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

test('string concatenation', t => {
	t.equal(evaluate('"a" ~ "b"'), 'ab');
	t.equal(evaluate('"x-" ~ 5'), 'x-5', 'coerces the right side');
	t.equal(evaluate('1 ~ 2'), '12', 'coerces both sides');
	t.equal(evaluate('"a" ~ "b" ~ "c"'), 'abc', 'left-associative chain');
	t.equal(evaluate('first ~ " " ~ last', { first: 'Robin', last: 'v' }), 'Robin v');
	t.equal(evaluate('"sum: " ~ a + b', { a: 1, b: 2 }), 'sum: 3', '~ binds looser than +');
	t.equal(evaluate('a ~ b == "12"', { a: 1, b: 2 }), true, '~ binds tighter than ==');
	t.deepEqual(compile('a ~ b').names, ['a', 'b'], 'operands are still scanned for names');
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
	t.equal(evaluate('a?.b', { a: null }), null);
	t.equal(evaluate('a?.b', {}), null, 'missing base');
	t.equal(evaluate('a?.b', { a: { b: 1 } }), 1);
	t.equal(evaluate('a?.b?.c', { a: { b: null } }), null, 'chained');
	t.equal(evaluate('a?.[0]', { a: null }), null, 'null-safe index');
	t.equal(evaluate('a?.[i + 1]', { a: ['x', 'y'], i: 0 }), 'y');
	t.equal(evaluate('a?.toUpperCase()', { a: null }), null, 'null-safe method call');
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

test('compiled functions expose their free variables', t => {
	t.deepEqual(compile('a + b').names, ['a', 'b']);
	t.deepEqual(compile('a + a * a').names, ['a'], 'deduplicated');
	t.deepEqual(compile('42 + "x"').names, [], 'literals reference nothing');
	t.deepEqual(compile('user.name.toUpperCase()').names, ['user'], 'only the root, not properties or methods');
	t.deepEqual(compile('f(a)', { f: x => x }).names, ['a'], 'function names are a separate namespace');
	t.deepEqual(compile('{key: a}').names, ['a'], 'bare hash keys are not variables');
	t.deepEqual(compile('a?.b ?? c').names, ['a', 'c'], 'null-safe chains count their root');
	t.deepEqual(compile('items[i + 1]').names, ['items', 'i'], 'index expressions are scanned too');
	t.deepEqual(compile('x and y or not z').names, ['x', 'y', 'z'], 'word operators are not variables');
	t.end();
});

test('bound names are excluded from free variables', t => {
	const f = compile('@.price * qty + $.tax', {}, { bound: ['@', '$'] });
	t.deepEqual(f.names, ['qty'], 'host-injected anchors are omitted');
	t.equal(f({ '@': { price: 2 }, qty: 3, '$': { tax: 1 } }), 7, 'bound names still resolve at eval time');
	t.deepEqual(compile('a + b', {}, { bound: new Set(['a']) }).names, ['b'], 'bound accepts a Set');
	t.deepEqual(compile('a + b', {}).names, ['a', 'b'], 'no bound is unchanged');
	t.deepEqual(compile('region.key', {}, { bound: ['region'] }).names, [], 'a bound root drops out entirely');
	t.deepEqual(compile('f(a)', { f: x => x }, { bound: ['a'] }).functions, ['f'], 'functions are unaffected by bound');
	t.end();
});

test('compiled functions expose the registry functions they call', t => {
	const fns = { sum: x => x, avg: x => x, lower: s => s };
	t.deepEqual(compile('sum(a)', fns).functions, ['sum']);
	t.deepEqual(compile('sum(a) + avg(b)', fns).functions, ['sum', 'avg']);
	t.deepEqual(compile('sum(a) + sum(b)', fns).functions, ['sum'], 'deduplicated');
	t.deepEqual(compile('a + b').functions, [], 'no calls, no functions');
	t.deepEqual(compile('s.trim()', {}).functions, [], 'method calls are not registry functions');
	t.deepEqual(compile('lower(name) ~ "!"', fns).functions, ['lower'], 'nested in an expression');
	t.end();
});

test('$ and @ are identifier characters (scope anchors)', t => {
	t.equal(evaluate('@', { '@': 5 }), 5, '@ is a bare variable');
	t.equal(evaluate('$', { $: 9 }), 9, '$ is a bare variable');
	t.equal(evaluate('@.price', { '@': { price: 7 } }), 7, '@ as a scope root');
	t.equal(evaluate('$.total', { $: { total: 100 } }), 100, '$ as a scope root');
	t.equal(evaluate('@.price * qty', { '@': { price: 4 }, qty: 3 }), 12, 'anchors mix with bare names');
	t.equal(evaluate('$.rate * @.amount', { $: { rate: 1.1 }, '@': { amount: 10 } }), 11, 'both anchors');
	t.equal(evaluate('$foo + a$b', { $foo: 2, a$b: 3 }), 5, '$ and @ work mid-identifier too');
	t.deepEqual(compile('@.price * $.rate').names, ['@', '$'], 'anchors are reported as free variables');
	t.end();
});

test('missing values default to null', t => {
	t.equal(evaluate('a', {}), null);
	t.equal(compile('1 + 1')(), 2, 'values argument is optional');
	t.end();
});

test('absent reads yield null', t => {
	t.equal(evaluate('a', {}), null, 'missing variable');
	t.equal(evaluate('a.b', { a: {} }), null, 'missing property');
	t.equal(evaluate('a == null', {}), true, 'the natural nothing test holds');
	t.equal(evaluate('a.b == null', { a: {} }), true, 'missing property is null');
	t.equal(evaluate('a?.b', { a: null }), null, 'null-safe base');
	t.equal(evaluate('a.b', { a: { b: 0 } }), 0, 'present falsy is untouched');
	t.equal(evaluate('a.b', { a: { b: null } }), null, 'present null is untouched');
	t.equal(evaluate('a.b', { a: { b: '' } }), '', 'present empty string is untouched');
	t.end();
});

// A lambda `x => body` compiles to a function value; the host reducer calls it
// per element. Reducers live in the registry — xprsn only supplies the per-item
// function, so the host owns iteration and reset boundaries.
const reducers = {
	sum: (arr, f) => arr.reduce((s, x) => s + f(x), 0),
	count: (arr, f) => arr.reduce((s, x) => s + (f(x) ? 1 : 0), 0),
	any: (arr, f) => arr.some(x => f(x)),
	map: (arr, f) => arr.map(x => f(x)),
};
const rows = [{ price: 2, qty: 3, status: 'paid' }, { price: 5, qty: 1, status: 'open' }];

test('lambdas drive per-item computation over a collection', t => {
	t.equal(evaluate('sum(orders, r => r.price * r.qty)', { orders: rows }, reducers), 11, 'aggregate');
	t.equal(evaluate('count(orders, r => r.status == "paid")', { orders: rows }, reducers), 1, 'predicate count');
	t.equal(evaluate('any(orders, r => r.qty > 2)', { orders: rows }, reducers), true, 'existential');
	t.deepEqual(evaluate('map(orders, r => r.status == "paid" ? 1 : 0)', { orders: rows }, reducers), [1, 0], 'ternary body');
	t.equal(evaluate('sum(orders, r => r.price)', { orders: [] }, reducers), 0, 'empty collection');
	t.end();
});

test('lambda bodies close over outer scope', t => {
	t.deepEqual(evaluate('map(orders, r => r.price * tax)', { orders: rows, tax: 10 }, reducers), [20, 50], 'free var from outer scope');
	// Inner `sum` re-binds `n`; outer `r` still resolves through the child scope chain.
	t.deepEqual(
		evaluate('map(orders, r => sum(nums, n => n + r.qty))', { orders: rows, nums: [10, 20] }, reducers),
		[36, 32],
		'nested lambdas keep both bindings'
	);
	t.end();
});

test('a lambda param shadows outer variables and anchors', t => {
	t.deepEqual(evaluate('map(orders, r => r.price)', { orders: rows, r: { price: 999 } }, reducers), [2, 5], 'param wins over an outer var');
	t.deepEqual(evaluate('map(orders, r => r.price)', { orders: rows, '@': { price: 999 } }, reducers), [2, 5], 'param unaffected by the @ anchor');
	t.end();
});

test('lambda params are excluded from names but reducers are reported', t => {
	const f = compile('sum(orders, r => r.price * tax)', reducers);
	t.deepEqual(f.names, ['orders', 'tax'], 'the param is not a free variable');
	t.deepEqual(f.functions, ['sum'], 'the reducer is reported');
	t.deepEqual(compile('map(a, x => map(b, y => x + y))', reducers).names, ['a', 'b'], 'nested params both drop out');
	t.deepEqual(compile('r + sum(a, r => r)', reducers).names, ['r', 'a'], 'a same-named outer var still counts outside the lambda');
	t.end();
});
