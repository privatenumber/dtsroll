import type { Plugin } from 'vite';
import { logOutput } from './utils/log-output.js';
import { dtsroll, type Options } from './index.js';

const dtsrollPlugin = (
	options?: Options,
): Plugin => ({
	name: 'dtsroll',
	writeBundle: async () => {
		logOutput(await dtsroll(options));
	},
});

export { dtsrollPlugin as dtsroll };
