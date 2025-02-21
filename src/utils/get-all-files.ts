import fs from 'node:fs/promises';
import path from 'node:path';

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
						: files.map(file => `./${path.relative(directoryPath, file)}`)
				);
			}

			return (
				dontShortenPath
					? filePath
					: `./${path.relative(directoryPath, filePath)}`
			);
		}),
	);

	return fileTree.flat();
};
