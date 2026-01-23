import path from 'node:path';
import nanoSpawn, { type SubprocessError } from 'nano-spawn';

const dtsrollPath = path.resolve('./dist/cli.mjs');

export const dtsroll = (
	cwd: string,
	args: string[],
) => nanoSpawn(
	'node',
	[dtsrollPath, ...args],
	{
		cwd,
		env: {
			...process.env,
			NO_COLOR: '1',
		},
	},
).catch(error => error as SubprocessError);
