import outdent from 'outdent';

export const singleEntryPoint = {
	dist: {
		'entry.d.ts': outdent`
		import { Foo } from './file';
		export declare const value: Foo;
		`,
		'file.d.ts': outdent`
		export type Foo = string; 
		`,
	},
};

export const multipleEntryPoints = {
	dist: {
		'ignore-me.ts': outdent`
		// This file should be ignored
		some random invalid syntax
		`,

		'index.d.ts': outdent`
		import { Foo } from './dir/common';
		export declare const valueA: Foo;
		`,
		'some-dir/index.d.ts': outdent`
		import { Foo } from '../dir/common';
		export declare const valueB: Foo;
		`,
		'dir/common.d.ts': outdent`
		export type Foo = string; 
		`,
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
