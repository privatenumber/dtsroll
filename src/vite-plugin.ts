import type { Plugin } from 'vite';
import { dtsroll } from './index.js';

const dtsrollPlugin = (): Plugin => ({
	name: 'dtsroll',

});

export { dtsrollPlugin as dtsroll };
