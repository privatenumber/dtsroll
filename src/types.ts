import type { OutputChunk } from 'rollup';

export type Output = OutputChunk & {
	size: number;
	moduleToPackage: Record<string, string | undefined>;
};
