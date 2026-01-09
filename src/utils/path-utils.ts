import path from 'node:path';
import { cwd } from './cwd.js';

export const isPath = (
	filePath: string,
) => (filePath[0] === '.' || path.isAbsolute(filePath));

export const normalizePath = (
	filepath: string,
) => filepath.replaceAll('\\', '/');

/**
 * Returns a display-friendly path - the shorter of relative (from cwd) or absolute.
 * Normalizes path separators for consistent output.
 */
export const getDisplayPath = (
	fullPath: string,
) => {
	const relativePath = path.relative(cwd, fullPath);
	return normalizePath(
		relativePath.length < fullPath.length
			? relativePath
			: fullPath,
	);
};
