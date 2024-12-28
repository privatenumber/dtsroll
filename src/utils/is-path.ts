import path from 'node:path';

export const isPath = (
	[firstCharacter]: string,
) => (firstCharacter === '.' || firstCharacter === path.sep);
