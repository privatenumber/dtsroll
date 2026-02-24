import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const typescriptVersions = [
	{
		condition: 'typescript4',
		package: 'typescript4',
	},
	{
		condition: 'typescript5',
		package: 'typescript5',
	},
	{
		condition: 'typescript6',
		package: 'typescript6',
	},
];

const run = (
	condition: string,
) => new Promise<boolean>((resolve) => {
	const child = spawn('node', [
		'--loader',
		'alias-imports',
		'--conditions',
		condition,
		'tests/specs.ts',
	], {
		stdio: 'inherit',
		env: {
			...process.env,
			TS_CONDITION: condition,
			NODE_NO_WARNINGS: '1',
		},
	});
	child.on('close', code => resolve(code === 0));
});

(async () => {
	let failed = false;
	for (const { condition, package: pkg } of typescriptVersions) {
		const { version } = require(`${pkg}/package.json`) as { version: string };
		console.log(`\nTypeScript ${version}`);

		const passed = await run(condition);
		if (!passed) {
			failed = true;
		}
	}

	if (failed) {
		throw new Error('Tests failed');
	}
})();
