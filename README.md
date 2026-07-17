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

## API

### `compile(expression, functions?)`

Parses the expression and returns an evaluator function `(values?) => result`. Throws a `SyntaxError` on malformed input or unknown function names, so a bad expression fails at compile time rather than during evaluation.

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
| Access | `user.name`, `user["name"]`, `items[0]`, `items[i + 1]` |
| Method calls | `name.toUpperCase()`, `items.indexOf(2)` |
| Functions | `lower(name)`, resolved only from the registry you pass in |

`==`/`!=` are strict (JS loose equality is a footgun). To keep the package tiny, xprsn leaves out string concatenation (`~`), `matches`, ranges (`..`), bitwise operators, and null-safe `?.`.

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
