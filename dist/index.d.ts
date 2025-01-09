import { OutputChunk } from 'rollup';

type Output = OutputChunk & {
    size: number;
    moduleToPackage: Record<string, string | undefined>;
};
type Externals = [
    packageName: string,
    reason: string,
    warning?: string
][];
type DtsrollOutput = {
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
    inputs?: string[];
    external?: string[];
    conditions?: string[];
    dryRun?: boolean;
};
declare const dtsroll: ({ inputs, external, conditions, dryRun, }: Options) => Promise<DtsrollOutput>;

export { type DtsrollOutput, type Options, dtsroll };
