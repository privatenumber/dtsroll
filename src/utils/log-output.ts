import path from 'node:path';
import byteSize from 'byte-size';
import type { RollupOutput, OutputChunk } from 'rollup';
import {
	dim, green, magenta, bold, yellow,
} from 'kolorist';
import { getPackageName } from './package-name.js';
import { cwd } from './cwd.js';

type Options = {
	outputDirectory: string;
	built: RollupOutput;
	externalized: Map<string, string>;
	getPackageEntryPoint: (subpackagePath: string) => string | undefined;
	getDevTypePackages?: () => Record<string, string>;
	sourceSize: number;
};

export const logOutput = ({
	outputDirectory,
	built,
	externalized,
	getPackageEntryPoint,
	getDevTypePackages,
	sourceSize,
}: Options) => {
	const outputDirectoryRelative = path.relative(cwd, outputDirectory) + path.sep;
	const externalImports = new Set<string>();
	const fileSizes: Record<string, number> = {};
	let outputSize = 0;

	const outputEntries: OutputChunk[] = [];
	const outputChunks: OutputChunk[] = [];
	for (const file of built.output as OutputChunk[]) {
		const size = Buffer.byteLength(file.code, 'utf8');
		fileSizes[file.fileName] = size;
		outputSize += size;

		if ('isEntry' in file && file.isEntry) {
			outputEntries.push(file);
		} else {
			outputChunks.push(file);
		}
	}

	const logChunk = (
		{
			file,
			indent,
			bullet,
			color,
		}: {
			file: OutputChunk;
			indent: string;
			bullet: string;
			color: (text: string) => string;
		},
	) => {
		const sizeFormatted = byteSize(fileSizes[file.fileName]!).toString();
		let log = `${indent}${bullet} ${dim(color(outputDirectoryRelative))}${color(file.fileName)} ${sizeFormatted}`;

		const { moduleIds } = file;

		log += `\n${
			moduleIds
				.sort()
				.map((moduleId, index) => {
					const isLast = index === moduleIds.length - 1;
					const prefix = `${indent}   ${isLast ? '└─ ' : '├─ '}`;

					const relativeModuleId = path.relative(cwd, moduleId);

					const bareSpecifier = getPackageEntryPoint(moduleId);
					if (bareSpecifier) {
						return `${prefix}${dim(magenta(bareSpecifier))} ${dim(`(${relativeModuleId})`)}`;
					}

					const fileName = path.basename(relativeModuleId);
					const directoryPath = path.dirname(relativeModuleId) + path.sep;
					return `${prefix}${dim(directoryPath)}${dim(fileName)}`;
				})
				.join('\n')
		}`;

		for (const id of file.imports) {
			externalImports.add(getPackageName(id));
		}

		return log;
	};

	console.log(bold('\n💠 Bundled output'));
	console.log(
		outputEntries.map(file => logChunk({
			file,
			indent: ' ',
			bullet: '●',
			color: green,
		})).join('\n\n'),
	);

	if (outputChunks.length > 0) {
		console.log(bold('\n Chunks'));
		console.log(
			outputChunks
				.map(file => logChunk({
					file,
					indent: '   ',
					bullet: '■',
					color: yellow,
				}))
				.join('\n\n'),
		);
	}

	console.log(bold('\n⚖️ Size savings'));
	const percentage = (((sourceSize - outputSize) / sourceSize) * 100).toFixed(0);
	console.log(`   Input source size:   ${byteSize(sourceSize).toString()}`);
	console.log(`   Bundled output size: ${byteSize(outputSize).toString()} (${percentage}% decrease)`);

	const externalImportsFiltered = Array.from(externalImports).filter(
		packageName => externalized.has(packageName),
	);
	if (externalImportsFiltered.length > 0) {
		const devTypePackages = getDevTypePackages?.() ?? {};
		console.log(bold('\n📦 Externalized packages'));
		console.log(
			externalImportsFiltered
				.map((packageName) => {
					const reason = externalized.get(packageName)!;
					let point = ` ─ ${magenta(packageName)} ${dim(`externalized ${reason}`)}`;
					if (devTypePackages[packageName]) {
						point += `\n   ${yellow('Warning:')} ${magenta(devTypePackages[packageName])} should not be in devDependencies if ${magenta(packageName)} is externalized`;
					}

					return point;
				})
				.sort()
				.join('\n'),
		);
	}
};
