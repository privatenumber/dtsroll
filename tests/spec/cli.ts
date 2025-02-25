import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import nanoSpawn, { type SubprocessError } from 'nano-spawn';
import * as fixtures from '../fixtures';

const dtsrollPath = path.resolve('./dist/cli.mjs');

const dtsroll = (
	cwd: string,
	args: string[],
) => nanoSpawn(
	'node',
	[dtsrollPath, ...args],
	{
		cwd,
		env: {
			...process.env,
			NO_COLOR: '1',
		},
	},
).catch(error => error as SubprocessError);

export default testSuite(({ describe }) => {
	describe('cli', ({ describe, test }) => {
		describe('errors', ({ test }) => {
			test('No inputs', async () => {
				await using fixture = await createFixture({});

				const spawned = await dtsroll(fixture.path, []);
				expect('exitCode' in spawned && spawned.exitCode === 1).toBe(true);
				expect(spawned.stderr).toContain('No input files');
			});

			test('Non .d.ts file', async () => {
				await using fixture = await createFixture({});

				const spawned = await dtsroll(fixture.path, ['non-existent-file.ts']);
				expect('exitCode' in spawned && spawned.exitCode === 1).toBe(true);
				expect(spawned.stdout).toContain('Ignoring non-d.ts input');
			});

			test('Missing file', async () => {
				await using fixture = await createFixture({});

				const spawned = await dtsroll(fixture.path, ['non-existent-file.d.ts']);
				expect('exitCode' in spawned && spawned.exitCode === 1).toBe(true);
				expect(spawned.stdout).toContain('File not found');
			});

			test('Invalid input shouldnt fallback to package.json', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						types: 'dist/entry.d.ts',
					}),
				});

				const spawned = await dtsroll(fixture.path, ['non-existent-file.ts']);
				expect('exitCode' in spawned && spawned.exitCode === 1).toBe(true);
				expect(spawned.stdout).toContain('Ignoring non-d.ts input');
				expect(spawned.stderr).toContain('Error: No input files');
				expect(spawned.stdout).not.toContain('package.json');
			});

			test('Unresolvable file should error', async () => {
				const fixture = await createFixture(fixtures.brokenImport);

				const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
				expect('exitCode' in spawned && spawned.exitCode === 1).toBe(true);
				expect(spawned.stderr).toContain('Failed to build: Could not resolve "./missing-file" from "dist/entry.d.ts"');
			});
		});

		describe('cli', ({ test }) => {
			test('Single entry-point', async ({ onTestFail }) => {
				await using fixture = await createFixture(fixtures.singleEntryPoint);

				const spawned = await dtsroll(fixture.path, ['./dist/entry.d.ts']);
				onTestFail(() => console.log(spawned));
				expect('exitCode' in spawned).toBe(false);
				expect(spawned.output).not.toContain('External packages');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('type Foo = string');
				expect(entry).toContain('type Bar = number');
				expect(entry).toContain('type Baz = boolean');
			});

			test('Multiple entry-point', async ({ onTestFail }) => {
				const fixture = await createFixture(fixtures.multipleEntryPoints);

				const spawned = await dtsroll(fixture.path, [
					'./dist/index.d.ts',
					'./dist/some-dir/index.d.ts',
					'./dist/dir/mts.d.mts',
				]);
				onTestFail(() => console.log(spawned));
				expect('exitCode' in spawned).toBe(false);

				const indexContent = await fixture.readFile('dist/index.d.ts', 'utf8');
				expect(indexContent).toMatch(/import \{ F as Foo \} from '.\/_dtsroll-chunks\/.+-dts.js'/);

				const indexNestedContent = await fixture.readFile('dist/some-dir/index.d.ts', 'utf8');
				expect(indexNestedContent).toMatch(/import \{ F as Foo \} from '..\/_dtsroll-chunks\/.+-dts.js'/);

				const mtsContent = await fixture.readFile('dist/dir/mts.d.mts', 'utf8');
				expect(mtsContent).toContain('type Baz = boolean');

				const bundledModuleExists = await fixture.exists('dir/dts.d.ts');
				expect(bundledModuleExists).toBe(false);
			});

			test('dry run', async ({ onTestFail }) => {
				await using fixture = await createFixture(fixtures.multipleEntryPoints);

				const spawned = await dtsroll(fixture.path, ['./dist/index.d.ts', './dist/some-dir/index.d.ts', '-d']);
				onTestFail(() => console.log(spawned));
				expect('exitCode' in spawned).toBe(false);
				expect(spawned.output).toContain('Dry run');

				const indexContent = await fixture.readFile('dist/index.d.ts', 'utf8');
				expect(indexContent).toBe(fixtures.multipleEntryPoints.dist['index.d.ts']);

				const indexNestedContent = await fixture.readFile('dist/some-dir/index.d.ts', 'utf8');
				expect(indexNestedContent).toBe(fixtures.multipleEntryPoints.dist['some-dir/index.d.ts']);
			});
		});

		describe('package.json', ({ describe, test }) => {
			describe('types', ({ test }) => {
				test('Single entry-point', async () => {
					await using fixture = await createFixture({
						...fixtures.singleEntryPoint,
						'package.json': JSON.stringify({
							types: 'dist/entry.d.ts',
						}),
					});

					const spawned = await dtsroll(fixture.path, []);
					expect('exitCode' in spawned).toBe(false);

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).toContain('type Foo = string');
				});
			});

			describe('typings', ({ test }) => {
				test('Single entry-point', async () => {
					await using fixture = await createFixture({
						...fixtures.singleEntryPoint,
						'package.json': JSON.stringify({
							typings: 'dist/entry.d.ts',
						}),
					});

					const spawned = await dtsroll(fixture.path, []);
					expect('exitCode' in spawned).toBe(false);

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).toContain('type Foo = string');
				});
			});

			describe('exports', ({ test }) => {
				test('Single entry-point', async () => {
					await using fixture = await createFixture({
						...fixtures.singleEntryPoint,
						'package.json': JSON.stringify({
							exports: './dist/entry.d.ts',
						}),
					});

					const spawned = await dtsroll(fixture.path, []);
					expect('exitCode' in spawned).toBe(false);

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).toContain('type Foo = string');
				});

				test('Multiple entry-point', async ({ onTestFail }) => {
					await using fixture = await createFixture({
						...fixtures.multipleEntryPoints,
						'package.json': JSON.stringify({
							exports: {
								'./index': {
									types: './dist/index.d.ts',
								},
								'./some-dir/index': {
									types: './dist/some-dir/index.d.ts',
									default: './dist/ignore-me.ts',
								},
								'./star/*': {
									types: './dist/star/*',
									default: './dist/star/*.ts',
								},
							},
						}),
					});

					const spawned = await dtsroll(fixture.path, []);
					onTestFail(() => console.log(spawned));
					expect('exitCode' in spawned).toBe(false);

					const indexContent = await fixture.readFile('dist/index.d.ts', 'utf8');

					const chunkNamePattern = /import \{ F as Foo \} from '.\/(_dtsroll-chunks\/.+-dts.js)'/;
					const chunkNameMatch = indexContent.match(chunkNamePattern);
					expect(chunkNameMatch).toBeTruthy();

					const chunkImportPath = chunkNameMatch![1];

					const indexNestedContent = await fixture.readFile('dist/some-dir/index.d.ts', 'utf8');
					expect(indexNestedContent).toContain(`import { F as Foo } from '../${chunkImportPath}'`);

					const bundledModuleExists = await fixture.exists('dir/dts.d.ts');
					expect(bundledModuleExists).toBe(false);

					const chunkExists = await fixture.exists(`dist/${chunkImportPath!.replace('.js', '.d.ts')}`);
					expect(chunkExists).toBe(true);

					const starAContent = await fixture.readFile('dist/star/a.d.ts', 'utf8');
					expect(starAContent).toContain('declare const a: string');

					const starBContent = await fixture.readFile('dist/star/b.d.ts', 'utf8');
					expect(starBContent).toContain('declare const b: string');

					const starCContent = await fixture.readFile('dist/star/c.d.ts', 'utf8');
					expect(starCContent).toContain('declare const c: string');
				});
			});

			test('dry run', async ({ onTestFail }) => {
				await using fixture = await createFixture({
					...fixtures.singleEntryPoint,
					'package.json': JSON.stringify({
						exports: './dist/entry.d.ts',
					}),
				});

				const spawned = await dtsroll(fixture.path, ['-d']);
				onTestFail(() => console.log(spawned));
				expect('exitCode' in spawned).toBe(false);

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toBe(fixtures.singleEntryPoint.dist['entry.d.ts']);
			});
		});

		describe('Dependencies', ({ describe, test }) => {
			test('Node builtins are externalized', async () => {
				await using fixture = await createFixture(fixtures.externalsNodeBuiltins);

				const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
				expect(spawned.stderr).toBe('');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('from \'node:path\'');
			});

			test('Unresolvable dependencies are externalized', async () => {
				await using fixture = await createFixture(fixtures.externalsMissingDep);

				const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
				expect(spawned.stdout).toContain('─ some-dep externalized because unresolvable');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('from \'some-dep\'');
			});

			test('Bundles dependency', async () => {
				await using fixture = await createFixture(fixtures.dependency);

				const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
				expect(spawned.stdout).toContain('some-pkg (');
				expect(spawned.stdout).toContain('node_modules/some-pkg/dist/index.d.ts)');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('A = string');
			});

			test('Externalizes dependency via package.json', async () => {
				await using fixture = await createFixture({
					...fixtures.dependency,
					'package.json': JSON.stringify({
						dependencies: {
							'some-pkg': '*',
						},
					}),
				});

				const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
				expect(spawned.stdout).toContain('─ some-pkg externalized by package.json dependencies');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('\'some-pkg\'');
			});

			test('--external flag', async () => {
				await using fixture = await createFixture(fixtures.dependency);

				const spawned = await dtsroll(fixture.path, ['--external', 'some-pkg', 'dist/entry.d.ts']);
				expect(spawned.stdout).toContain('─ some-pkg externalized by --external flag');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('\'some-pkg\'');
			});

			test('--external flag ignored if theres a package.json', async () => {
				await using fixture = await createFixture({
					...fixtures.dependency,
					'package.json': JSON.stringify({}),
				});

				const spawned = await dtsroll(fixture.path, ['--external', 'some-pkg', 'dist/entry.d.ts']);
				expect(spawned.stderr).toContain('The --external flag is only supported when there is no package.json');

				const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
				expect(entry).toContain('A = string');
			});

			describe('Externalizes @types', ({ test }) => {
				test('Warning', async () => {
					await using fixture = await createFixture({
						...fixtures.dependencyWithAtType,
						'package.json': JSON.stringify({
							dependencies: {
								'some-pkg': '*',
							},
							devDependencies: {
								'@types/some-pkg': '*',
							},
						}),
					});

					const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
					expect(spawned.stdout).toContain('Warning: @types/some-pkg should not be in devDependencies if some-pkg is externalized');

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).toContain('\'some-pkg\'');
				});

				test('No warning if externalized', async () => {
					await using fixture = await createFixture({
						...fixtures.dependencyWithAtType,
						'package.json': JSON.stringify({
							dependencies: {
								'some-pkg': '*',
								'@types/some-pkg': '*',
							},
						}),
					});

					const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
					expect(spawned.stderr).toBe('');

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).toContain('\'some-pkg\'');
				});

				test('No warning if private package', async () => {
					await using fixture = await createFixture({
						...fixtures.dependencyWithAtType,
						'package.json': JSON.stringify({
							private: true,
							dependencies: {
								'some-pkg': '*',
							},
							devDependencies: {
								'@types/some-pkg': '*',
							},
						}),
					});

					const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
					expect(spawned.stderr).toBe('');

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).toContain('\'some-pkg\'');
				});

				test('No warning if dependency is not used', async () => {
					await using fixture = await createFixture({
						...fixtures.dependencyWithAtType,
						'package.json': JSON.stringify({
							dependencies: {
								'some-pkg': '*',
							},
							devDependencies: {
								'@types/some-pkg': '*',
							},
						}),
						'dist/entry.d.ts': 'export type A = string;',
					});

					const spawned = await dtsroll(fixture.path, ['dist/entry.d.ts']);
					expect(spawned.stderr).toBe('');

					const entry = await fixture.readFile('dist/entry.d.ts', 'utf8');
					expect(entry).not.toContain('\'some-pkg\'');
				});
			});
		});

		test('Chunk names dont collide', async ({ onTestFail }) => {
			await using fixture = await createFixture({
				...fixtures.multipleEntryPointsSameChunkName,
				'package.json': JSON.stringify({
					exports: {
						'./aa': './dist/aa.d.ts',
						'./ab': './dist/ab.d.ts',
						'./ba': './dist/ba.d.ts',
						'./bb': './dist/bb.d.ts',
					},
				}),
			});

			const spawned = await dtsroll(fixture.path, []);
			onTestFail(() => console.log(spawned));
			expect('exitCode' in spawned).toBe(false);

			const chunks = await fs.readdir(fixture.getPath('dist/_dtsroll-chunks'));
			expect(chunks.length).toBe(2);

			// Previously, it would create .d2.ts, .d3.ts, .d4.ts, when they would collide
			expect(chunks.every(file => file.endsWith('.d.ts'))).toBeTruthy();
		});
	});
});
