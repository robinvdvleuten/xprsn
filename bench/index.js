// Micro-benchmarks for xprsn. Run with `npm run bench`.
//
// Zero-dependency harness: warm up to let the JIT settle, then time ~100ms
// batches and report the best ops/sec (the sample least disturbed by GC and
// scheduling noise). `compile` and `evaluate` are measured apart because the
// design is compile-once, evaluate-many. `sink` reads every result so the work
// cannot be optimized away.
import { compile, evaluate } from '../src/index.js';

let sink = 0;

function bench(name, fn) {
	for (let w = performance.now(); performance.now() - w < 50; ) fn(); // warmup
	let best = 0;
	for (let s = 0; s < 5; s++) {
		let ops = 0, dt, t = performance.now();
		do {
			for (let i = 0; i < 1000; i++) sink += fn() ? 1 : 0;
			ops += 1000;
		} while ((dt = performance.now() - t) < 100);
		const hz = ops / (dt / 1e3);
		if (hz > best) best = hz;
	}
	console.log(name.padEnd(24), Math.round(best).toLocaleString().padStart(14), 'ops/sec');
}

const values = { user: { age: 30, roles: ['admin', 'user'] }, price: 60, qty: 2, items: [{ price: 60 }] };
const EXPR = 'user.age > 18 and "admin" in user.roles ? price * qty : 0';

// Compile (parse) throughput.
bench('compile: a + b', () => compile('a + b'));
bench('compile: complex', () => compile(EXPR));

// Evaluate throughput of an already-compiled expression.
const add = compile('a + b');
bench('eval: a + b', () => add({ a: 1, b: 2 }));

const complex = compile(EXPR);
bench('eval: complex', () => complex(values));

const member = compile('items[0].price * qty');
bench('eval: member access', () => member(values));

// Combined compile + evaluate, for callers that do not cache.
bench('evaluate: one-shot', () => evaluate('a + b', { a: 1, b: 2 }));

if (sink < 0) console.log(sink); // retain sink
