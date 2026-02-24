import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import nanoSpawn, { type SubprocessError } from 'nano-spawn';

const require = createRequire(import.meta.url);

const dtsrollPath = path.resolve('./dist/cli.mjs');

const tsCondition = process.env.TS_CONDITION;
const aliasImportsLoader = pathToFileURL(require.resolve('alias-imports')).href;

export const dtsroll = (
	cwd: string,
	args: string[],
) => nanoSpawn(
	process.execPath,
	[
		...(tsCondition
			? ['--loader', aliasImportsLoader, '--conditions', tsCondition]
			: []),
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
