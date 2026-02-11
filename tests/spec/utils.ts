import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { getCommonDirectory } from '../../src/utils/get-common-directory.js';
import { propertyNeedsQuotes } from '../../src/utils/property-needs-quotes.js';
import { getPackageJson } from '../../src/utils/package-json.js';
import { getAllFiles } from '../../src/utils/get-all-files.js';

describe('utils', () => {
	describe('getCommonDirectory', () => {
		test('single file returns its directory', () => {
			const result = getCommonDirectory([path.join('foo', 'bar', 'file.ts')]);
			expect(result).toBe(path.join('foo', 'bar'));
		});

		test('files in same directory', () => {
			const result = getCommonDirectory([
				path.join('foo', 'bar', 'a.ts'),
				path.join('foo', 'bar', 'b.ts'),
			]);
			expect(result).toBe(path.join('foo', 'bar'));
		});

		test('files in nested directories', () => {
			const result = getCommonDirectory([
				path.join('foo', 'bar', 'a.ts'),
				path.join('foo', 'bar', 'baz', 'b.ts'),
			]);
			expect(result).toBe(path.join('foo', 'bar'));
		});

		test('files with different roots', () => {
			const result = getCommonDirectory([
				path.join('foo', 'bar', 'a.ts'),
				path.join('foo', 'baz', 'b.ts'),
			]);
			expect(result).toBe('foo');
		});

		test('files with no common directory', () => {
			const result = getCommonDirectory([
				path.join('foo', 'a.ts'),
				path.join('bar', 'b.ts'),
			]);
			expect(result).toBe('');
		});

		test('deeply nested common path', () => {
			const result = getCommonDirectory([
				path.join('a', 'b', 'c', 'd', 'e', 'f.ts'),
				path.join('a', 'b', 'c', 'd', 'e', 'g.ts'),
				path.join('a', 'b', 'c', 'd', 'e', 'h', 'i.ts'),
			]);
			expect(result).toBe(path.join('a', 'b', 'c', 'd', 'e'));
		});
	});

	describe('getAllFiles', () => {
		test('returns all files in directory tree', async () => {
			await using fixture = await createFixture({
				'a.txt': 'file a',
				'subdir/b.txt': 'file b',
				'subdir/nested/c.txt': 'file c',
			});

			const files = await getAllFiles(fixture.path);

			expect(files).toContain('./a.txt');
			expect(files).toContain('./subdir/b.txt');
			expect(files).toContain('./subdir/nested/c.txt');
		});

		test('skips symlinks (does not follow them)', async () => {
			await using fixture = await createFixture({
				'a.txt': 'file a',
				'realdir/b.txt': 'file b',
			});

			// Create symlink to directory
			await fs.symlink(
				path.join(fixture.path, 'realdir'),
				path.join(fixture.path, 'linkdir'),
			);

			const files = await getAllFiles(fixture.path);

			// Should find real files
			expect(files).toContain('./a.txt');
			expect(files).toContain('./realdir/b.txt');
			// Should NOT follow symlink (symlinks are skipped)
			expect(files).not.toContain('./linkdir/b.txt');
		});
	});

	describe('propertyNeedsQuotes', () => {
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

	describe('getPackageJson', () => {
		test('returns undefined if no package.json', async () => {
			await using fixture = await createFixture({});
			const result = await getPackageJson(fixture.path);
			expect(result).toBe(undefined);
		});

		test('throws error for malformed JSON', async () => {
			await using fixture = await createFixture({
				'package.json': '{ invalid json }',
			});
			await expect(getPackageJson(fixture.path)).rejects.toThrow('Failed to parse package.json');
		});

		describe('getDtsEntryPoints', () => {
			test('reads types field', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({ types: './dist/index.d.ts' }),
					'dist/index.d.ts': 'export type A = 1;',
				});
				const pkg = await getPackageJson(fixture.path);
				const entries = await pkg!.getDtsEntryPoints();
				expect(Object.keys(entries)).toHaveLength(1);
				expect(entries[path.join(fixture.path, 'dist/index.d.ts')]).toBe('types');
			});

			test('reads typings field', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({ typings: './dist/index.d.ts' }),
					'dist/index.d.ts': 'export type A = 1;',
				});
				const pkg = await getPackageJson(fixture.path);
				const entries = await pkg!.getDtsEntryPoints();
				expect(Object.keys(entries)).toHaveLength(1);
				expect(entries[path.join(fixture.path, 'dist/index.d.ts')]).toBe('typings');
			});

			test('reads exports with types condition', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						exports: {
							'.': {
								types: './dist/index.d.ts',
								default: './dist/index.js',
							},
						},
					}),
					'dist/index.d.ts': 'export type A = 1;',
				});
				const pkg = await getPackageJson(fixture.path);
				const entries = await pkg!.getDtsEntryPoints();
				expect(Object.keys(entries)).toHaveLength(1);
				expect(entries[path.join(fixture.path, 'dist/index.d.ts')]).toBe('exports["."].types');
			});

			test('ignores non-.d.ts files', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						types: './dist/index.d.ts',
						main: './dist/index.js',
					}),
					'dist/index.d.ts': 'export type A = 1;',
					'dist/index.js': 'export const a = 1;',
				});
				const pkg = await getPackageJson(fixture.path);
				const entries = await pkg!.getDtsEntryPoints();
				expect(Object.keys(entries)).toHaveLength(1);
			});

			test('handles wildcard exports', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						exports: {
							'./*': {
								types: './dist/*.d.ts',
							},
						},
					}),
					'dist/a.d.ts': 'export type A = 1;',
					'dist/b.d.ts': 'export type B = 2;',
					'dist/nested/c.d.ts': 'export type C = 3;',
				});
				const pkg = await getPackageJson(fixture.path);
				const entries = await pkg!.getDtsEntryPoints();
				// Wildcard matches all files with prefix/suffix, including nested
				expect(Object.keys(entries)).toHaveLength(3);
			});

			test('handles multiple export subpaths', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						exports: {
							'.': { types: './dist/index.d.ts' },
							'./utils': { types: './dist/utils.d.ts' },
						},
					}),
					'dist/index.d.ts': 'export type A = 1;',
					'dist/utils.d.ts': 'export type B = 2;',
				});
				const pkg = await getPackageJson(fixture.path);
				const entries = await pkg!.getDtsEntryPoints();
				expect(Object.keys(entries)).toHaveLength(2);
			});
		});

		describe('getExternals', () => {
			test('externalizes dependencies', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						dependencies: { lodash: '^4.0.0' },
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				const externals = pkg!.getExternals();
				expect(externals.has('lodash')).toBe(true);
				expect(externals.get('lodash')).toContain('dependencies');
			});

			test('externalizes peerDependencies', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						peerDependencies: { react: '^18.0.0' },
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				const externals = pkg!.getExternals();
				expect(externals.has('react')).toBe(true);
				expect(externals.get('react')).toContain('peerDependencies');
			});

			test('externalizes optionalDependencies', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						optionalDependencies: { fsevents: '^2.0.0' },
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				const externals = pkg!.getExternals();
				expect(externals.has('fsevents')).toBe(true);
				expect(externals.get('fsevents')).toContain('optionalDependencies');
			});

			test('does not externalize devDependencies', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						devDependencies: { typescript: '^5.0.0' },
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				const externals = pkg!.getExternals();
				expect(externals.has('typescript')).toBe(false);
			});
		});

		describe('devTypePackages', () => {
			test('maps @types packages to original', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						devDependencies: {
							'@types/node': '^20.0.0',
							'@types/lodash': '^4.0.0',
						},
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				expect(pkg!.devTypePackages).toEqual({
					node: '@types/node',
					lodash: '@types/lodash',
				});
			});

			test('empty for private packages', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						private: true,
						devDependencies: {
							'@types/node': '^20.0.0',
						},
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				expect(pkg!.devTypePackages).toEqual({});
			});

			test('empty when no @types in devDependencies', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						devDependencies: {
							typescript: '^5.0.0',
						},
					}),
				});
				const pkg = await getPackageJson(fixture.path);
				expect(pkg!.devTypePackages).toEqual({});
			});
		});
	});
});
