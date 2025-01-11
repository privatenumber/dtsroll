export const dtsExtension = '.d.ts';
const dctsExtension = '.d.cts';
const dmtsExtension = '.d.mts';

export const dtsExtensions = [dtsExtension, dctsExtension, dmtsExtension];

export const isDts = (
	fileName: string,
) => dtsExtensions.some(extension => fileName.endsWith(extension));
