import fs from 'node:fs/promises';
import path from 'node:path';
import type { OutputChunk } from 'rollup';

const nodeModules = `${path.sep}node_modules${path.sep}`;

export const weighAndRemoveBundledModules = async (
	cwd: string,
	inputFiles: string[],
	output: OutputChunk[],
	removeFiles: boolean,
) => {
	const bundledSourceFiles = output
		.flatMap(({ moduleIds }) => moduleIds)
		.filter(moduleId => (
			moduleId.startsWith(cwd)
            && !moduleId.includes(nodeModules)
		));

	const fileSizes = await Promise.all(bundledSourceFiles.map(async (moduleId) => {
		const fileContents = await fs.stat(moduleId);

		// Only delete the file if it's not an input file
		// Input files are overwritten so they don't need to be deleted
		if (removeFiles && !inputFiles.includes(moduleId)) {
			await fs.rm(moduleId);
		}

		return fileContents.size;
	}));

	return fileSizes.reduce((total, size) => total + size, 0);
};
