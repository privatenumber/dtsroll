import { Plugin } from 'vite';
import { Options } from './index.js';
import 'rollup';

/**
 * Vite plugin for bundling TypeScript declaration files.
 * Runs after vite-plugin-dts in the writeBundle hook.
 *
 * @param options - Configuration options (same as dtsroll function)
 * @returns Vite plugin instance
 */
declare const dtsrollPlugin: (options?: Options) => Plugin;

export { dtsrollPlugin as dtsroll };
