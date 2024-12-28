import path from 'node:path';

export const getCommonDirectory = (
	filePaths: string[],
): string => {
	const splitPaths = filePaths.map(filePath => filePath.split(path.sep).slice(0, -1));

	const commonPath: string[] = [];

	const [firstPath] = splitPaths;
	for (let i = 0; i < firstPath.length; i += 1) {
		const segment = firstPath[i];

		// Check if this segment is common to all paths
		const segmentIsCommon = splitPaths.every(pathParts => pathParts[i] === segment);
		if (!segmentIsCommon) {
			break;
		}

		commonPath.push(segment);
	}

	return commonPath.join(path.sep);
};
