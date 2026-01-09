import type { OutputChunk } from 'rollup';

/**
 * Extended output chunk with additional metadata.
 */
export type Output = OutputChunk & {

	/** Size of the output file in bytes. */
	size: number;

	/** Map of module IDs to their package names. */
	moduleToPackage: Record<string, string | undefined>;
};

/**
 * Error thrown when dtsroll fails to build a declaration file.
 * Contains the file path and import chain for debugging.
 */
export class DtsrollBuildError extends Error {
	id: string;

	importChain: string[];

	constructor(
		message: string,
		id: string,
		importChain: string[],
	) {
		super(message);
		this.name = 'DtsrollBuildError';
		this.id = id;
		this.importChain = importChain;
	}
}

/**
 * List of externalized packages with metadata.
 * Each entry is [packageName, reason, warning?].
 */
export type Externals = [
	packageName: string,
	reason?: string,
	warning?: string,
][];

/**
 * Validated input file with source info and optional error.
 * Tuple format: [inputPath, inputSource, error?].
 */
export type ValidatedInput = [
	inputPath: string,
	inputSource: string | undefined,
	error?: string,
];

/**
 * Output from the dtsroll build process.
 * Returns either an error state or successful build results.
 */
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
