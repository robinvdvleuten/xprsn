/**
 * Compile an expression once, evaluate it many times.
 *
 * The returned evaluator exposes `names`: the free variables the expression
 * reads, deduplicated. Function names, property names, and hash keys are not
 * included.
 *
 * @param {string} src The expression, e.g. `'user.age > 18 and "admin" in user.roles'`.
 * @param {Record<string, Function>} [funcs] Functions callable from the expression.
 * @returns {{(values?: Record<string, any>): any, names: string[]}} Evaluator for the compiled expression.
 * @throws {SyntaxError} On malformed input or unknown function names.
 */
export function compile(src: string, funcs?: Record<string, Function>): {
    (values?: Record<string, any>): any;
    names: string[];
};
/**
 * Compile and evaluate an expression in one go.
 *
 * @param {string} src The expression to evaluate.
 * @param {Record<string, any>} [values] Variables available to the expression.
 * @param {Record<string, Function>} [funcs] Functions callable from the expression.
 * @returns {any} The expression result.
 */
export function evaluate(src: string, values?: Record<string, any>, funcs?: Record<string, Function>): any;
