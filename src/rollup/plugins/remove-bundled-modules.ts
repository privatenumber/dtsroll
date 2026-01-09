import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, OutputChunk } from 'rollup';

const nodeModules = `${path.sep}node_modules${path.sep}`;

export const removeBundledModulesPlugin = (
	outputDirectory: string,
	sizeRef: { value?: number },
): Plugin => {
	let deleteFiles: string[] = [];

	return {
		name: 'remove-bundled-modules',
		transform: {
			// Get size of raw code before other transformations
			order: 'pre',
			handler: code => ({
				meta: {
					size: Buffer.byteLength(code),
				},
			}),
		},
		async generateBundle(options, bundle) {
			const modules = Object.values(bundle) as OutputChunk[];
			const bundledFiles = Array.from(new Set(modules.flatMap(({ moduleIds }) => moduleIds)));

			let totalSize = 0;
			for (const moduleId of bundledFiles) {
				const moduleInfo = this.getModuleInfo(moduleId);
				const size = moduleInfo?.meta?.size;
				if (typeof size === 'number') {
					totalSize += size;
				}
			}
			sizeRef.value = totalSize;

			const outputFiles = new Set(modules.map(({ fileName }) => path.join(options.dir!, fileName)));

			deleteFiles = bundledFiles.filter(moduleId => (
				moduleId
				// To avoid deleting files from symlinked dependencies
				&& moduleId.startsWith(outputDirectory)
				&& !moduleId.includes(nodeModules)
				&& !outputFiles.has(moduleId)
			));
		},
		writeBundle: async () => {
			await Promise.all(
				deleteFiles.map(moduleId => fs.rm(moduleId)),
			);
		},
	};
};
