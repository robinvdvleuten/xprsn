# xprsn

A tiny, CSP-safe expression language for JavaScript. **~1.2KB min+gzip, zero dependencies.**

[![NPM version](https://img.shields.io/npm/v/xprsn.svg)](https://www.npmjs.com/package/xprsn)
[![Build Status](https://github.com/robinvdvleuten/xprsn/actions/workflows/test.yml/badge.svg)](https://github.com/robinvdvleuten/xprsn/actions/workflows/test.yml)
[![NPM downloads](https://img.shields.io/npm/dm/xprsn.svg)](https://www.npmjs.com/package/xprsn)
[![MIT license](https://img.shields.io/github/license/robinvdvleuten/xprsn.svg)](https://github.com/robinvdvleuten/xprsn/blob/main/LICENSE)

<a href="https://webstronauts.com?utm_source=github&utm_medium=readme&utm_campaign=xprsn">
	<picture>
		<img src="https://webstronauts.com/images/sponsored-by.svg" alt="Sponsored by The Webstronauts" width="200" height="65">
	</picture>
</a>

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

Pretty far. The same trick, a one-regex tokenizer feeding a parser that emits closures, carries into two sibling packages:

- [sjabloon](https://github.com/robinvdvleuten/sjabloon) is a full template engine built directly on xprsn: `{{ expr }}` interpolation with HTML escaping, `{{#if}}`/`{{#elif}}` and `{{#each}}` blocks, and any xprsn expression inside every tag. About 1KB on top of this package.
- [padvinder](https://github.com/robinvdvleuten/padvinder) is a JSONPath engine that started here and grew its own parser. Filter evaluation is the part of JSONPath that has produced real code-injection CVEs elsewhere; padvinder parses filters to closures with no route to code execution, and now passes the full RFC 9535 compliance suite as a standalone, zero-dependency package.

## API

### `compile(expression, functions?)`

Parses the expression and returns an evaluator function `(values?) => result`. Throws a `SyntaxError` on malformed input or unknown function names, so a bad expression fails at compile time rather than during evaluation.

The evaluator also carries `names`: the variables the expression reads, deduplicated. Property names, hash keys, and registry functions don't count; only the roots do.

```js
const fn = compile('user.age > 18 and (discount ?? 0) > 0');
fn.names; // => ['user', 'discount']
```

That one array covers a lot of ground when expressions come from your users: validate a rule against your schema before saving it (`fn.names.every(n => n in schema)`), drive autocomplete in a rule editor, or find which stored rules read a field you're about to rename. It also pairs with the multi-step pattern below, where each step's `names` are its dependencies.

The evaluator also exposes `functions`: the registry functions the expression calls (methods like `s.trim()` are not counted).

```js
const fn = compile('sum(price) > budget', { sum: xs => xs.reduce((a, b) => a + b, 0) });
fn.functions; // => ['sum']
```

Unknown functions already throw at compile time, so this is for introspection rather than safety: check a stored expression against the functions available in its context before running it, for example rejecting an aggregate like `sum(...)` where no row group is in scope.

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
| Concatenation | `"id-" ~ n` (string concat; coerces both sides) |
| Comparison | `==` `!=` `<` `>` `<=` `>=` (strict: `1 == "1"` is `false`) |
| Logical | `and` `&&` `or` `\|\|` `not` `!` (with short-circuiting) |
| Membership | `"admin" in roles` (arrays: `includes`; strings: substring; objects: own keys only) |
| Ternary | `a ? b : c`, and the `a ?: b` shorthand |
| Null coalescing | `a ?? b`, chains as `a ?? b ?? c` |
| Access | `user.name`, `user["name"]`, `items[0]`, `items[i + 1]` |
| Null-safe access | `user?.name`, `items?.[0]`, `name?.toUpperCase()` |
| Method calls | `name.toUpperCase()`, `items.indexOf(2)` |
| Functions | `lower(name)`, resolved only from the registry you pass in |
| Identifiers | letters, digits, `_`, and `$` / `@` (e.g. `$price`, `@.total`) |

`==`/`!=` are strict (JS loose equality is a footgun). `~` joins its sides as strings (`1 ~ 2` is `"12"`) and binds looser than arithmetic but tighter than comparison, so `"total: " ~ a + b` joins the sum. Absence reads as `null`: an unknown variable or a missing property is `null` (not `undefined`), so `x == null` is the natural "is it there?" test; present `null`/`0`/`false`/`""` are untouched, and registry function return values are left as-is. Reading _through_ a null base still throws, so use `?.` for that — `a?.b` yields `null` on a nullish base and guards each step on its own, so chain it at every link that can be null: `a?.b?.c`. To keep the package tiny, xprsn leaves out `matches`, ranges (`..`), and bitwise operators.

`$` and `@` are ordinary identifier characters, so a variable can be named `$` or `@` (they still read through the same prototype guard). On their own they buy little, since xprsn reads from one flat values object. They pay off once a host stacks nested scopes.

[sjabloon](https://github.com/robinvdvleuten/sjabloon), the template engine built on xprsn, is the concrete case. It layers a fresh child scope on every `{{#each}}` iteration with `Object.create`, so a loop variable and the surrounding variables coexist and an inner name shadows an outer one of the same name. In that setting a plain name always resolves to the nearest scope. Binding `$` and `@` gives an expression a fixed handle on a chosen level instead: set `@` to the current item and `$` to the root, and `@.price * $.taxRate` says exactly which scope each name comes from.

```js
evaluate('@.price * $.taxRate', { '@': { price: 20 }, '$': { taxRate: 1.21 } });
// => 24.2
```

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
