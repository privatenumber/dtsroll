export declare const singleEntryPoint: {
    dist: {
        'entry.d.ts': string;
        'file.d.ts': string;
    };
};
export declare const multipleEntryPoints: {
    dist: {
        'ignore-me.ts': string;
        'index.d.ts': string;
        'some-dir/index.d.ts': string;
        'dir/common.d.ts': string;
    };
};
export declare const externalsNodeBuiltins: {
    dist: {
        'entry.d.ts': string;
    };
};
export declare const externalsMissingDep: {
    dist: {
        'entry.d.ts': string;
    };
};
export declare const dependency: {
    'node_modules/some-pkg': {
        'package.json': string;
        'dist/index.d.ts': string;
    };
    dist: {
        'entry.d.ts': string;
    };
};
export declare const dependencyWithAtType: {
    node_modules: {
        '@types/some-pkg': {
            'package.json': string;
            'dist/index.d.ts': string;
        };
        'some-pkg': {
            'package.json': string;
        };
    };
    'dist/entry.d.ts': string;
};
