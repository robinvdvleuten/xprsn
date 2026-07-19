/**
 * Hand-written declarations — microbundle type generation is disabled.
 */

type Fn = (...args: any[]) => any;

/**
 * Compile an expression once, evaluate it many times.
 *
 * The returned evaluator exposes `names` (the free variables the expression
 * reads) and `functions` (the registry functions it calls), both deduplicated.
 * Property names, hash keys, and method names are not included. Unknown
 * variables evaluate to `undefined`; validate them yourself via `names`.
 *
 * @param src The expression, e.g. `'user.age > 18 and "admin" in user.roles'`.
 * @param funcs Functions callable from the expression.
 * @throws {SyntaxError} On malformed input or unknown function names.
 */
export function compile(
	src: string,
	funcs?: Record<string, Fn>
): { (values?: Record<string, any>): any; names: string[]; functions: string[] };

/**
 * Compile and evaluate an expression in one go.
 *
 * @param src The expression to evaluate.
 * @param values Variables available to the expression.
 * @param funcs Functions callable from the expression.
 */
export function evaluate(
	src: string,
	values?: Record<string, any>,
	funcs?: Record<string, Fn>
): any;
