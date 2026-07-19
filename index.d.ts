/**
 * Hand-written declarations — microbundle type generation is disabled.
 *
 * `Names<S>` extracts an expression's free variables at the type level,
 * mirroring the runtime `names` computation: string literals are skipped,
 * keywords, numbers, properties, and function calls are excluded. Values
 * keys are all optional (missing data is the `??` idiom), but a typo'd key
 * in an object literal fails TypeScript's excess-property check. Dynamic
 * (non-literal) expression strings degrade to `Record<string, any>`.
 */

type L = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
	| 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type D = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type IdChar = L | Uppercase<L> | D | '_' | '$' | '@';
type WS = ' ' | '\t' | '\n' | '\r';
type Keyword = 'and' | 'or' | 'not' | 'in' | 'true' | 'false' | 'null';

// Finish the word W: drop empties, properties (after `.`), keywords,
// numbers, and function names (next char is `(`).
type Add<W extends string, Dot extends boolean, Next extends string, Acc extends string> =
	W extends '' ? Acc
	: Dot extends true ? Acc
	: W extends Keyword ? Acc
	: W extends `${D}${string}` ? Acc
	: Next extends '(' ? Acc
	: Acc | W;

// Skip a quoted string literal (escaped quotes are not modeled).
type SkipD<S extends string, Acc extends string> =
	S extends `${string}"${infer R}` ? Scan<R, '', false, Acc> : Acc;
type SkipS<S extends string, Acc extends string> =
	S extends `${string}'${infer R}` ? Scan<R, '', false, Acc> : Acc;

// Char-by-char scan carrying the current word and an "after a dot" flag.
// Whitespace preserves the flag only while no word has followed the dot,
// so `a . b` treats b as a property but `a.b c` frees c again.
type Scan<S extends string, W extends string = '', Dot extends boolean = false, Acc extends string = never> =
	S extends `${infer C}${infer R}`
		? C extends IdChar ? Scan<R, `${W}${C}`, Dot, Acc>
		: C extends '"' ? SkipD<R, Add<W, Dot, C, Acc>>
		: C extends "'" ? SkipS<R, Add<W, Dot, C, Acc>>
		: Scan<R, '', C extends '.' ? true : C extends WS ? (W extends '' ? Dot : false) : false, Add<W, Dot, C, Acc>>
		: Add<W, Dot, '', Acc>;

/** The free root variables of expression `S`, as a union of string literals. */
export type Names<S extends string> = string extends S ? string : Scan<S>;

type Values<S extends string> =
	string extends S ? Record<string, any> : { [K in Names<S>]?: any };

type NamesArray<S extends string> =
	string extends S ? string[] : [Names<S>] extends [never] ? [] : Names<S>[];

/**
 * Compile an expression once, evaluate it many times.
 *
 * The returned evaluator exposes `names`: the free variables the expression
 * reads, deduplicated. Function names, property names, and hash keys are not
 * included.
 *
 * @param src The expression, e.g. `'user.age > 18 and "admin" in user.roles'`.
 * @param funcs Functions callable from the expression.
 * @throws {SyntaxError} On malformed input or unknown function names.
 */
export function compile<S extends string>(
	src: S,
	funcs?: Record<string, (...args: any[]) => any>
): { (values?: Values<S>): any; names: NamesArray<S> };

/**
 * Compile and evaluate an expression in one go.
 *
 * @param src The expression to evaluate.
 * @param values Variables available to the expression.
 * @param funcs Functions callable from the expression.
 */
export function evaluate<S extends string>(
	src: S,
	values?: Values<S>,
	funcs?: Record<string, (...args: any[]) => any>
): any;
