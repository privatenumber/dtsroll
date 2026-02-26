import path from 'node:path';
import nanoSpawn, { type SubprocessError } from 'nano-spawn';

const dtsrollPath = path.resolve('./dist/cli.mjs');

const execArgv = process.execArgv.map((argument) => {
	if (argument === 'alias-imports') {
		return import.meta.resolve(argument);
	}
	return argument;
});

export const dtsroll = (
	cwd: string,
	args: string[],
) => nanoSpawn(
	process.execPath,
	[
		...execArgv,
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
