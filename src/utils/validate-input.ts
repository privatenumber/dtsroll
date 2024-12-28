import path from 'node:path';
import {
	dim, green, lightYellow, bold,
} from 'kolorist';
import { pathExists } from './path-exists.js';
import { dtsExtension, warningSignUnicode } from './constants.js';

export const validateInput = async (
	cwd: string,
	inputFiles: string[] | Record<string, string> | undefined,
) => {
	if (!inputFiles) {
		throw new Error('No input files');
	}

	const isCliInput = Array.isArray(inputFiles);
	console.log(bold(`\n📥 Entry points${isCliInput ? '' : ' in package.json'}`));

	const inputNormalized = isCliInput
		? inputFiles.map(i => [i])
		: Object.entries(inputFiles);

	const validInputs: string[] = [];
	const stdout = await Promise.all(inputNormalized.map(async ([inputFile, inputSource]) => {
		const relativeInputFile = path.relative(cwd, inputFile);

		if (!inputFile.startsWith(cwd)) {
			return ` ${lightYellow(`${warningSignUnicode} ${relativeInputFile} ${dim('Ignoring file outside of cwd')}`)}`;
		}

		const notDts = !inputFile.endsWith(dtsExtension);
		if (notDts) {
			return ` ${lightYellow(`${warningSignUnicode} ${relativeInputFile} ${dim('Ignoring non-d.ts input')}`)}`;
		}

		const exists = await pathExists(inputFile);
		if (!exists) {
			return ` ${lightYellow(`${warningSignUnicode} ${relativeInputFile} ${dim('File not found')}`)}`;
		}

		validInputs.push(inputFile);

		return ` → ${green(relativeInputFile)}${inputSource ? ` ${dim(`from ${inputSource}`)}` : ''}`;
	}));
	console.log(stdout.join('\n'));

	if (validInputs.length === 0) {
		throw new Error('No input files');
	}

	return validInputs;
};
