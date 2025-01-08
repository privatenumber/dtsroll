import path from 'node:path';
import byteSize from 'byte-size';
import {
	dim, green, magenta, bold, yellow,
} from 'kolorist';
import { cwd } from './cwd.js';
import type { ChunkWithSize } from '../types.js';

type Options = {
	outputDirectory: string;
	output: {
		entries: ChunkWithSize[];
		chunks: ChunkWithSize[];
	},
	size: {
		input: number;
		output: number;
	},
	externalized: [string, string, string?][];
};

export const logOutput = ({
	outputDirectory,
	output: {
		entries: outputEntries,
		chunks: outputChunks,
	},
	size,
	externalized,
}: Options) => {
	const outputDirectoryRelative = path.relative(cwd, outputDirectory) + path.sep;

	const logChunk = (
		{
			file,
			indent,
			bullet,
			color,
		}: {
			file: ChunkWithSize;
			indent: string;
			bullet: string;
			color: (text: string) => string;
		},
	) => {
		const sizeFormatted = byteSize(file.size).toString();
		let log = `${indent}${bullet} ${dim(color(outputDirectoryRelative))}${color(file.fileName)} ${sizeFormatted}`;

		const { moduleIds, moduleToPackage } = file;

		log += `\n${
			moduleIds
				.sort()
				.map((moduleId, index) => {
					const isLast = index === moduleIds.length - 1;
					const prefix = `${indent}   ${isLast ? '└─ ' : '├─ '}`;

					const relativeModuleId = path.relative(cwd, moduleId);

					const bareSpecifier = moduleToPackage[moduleId];
					if (bareSpecifier) {
						return `${prefix}${dim(magenta(bareSpecifier))} ${dim(`(${relativeModuleId})`)}`;
					}

					const fileName = path.basename(relativeModuleId);
					const directoryPath = path.dirname(relativeModuleId) + path.sep;
					return `${prefix}${dim(directoryPath)}${dim(fileName)}`;
				})
				.join('\n')
		}`;

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
	const percentage = (((size.input - size.output) / size.input) * 100).toFixed(0);
	console.log(`   Input source size:   ${byteSize(size.input).toString()}`);
	console.log(`   Bundled output size: ${byteSize(size.output).toString()} (${percentage}% decrease)`);

	if (externalized.length > 0) {
		console.log(bold('\n📦 Externalized packages'));
		console.log(
			externalized
				.map(([packageName, reason, devTypePackage]) => {
					let stdout = ` ─ ${magenta(packageName)} ${dim(`externalized ${reason}`)}`;
					if (devTypePackage) {
						stdout += `\n   ${yellow('Warning:')} ${magenta(devTypePackage)} should not be in devDependencies if ${magenta(packageName)} is externalized`;
					}
					return stdout;
				})
				.sort()
				.join('\n'),
		);
	}
};
