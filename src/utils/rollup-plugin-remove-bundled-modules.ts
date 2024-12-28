import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, OutputChunk } from 'rollup';
import { cwd } from './cwd.js';

const nodeModules = `${path.sep}node_modules${path.sep}`;

export const removeBundledModulesPlugin = (
	sizeRef: { value?: number },
): Plugin => {
	let deleteFiles: string[] = [];

	return {
		name: 'remove-bundled-modules',
		async generateBundle(options, bundle) {
			const modules = Object.values(bundle) as OutputChunk[];
			const bundledSourceFiles = Array.from(new Set(
				modules
					.flatMap(({ moduleIds }) => moduleIds)
					.filter(moduleId => (
						moduleId.startsWith(cwd)
						&& !moduleId.includes(nodeModules)
					)),
			));

			const fileSizes = await Promise.all(bundledSourceFiles.map(moduleId => fs.stat(moduleId)));
			const totalSize = fileSizes.reduce((total, { size }) => total + size, 0);
			sizeRef.value = totalSize;

			const outputFiles = new Set(modules.map(({ fileName }) => path.join(options.dir!, fileName)));
			deleteFiles = bundledSourceFiles.filter(moduleId => !outputFiles.has(moduleId));
		},
		writeBundle: async () => {
			await Promise.all(
				deleteFiles.map(moduleId => fs.rm(moduleId)),
			);
		},
	};
};
