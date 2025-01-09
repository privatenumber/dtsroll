import type { Plugin } from 'vite';
import { dtsroll, type Options } from './index.js';
import { logOutput } from './utils/log-output.js';

const dtsrollPlugin = (
	options: Options
): Plugin => ({
	name: 'dtsroll',
	writeBundle: async () => {
		logOutput(await dtsroll(options));
	},
});

export { dtsrollPlugin as dtsroll };
