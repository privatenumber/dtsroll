import type { ValidatedInput } from '../types.js';
import { pathExists } from './path-exists.js';
import { dtsExtension } from './constants.js';

export const validateInput = async (
	inputFiles: string[] | Record<string, string> | undefined,
) => {
	if (!inputFiles) {
		throw new Error('No input files');
	}

	const isCliInput = Array.isArray(inputFiles);

	const inputNormalized = isCliInput
		? inputFiles.map(i => [i] as const)
		: Object.entries(inputFiles);

	return await Promise.all(inputNormalized.map(
		async ([inputFile, inputSource]): Promise<ValidatedInput> => {
			const notDts = !inputFile.endsWith(dtsExtension);
			if (notDts) {
				return [inputFile, inputSource, 'Ignoring non-d.ts input'];
			}

			const exists = await pathExists(inputFile);
			if (!exists) {
				return [inputFile, inputSource, 'File not found'];
			}

			return [inputFile, inputSource];
		},
	));
};
