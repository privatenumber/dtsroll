export declare const createExternalizePlugin: (configuredExternals: Map<string, string>) => {
    externalizePlugin: {
        name: string;
        resolveId(this: import('rollup').PluginContext, id: string, importer: string | undefined, options: {
            attributes: Record<string, string>;
            custom?: import('rollup').CustomPluginOptions;
            isEntry: boolean;
        }): Promise<import('rollup').ResolvedId | {
            id: string;
            external: true;
        }>;
    };
    externalized: Map<string, string>;
    getPackageEntryPoint: (subpackagePath: string) => string | undefined;
};
