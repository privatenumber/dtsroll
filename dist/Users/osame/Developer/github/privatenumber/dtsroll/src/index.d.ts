import { DtsrollOutput } from './types.js';
export type Options = {
    inputs?: string[];
    external?: string[];
    conditions?: string[];
    dryRun?: boolean;
};
export declare const dtsroll: ({ inputs, external, conditions, dryRun, }?: Options) => Promise<DtsrollOutput>;
export type { DtsrollOutput };
