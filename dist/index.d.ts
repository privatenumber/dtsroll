import { OutputChunk } from 'rollup';

/**
 * Extended output chunk with additional metadata.
 */
type Output = OutputChunk & {
    /** Size of the output file in bytes. */
    size: number;
    /** Map of module IDs to their package names. */
    moduleToPackage: Record<string, string | undefined>;
};
/**
 * List of externalized packages with metadata.
 * Each entry is [packageName, reason, warning?].
 */
type Externals = [
    packageName: string,
    reason?: string,
    warning?: string
][];
/**
 * Validated input file with source info and optional error.
 * Tuple format: [inputPath, inputSource, error?].
 */
type ValidatedInput = [
    inputPath: string,
    inputSource: string | undefined,
    error?: string
];
/**
 * Output from the dtsroll build process.
 * Returns either an error state or successful build results.
 */
type DtsrollOutput = {
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

/**
 * Configuration options for dtsroll.
 */
type Options = {
    /** Working directory. Defaults to process.cwd(). */
    cwd?: string;
    /** Input .d.ts files to bundle. If not provided, auto-detects from package.json. */
    inputs?: string[];
    /** Packages to externalize (only used when no package.json is present). */
    external?: string[];
    /** Export conditions for module resolution. */
    conditions?: string[];
    /** If true, generates output without writing files. */
    dryRun?: boolean;
    /** If true, generates source maps (.d.ts.map files). */
    sourcemap?: boolean;
};
/**
 * Bundle TypeScript declaration files using Rollup.
 *
 * @param options - Configuration options
 * @returns Build output including bundled files, sizes, and externalized packages
 */
declare const dtsroll: ({ cwd, inputs, external, conditions, dryRun, sourcemap, }?: Options) => Promise<DtsrollOutput>;

export { dtsroll };
export type { DtsrollOutput, Options };
