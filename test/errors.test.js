import test from 'tape';
import { compile, evaluate } from '../src/index.js';

test('syntax errors', t => {
	t.throws(() => compile(''), /Unexpected end of expression/);
	t.throws(() => compile('1 +'), /Unexpected end of expression/);
	t.throws(() => compile('(1 + 2'), /Unexpected end of expression/);
	t.throws(() => compile('1 + 2)'), /Unexpected \)/, 'trailing tokens rejected');
	t.throws(() => compile('[1, 2'), SyntaxError);
	t.throws(() => compile('{a 1}'), SyntaxError, 'missing colon');
	t.throws(() => compile('a.'), SyntaxError);
	t.throws(() => compile('a.1'), SyntaxError, 'property names must be identifiers');
	t.throws(() => compile('1 ? 2'), SyntaxError, 'unterminated ternary');
	t.throws(() => compile('a ??'), /Unexpected end of expression/);
	t.throws(() => compile('a?.'), SyntaxError);
	t.throws(() => compile('a?.[1'), SyntaxError);
	t.throws(() => compile('#'), /Unexpected #/, '# is not an identifier char');
	t.throws(() => compile("'abc"), SyntaxError, 'unterminated single-quoted string');
	t.throws(() => compile('"abc'), SyntaxError, 'unterminated double-quoted string');
	t.throws(() => compile(String.raw`'\x41'`), SyntaxError, 'non-JSON escape');
	t.end();
});

test('unknown functions fail at compile time', t => {
	t.throws(() => compile('nope(1)'), /nope is not a function/);
	t.doesNotThrow(() => compile('nope(1)', { nope: x => x }));
	t.end();
});

test('errors are real SyntaxErrors', t => {
	try {
		compile('1 +');
		t.fail('should have thrown');
	} catch (e) {
		t.ok(e instanceof SyntaxError);
	}
	t.end();
});

test('non-string input is coerced', t => {
	t.equal(evaluate(42), 42, 'numbers stringify fine');
	t.end();
});

test('deeply nested input throws SyntaxError, not RangeError', t => {
	const deep = '('.repeat(50000) + '1' + ')'.repeat(50000);
	try {
		compile(deep);
		t.fail('should have thrown');
	} catch (e) {
		t.ok(e instanceof SyntaxError, 'stack overflow surfaces as SyntaxError');
		t.notOk(e instanceof RangeError, 'not a raw RangeError');
	}
	t.end();
});
