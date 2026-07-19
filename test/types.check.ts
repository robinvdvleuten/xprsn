// Type-level assertions for index.d.ts — run via `npm run typecheck`.
// Guards the type-level name lexer against drifting from the runtime one.
import { compile, evaluate } from '../index';

// --- happy paths ---

const fn = compile('user.age > 18 and (discount ?? 0) > 0');
fn({ user: { age: 30 }, discount: 5 }); // all names
fn({ user: { age: 30 } });              // names are optional (?? idiom)
fn();                                   // values arg is optional

const names: ('user' | 'discount')[] = fn.names;

// string literals are skipped; keywords/properties/methods are not names
const roles = compile('"admin" in user.roles and name.toUpperCase() == "X"');
roles({ user: {}, name: 'x' });

// function calls are a separate namespace
const calc = compile('fmt(price)', { fmt: (n: number) => String(n) });
calc({ price: 4.5 });

// `functions` lists the registry functions called (runtime introspection)
const called: string[] = calc.functions;

// dynamic strings degrade to Record<string, any>
declare const dyn: string;
evaluate(dyn, { anything: 1, at: 'all' });

// numbers, ?., ?? and ternary decimals don't confuse the scanner
compile('a ?.5 : 1e3')({ a: true });

// $ and @ are identifier characters (scope anchors)
const anchored = compile('@.price * $.rate');
anchored({ '@': { price: 2 }, '$': { rate: 1.1 } });
const anchorNames: ('@' | '$')[] = anchored.names;

// --- errors: typo'd or unknown keys in object literals ---

// @ts-expect-error `usr` is not a variable of the expression
fn({ usr: { age: 30 } });

// @ts-expect-error `admin` appears only inside a string literal
roles({ user: {}, name: 'x', admin: true });

// @ts-expect-error `fmt` is a function, not a value
calc({ price: 4.5, fmt: 1 });

// @ts-expect-error property names are not root variables
fn({ age: 30 });

// @ts-expect-error names array is exact
const wrong: 'x'[] = fn.names;

// @ts-expect-error evaluate checks too
evaluate('a + b', { a: 1, c: 2 });

// @ts-expect-error anchor names are exact
const wrongAnchors: '@'[] = anchored.names;
