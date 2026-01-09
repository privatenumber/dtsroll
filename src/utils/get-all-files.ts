import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePath } from './path-utils.js';

export const getAllFiles = async (
	directoryPath: string,
	dontShortenPath?: boolean,
): Promise<string[]> => {
	const directoryFiles = await fs.readdir(directoryPath, { withFileTypes: true });
	const fileTree = await Promise.all(
		directoryFiles.map(async (entry) => {
			const filePath = path.join(directoryPath, entry.name);
			if (entry.isDirectory()) {
				const files = await getAllFiles(filePath, true);
				return (
					dontShortenPath
						? files
						: files.map(file => `./${normalizePath(path.relative(directoryPath, file))}`)
				);
			}

			return (
				dontShortenPath
					? filePath
					: `./${normalizePath(path.relative(directoryPath, filePath))}`
			);
		}),
	);

	return fileTree.flat();
};
