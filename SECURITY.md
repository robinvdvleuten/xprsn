# Security Policy

## Security considerations

Do not treat xprsn as a sandbox. It compiles expressions to closures and generates no JavaScript source. It rejects reads of `__proto__`, `constructor`, and `prototype`, which blocks known routes to the `Function` constructor. These constraints make xprsn CSP-safe.

Anyone who controls an expression can read data reachable from the values you provide. The `names` property lists root variables but omits property names, so you cannot use it as a permission check.

Anyone who controls an expression can call registered functions and methods on those values. Such calls may perform I/O, change application state, expose more data, or consume excessive CPU. xprsn runs them in the current process without a timeout.

Before you accept untrusted expressions:

- Build a values object for the expression. Keep secrets out of its object graph.
- Register pure functions with no access to privileged APIs such as the network, filesystem, or processes.
- Pass a copy of your values, or freeze the whole object graph, if methods must not change application state.
- Set a maximum expression length. For an execution deadline, use a worker or separate process that you can terminate.
- Escape the result for its destination.

Treat expressions as code. Keep user input out of expression syntax and pass it through the values object.

## Reporting a vulnerability

Do not open a public GitHub issue for a security vulnerability.

Use [GitHub's private vulnerability form](https://github.com/robinvdvleuten/xprsn/security/advisories/new).

Include the affected code, its impact, and steps that reproduce the issue. Tell us whether and how to credit you.

We do not accept AI slop reports.

Keep the report private while we investigate and prepare a fix.
