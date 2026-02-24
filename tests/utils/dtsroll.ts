import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import nanoSpawn, { type SubprocessError } from 'nano-spawn';

const require = createRequire(import.meta.url);
const dtsrollPath = path.resolve('./dist/cli.mjs');

/**
 * Extract alias-imports flags from process.execArgv, resolving
 * the loader to an absolute file URL so it works from any CWD
 * (CLI tests run from temp fixture directories).
 */
const getInheritedNodeArgs = () => {
	const args: string[] = [];
	const { execArgv } = process;
	for (let i = 0; i < execArgv.length; i += 1) {
		if (execArgv[i] === '--loader' && execArgv[i + 1] === 'alias-imports') {
			args.push('--loader', pathToFileURL(require.resolve('alias-imports')).href);
			i += 1;
		} else if (execArgv[i] === '--conditions' && execArgv[i + 1]?.startsWith('typescript')) {
			args.push(execArgv[i], execArgv[i + 1]);
			i += 1;
		}
	}
	return args;
};

const inheritedNodeArgs = getInheritedNodeArgs();

export const dtsroll = (
	cwd: string,
	args: string[],
) => nanoSpawn(
	process.execPath,
	[
		...inheritedNodeArgs,
		dtsrollPath,
		...args,
	],
	{
		cwd,
		env: {
			...process.env,
			NO_COLOR: '1',
		},
	},
).catch(error => error as SubprocessError);
