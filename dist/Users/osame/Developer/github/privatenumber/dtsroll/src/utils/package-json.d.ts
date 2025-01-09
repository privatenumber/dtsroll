export declare const getPackageJson: () => Promise<{
    getExternals: () => Map<string, string>;
    getDtsEntryPoints: () => Record<string, string>;
    devTypePackages: {
        [k: string]: string;
    };
} | undefined>;
