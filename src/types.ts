import type { OutputChunk } from 'rollup';

export type Output = OutputChunk & {
	size: number;
	moduleToPackage: Record<string, string | undefined>;
};

export type Externals = [
	packageName: string,
	reason?: string,
	warning?: string,
][];

export type ValidatedInput = [
	inputPath: string,
	inputSource: string | undefined,
	error?: string,
];

export type DtsrollOutput = {
	inputs: ValidatedInput[];
	error: string;
} | {
	inputs: ValidatedInput[];
	outputDirectory: string;
	output: {
		entries: Output[];
		chunks: Output[];
	};
	size: {
		input: number;
		output: number;
	};
	externals: Externals;
};
