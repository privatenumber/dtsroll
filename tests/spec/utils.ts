import path from 'node:path';
import { expect, testSuite } from 'manten';
import { getCommonDirectory } from '../../src/utils/get-common-directory.js';
import { propertyNeedsQuotes } from '../../src/utils/property-needs-quotes.js';

export default testSuite(({ describe }) => {
	describe('utils', ({ describe }) => {
		describe('getCommonDirectory', ({ test }) => {
			test('single file returns its directory', () => {
				const result = getCommonDirectory(['/foo/bar/file.ts']);
				expect(result).toBe(`${path.sep}foo${path.sep}bar`);
			});

			test('files in same directory', () => {
				const result = getCommonDirectory([
					'/foo/bar/a.ts',
					'/foo/bar/b.ts',
				]);
				expect(result).toBe(`${path.sep}foo${path.sep}bar`);
			});

			test('files in nested directories', () => {
				const result = getCommonDirectory([
					'/foo/bar/a.ts',
					'/foo/bar/baz/b.ts',
				]);
				expect(result).toBe(`${path.sep}foo${path.sep}bar`);
			});

			test('files with different roots', () => {
				const result = getCommonDirectory([
					'/foo/bar/a.ts',
					'/foo/baz/b.ts',
				]);
				expect(result).toBe(`${path.sep}foo`);
			});

			test('files with no common directory', () => {
				const result = getCommonDirectory([
					'/foo/a.ts',
					'/bar/b.ts',
				]);
				expect(result).toBe('');
			});

			test('deeply nested common path', () => {
				const result = getCommonDirectory([
					'/a/b/c/d/e/f.ts',
					'/a/b/c/d/e/g.ts',
					'/a/b/c/d/e/h/i.ts',
				]);
				expect(result).toBe(`${path.sep}a${path.sep}b${path.sep}c${path.sep}d${path.sep}e`);
			});
		});

		describe('propertyNeedsQuotes', ({ test }) => {
			test('valid identifiers do not need quotes', () => {
				expect(propertyNeedsQuotes('foo')).toBe(false);
				expect(propertyNeedsQuotes('_private')).toBe(false);
				expect(propertyNeedsQuotes('$dollar')).toBe(false);
				expect(propertyNeedsQuotes('camelCase')).toBe(false);
				expect(propertyNeedsQuotes('PascalCase')).toBe(false);
				expect(propertyNeedsQuotes('with123')).toBe(false);
			});

			test('reserved words need quotes', () => {
				expect(propertyNeedsQuotes('class')).toBe(true);
				expect(propertyNeedsQuotes('function')).toBe(true);
				expect(propertyNeedsQuotes('return')).toBe(true);
				expect(propertyNeedsQuotes('if')).toBe(true);
				expect(propertyNeedsQuotes('for')).toBe(true);
				expect(propertyNeedsQuotes('while')).toBe(true);
				expect(propertyNeedsQuotes('delete')).toBe(true);
				expect(propertyNeedsQuotes('instanceof')).toBe(true);
			});

			test('properties starting with numbers need quotes', () => {
				expect(propertyNeedsQuotes('123')).toBe(true);
				expect(propertyNeedsQuotes('1foo')).toBe(true);
			});

			test('properties with special characters need quotes', () => {
				expect(propertyNeedsQuotes('foo-bar')).toBe(true);
				expect(propertyNeedsQuotes('foo.bar')).toBe(true);
				expect(propertyNeedsQuotes('foo bar')).toBe(true);
				expect(propertyNeedsQuotes('foo/bar')).toBe(true);
				expect(propertyNeedsQuotes('@scope/pkg')).toBe(true);
			});

			test('empty string needs quotes', () => {
				expect(propertyNeedsQuotes('')).toBe(true);
			});

			test('unicode identifiers do not need quotes', () => {
				expect(propertyNeedsQuotes('café')).toBe(false);
				expect(propertyNeedsQuotes('日本語')).toBe(false);
				expect(propertyNeedsQuotes('über')).toBe(false);
			});
		});
	});
});
