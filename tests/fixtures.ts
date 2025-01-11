import outdent from 'outdent';

const dtsFiles = {
	'dts.d.ts': outdent`
	export type Foo = string;
	`,
	'cts.d.cts': outdent`
	export type Bar = number;
	`,
	'mts.d.mts': outdent`
	export type Baz = boolean;
	`,
};

export const brokenImport = {
	dist: {
		'entry.d.ts': outdent`
		import { Foo } from './missing-file';
		export declare const value: Foo;
		`,
		...dtsFiles,
	},
};

export const singleEntryPoint = {
	dist: {
		'entry.d.ts': outdent`
		import { Foo } from './dts';
		import { Bar } from './cts';
		import { Baz } from './mts';
		export declare const value: Foo | Bar | Baz;
		`,
		...dtsFiles,
	},
};

export const multipleEntryPoints = {
	dist: {
		'ignore-me.ts': outdent`
		// This file should be ignored
		some random invalid syntax
		`,

		'index.d.ts': outdent`
		import { Foo } from './dir/dts';
		import { Baz } from './dir/mts';
		export declare const valueA: Foo | Baz;
		`,
		'some-dir/index.d.ts': outdent`
		import { Foo } from '../dir/dts';
		import { Bar } from '../dir/cts';
		export declare const valueB: Foo | Bar;
		`,
		dir: dtsFiles,
	},
};

export const externalsNodeBuiltins = {
	dist: {
		'entry.d.ts': outdent`
		import type { ParsedPath } from 'node:path';
		export declare const parsePath: (path: string) => ParsedPath;
		`,
	},
};

export const externalsMissingDep = {
	dist: {
		'entry.d.ts': outdent`
		import type { ParsedPath } from 'some-dep';
		export declare const parsePath: (path: string) => ParsedPath;
		`,
	},
};

export const dependency = {
	'node_modules/some-pkg': {
		'package.json': JSON.stringify({
			types: 'dist/index.d.ts',
		}),
		'dist/index.d.ts': outdent`
		export type A = string;
		`,
	},
	dist: {
		'entry.d.ts': outdent`
		import type { A } from 'some-pkg';
		export declare const parsePath: (path: string) => A;
		`,
	},
};

export const dependencyWithAtType = {
	node_modules: {
		'@types/some-pkg': {
			'package.json': JSON.stringify({
				types: 'dist/index.d.ts',
			}),
			'dist/index.d.ts': outdent`
			export type A = string;
			`,
		},
		'some-pkg': {
			'package.json': JSON.stringify({}),
		},
	},
	'dist/entry.d.ts': outdent`
	import type { A } from 'some-pkg';
	export declare const parsePath: (path: string) => A;
	`,
};
