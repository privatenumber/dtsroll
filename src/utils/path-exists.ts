import fs from 'node:fs/promises';

export const pathExists = async (
	filePath: string,
) => fs.access(filePath).then(() => true, () => false);
