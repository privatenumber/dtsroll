export const dtsExtensions = ['.d.ts', '.d.cts', '.d.mts'];

export const isDts = (
	fileName: string,
) => dtsExtensions.some(extension => fileName.endsWith(extension));
