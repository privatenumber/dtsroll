import type { OutputChunk } from "rollup";

export type ChunkWithSize = OutputChunk & {
    size: number;
    moduleToPackage: Record<string, string | undefined>;
};
