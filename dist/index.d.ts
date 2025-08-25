import { OutputChunk } from 'rolldown';

type Output = OutputChunk & {
    size: number;
    moduleToPackage: Record<string, string | undefined>;
};
type Externals = [
    packageName: string,
    reason?: string,
    warning?: string
][];
type ValidatedInput = [
    inputPath: string,
    inputSource: string | undefined,
    error?: string
];
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

type Options = {
    cwd?: string;
    inputs?: string[];
    external?: string[];
    conditions?: string[];
    dryRun?: boolean;
};
declare const dtsroll: ({ cwd, inputs, external, conditions, dryRun, }?: Options) => Promise<DtsrollOutput>;

export { dtsroll };
export type { DtsrollOutput, Options };
