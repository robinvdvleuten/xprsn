// Type smoke test for index.d.ts — run via `npm run typecheck`.
// The declarations are plain (no expression-level inference), so this only
// checks the public API is callable with the expected shapes.
import { compile, evaluate, isDiagnostic } from '../index';

const diagnostic: boolean = isDiagnostic(new Error());

const fn = compile('user.age > 18 and (discount ?? 0) > 0');
fn({ user: { age: 30 }, discount: 5 });
fn();                                   // values arg is optional

const names: string[] = fn.names;
const functions: string[] = fn.functions;

// funcs registry is optional and typed as functions
compile('fmt(price)', { fmt: (n: number) => String(n) })({ price: 4.5 });

// evaluate is the one-shot form
const out: any = evaluate('a + b', { a: 1, b: 2 });
evaluate('lower(name)', { name: 'X' }, { lower: (s: string) => s.toLowerCase() });
