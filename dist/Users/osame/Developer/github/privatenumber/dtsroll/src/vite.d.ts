import { Plugin } from 'vite';
import { Options } from './index.js';
declare const dtsrollPlugin: (options?: Options) => Plugin;
export { dtsrollPlugin as dtsroll };
