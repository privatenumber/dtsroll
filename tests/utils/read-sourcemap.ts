import fs from 'node:fs/promises';
import type { EncodedSourceMap } from '@jridgewell/trace-mapping';

export const readSourceMap = async (filePath: string): Promise<EncodedSourceMap> => {
	const content = await fs.readFile(filePath, 'utf8');
	return JSON.parse(content) as EncodedSourceMap;
};
