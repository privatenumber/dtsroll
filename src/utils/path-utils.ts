import path from 'node:path';

export const isPath = (
	filePath: string,
) => (filePath[0] === '.' || path.isAbsolute(filePath));

export const normalizePath = (
	filepath: string,
) => filepath.replace(/\\/g, '/');
