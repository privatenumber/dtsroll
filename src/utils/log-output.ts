import path from 'node:path';
import byteSize from 'byte-size';
import {
	dim, green, magenta, bold, yellow, lightYellow, red,
} from 'kolorist';
import type { Output, DtsrollOutput } from '../types.js';
import { cwd } from './cwd.js';
import { warningSignUnicode } from './constants.js';

export const logOutput = (dtsOutput: DtsrollOutput) => {
	const { inputs } = dtsOutput;
	const isCliInput = inputs[0][1] === undefined;
	console.log(bold(`\n📥 Entry points${isCliInput ? '' : ' in package.json'}`));
	console.log(
		inputs
			.map(([inputFile, inputSource, error]) => {
				const relativeInputFile = path.relative(cwd, inputFile);
				const logPath = relativeInputFile.length < inputFile.length ? relativeInputFile : inputFile;

				if (error) {
					return ` ${lightYellow(`${warningSignUnicode} ${logPath} ${dim(error)}`)}`;
				}

				return ` → ${green(logPath)}${inputSource ? ` ${dim(`from ${inputSource}`)}` : ''}`;
			})
			.join('\n'),
	);

	if ('error' in dtsOutput) {
		console.error(`${red('Error:')} ${dtsOutput.error}`);
		return;
	}

	const {
		outputDirectory,
		output: {
			entries: outputEntries,
			chunks: outputChunks,
		},
		size,
		externals,
	} = dtsOutput;

	const outputDirectoryRelative = path.relative(cwd, outputDirectory);
	const logPath = (
		outputDirectoryRelative.length < outputDirectory.length
			? outputDirectoryRelative
			: outputDirectory
	) + path.sep;

	const logChunk = (
		{
			file,
			indent,
			bullet,
			color,
		}: {
			file: Output;
			indent: string;
			bullet: string;
			color: (text: string) => string;
		},
	) => {
		const sizeFormatted = byteSize(file.size).toString();
		let log = `${indent}${bullet} ${dim(color(logPath))}${color(file.fileName)} ${sizeFormatted}`;

		const { moduleIds, moduleToPackage } = file;

		log += `\n${
			moduleIds
				.sort()
				.map((moduleId, index) => {
					const isLast = index === moduleIds.length - 1;
					const prefix = `${indent}   ${isLast ? '└─ ' : '├─ '}`;

					const relativeModuleId = path.relative(cwd, moduleId);
					const logModuleId = (
						relativeModuleId.length < moduleId.length
							? relativeModuleId
							: moduleId
					);

					const bareSpecifier = moduleToPackage[moduleId];
					if (bareSpecifier) {
						return `${prefix}${dim(`${magenta(bareSpecifier)} (${logModuleId})`)}`;
					}

					return `${prefix}${dim(logModuleId)}`;
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

	if (externals.length > 0) {
		console.log(bold('\n📦 External packages'));
		console.log(
			externals
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
