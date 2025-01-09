export declare const build: (input: string[], outputDirectory: string, externals: Map<string, string>, mode: "generate" | "write", conditions?: string[]) => Promise<{
    built: import('rollup').RollupOutput;
    externalized: Map<string, string>;
    getPackageEntryPoint: (subpackagePath: string) => string | undefined;
    sourceSize: number;
}>;
