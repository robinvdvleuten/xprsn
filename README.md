# xprsn

A tiny, CSP-safe expression language for JavaScript. **~1.2KB min+gzip, zero dependencies.**

[![NPM version](https://img.shields.io/npm/v/xprsn.svg)](https://www.npmjs.com/package/xprsn)
[![Build Status](https://github.com/robinvdvleuten/xprsn/actions/workflows/test.yml/badge.svg)](https://github.com/robinvdvleuten/xprsn/actions/workflows/test.yml)
[![licenses](https://licenses.dev/b/npm/xprsn)](https://licenses.dev/npm/xprsn)

Evaluates expressions like `user.age > 18 and "admin" in user.roles` against data you provide, without running them as JavaScript. xprsn parses each expression into a chain of plain closures, so there is no `eval` and no `new Function`.

```js
import { compile, evaluate } from 'xprsn';

// One-shot:
evaluate('items[0].price * qty > 100', { items: [{ price: 60 }], qty: 2 });
// => true

// Compile once, evaluate many times:
const isAdmin = compile('user.age > 18 and "admin" in user.roles');
isAdmin({ user: { age: 30, roles: ['admin'] } }); // => true
isAdmin({ user: { age: 16, roles: [] } });        // => false

// Custom functions (third argument of evaluate, second of compile):
evaluate('lower(name) == "robin"', { name: 'ROBIN' }, { lower: s => s.toLowerCase() });
// => true
```

## How far can you push this?

Pretty far. Two packages build on xprsn with the same trick one level up, so everything compiles to closures and the whole stack stays CSP-safe:

- [sjabloon](https://github.com/robinvdvleuten/sjabloon) is a full template engine: `{{ expr }}` interpolation with HTML escaping, `{{#if}}`/`{{#elif}}` and `{{#each}}` blocks, and any xprsn expression inside every tag. About 1KB on top of this package.
- [padvinder](https://github.com/robinvdvleuten/padvinder) is a JSONPath engine where every `?(...)` filter is an xprsn expression. Filter evaluation is the part of JSONPath that has produced real code-injection CVEs elsewhere; here it goes through a parser with no route to code execution. About 1.2KB on top.

## API

### `compile(expression, functions?)`

Parses the expression and returns an evaluator function `(values?) => result`. Throws a `SyntaxError` on malformed input or unknown function names, so a bad expression fails at compile time rather than during evaluation.

The evaluator also carries `names`: the variables the expression reads, deduplicated. Property names, hash keys, and registry functions don't count; only the roots do.

```js
const fn = compile('user.age > 18 and (discount ?? 0) > 0');
fn.names; // => ['user', 'discount']
```

That one array covers a lot of ground when expressions come from your users: validate a rule against your schema before saving it (`fn.names.every(n => n in schema)`), drive autocomplete in a rule editor, or find which stored rules read a field you're about to rename. It also pairs with the multi-step pattern below, where each step's `names` are its dependencies.

TypeScript users get the same check at compile time: when the expression is a string literal, `names` is inferred as a literal union and the values parameter is typed from it, so a typo'd key is a type error before anything runs.

```ts
const fn = compile('user.age > 18');
fn({ usr: { age: 30 } });
//   ^^^ error: 'usr' does not exist in type '{ user?: any }'
```

### `evaluate(expression, values?, functions?)`

Shorthand for `compile(expression, functions)(values)`.

There is no built-in parse cache; if you evaluate the same expressions repeatedly, memoize `compile`:

```js
const cache = new Map();
const cached = expr => cache.get(expr) ?? cache.set(expr, compile(expr)).get(expr);
```

## Syntax

| Category | Syntax |
| --- | --- |
| Literals | `42`, `4.2`, `.5`, `1e3`, `"double"`, `'single'`, `true`, `false`, `null` |
| Arrays | `[1, 2, 3]` |
| Hashes | `{"key": value}`, `{key: value}` |
| Arithmetic | `+` `-` `*` `/` `%` `**` |
| Comparison | `==` `!=` `<` `>` `<=` `>=` (strict: `1 == "1"` is `false`) |
| Logical | `and` `&&` `or` `\|\|` `not` `!` (with short-circuiting) |
| Membership | `"admin" in roles` (arrays: `includes`; strings: substring; objects: own keys only) |
| Ternary | `a ? b : c`, and the `a ?: b` shorthand |
| Null coalescing | `a ?? b`, chains as `a ?? b ?? c` |
| Access | `user.name`, `user["name"]`, `items[0]`, `items[i + 1]` |
| Null-safe access | `user?.name`, `items?.[0]`, `name?.toUpperCase()` |
| Method calls | `name.toUpperCase()`, `items.indexOf(2)` |
| Functions | `lower(name)`, resolved only from the registry you pass in |

`==`/`!=` are strict (JS loose equality is a footgun). `?.` guards each step on its own, so chain it at every link that can be null: `a?.b?.c`. To keep the package tiny, xprsn leaves out string concatenation (`~`), `matches`, ranges (`..`), and bitwise operators.

### Multi-step expressions

Expressions have no local variables. When a calculation needs intermediate results, split it into named steps and feed each result back in as a variable for the next expression:

```js
const steps = [
  ['subtotal', 'price * qty'],
  ['discount', 'subtotal >= 100 ? subtotal * 0.1 : 0'],
  ['total', 'subtotal - discount + shipping'],
].map(([name, expr]) => [name, compile(expr)]);

function run(values) {
  const ctx = { ...values };
  for (const [name, fn] of steps) ctx[name] = fn(ctx);
  return ctx;
}

run({ price: 60, qty: 2, shipping: 5 });
// => { price: 60, qty: 2, shipping: 5, subtotal: 120, discount: 12, total: 113 }
```

Each step compiles once. The steps are plain data, so you can store them in a database or config file and let users edit the whole calculation.

## Content Security Policy

This package works under a strict CSP such as:

```
Content-Security-Policy: script-src 'self'
```

It needs no `unsafe-eval` because the compiler only composes arrow functions that already exist in the shipped source; it never turns expression text into JavaScript. The test suite runs under `node --disallow-code-generation-from-strings`, which throws on any string-to-code construct the same way a strict CSP does, and a test checks the source for such constructs. The library never touches the DOM, so you don't need a Trusted Types policy.

## Safety

Expressions can only read the data you pass in:

- Every property read (`a.b`, `a[b]`, method lookup, and bare variable names) goes through a guard that rejects `__proto__`, `constructor`, and `prototype`. This blocks the `x.constructor.constructor(...)` route to `Function`.
- Hash literals are built on null-prototype objects, so `{"__proto__": …}` is plain data and cannot pollute `Object.prototype`.
- `in` on objects checks own properties only; inherited properties are not visible.
- There are no assignment operators, so expressions cannot modify your data.
- Functions resolve from the registry you provide, at compile time.

Expressions can still call methods on the values you expose (`user.delete()`, say, if you pass such an object), so only pass data you are comfortable handing over.

## License

MIT © [Robin van der Vleuten](https://robinvdvleuten.nl)
