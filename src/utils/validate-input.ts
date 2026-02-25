import type { ValidatedInput } from '../types.ts';
import { pathExists } from './path-exists.ts';
import { isDts } from './dts-extensions.ts';

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
			if (!isDts(inputFile)) {
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
