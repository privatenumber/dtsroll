import { Plugin } from 'vite';
import { Options } from './index.js';
import 'rollup';

declare const dtsrollPlugin: (options: Options) => Plugin;

export { dtsrollPlugin as dtsroll };
