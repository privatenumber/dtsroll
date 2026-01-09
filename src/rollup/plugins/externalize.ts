import type { Plugin } from 'rollup';
import { isPath } from '../../utils/path-utils.js';
import { getPackageName } from '../../utils/package-name.js';

export const createExternalizePlugin = (
	configuredExternals: Map<string, string>,
) => {
	const resolvedBareSpecifiers = new Map<string, string>();
	const importPath = new Map<string, string>();
	const externalized = new Map<string, string>();

	const externalizePlugin = {
		name: 'externalize',
		async resolveId(id, importer, options) {
			const packageName = !isPath(id) && getPackageName(id);

			// Check id against package.json dependencies
			if (packageName) {
				const externalReason = configuredExternals.get(packageName);
				if (externalReason) {
					externalized.set(packageName, externalReason);

					return {
						id,
						external: true,
					};
				}
			}

			const resolved = await this.resolve(id, importer, options);
			if (resolved) {
				if (packageName) {
					resolvedBareSpecifiers.set(resolved.id, id);
				}

				if (
					// Self imports happen
					importer && resolved.id !== importer

					// Prevent loops
					&& importPath.get(importer) !== resolved.id
				) {
					importPath.set(resolved.id, importer);
				}

				return resolved;
			}

			if (packageName) {
				externalized.set(packageName, 'because unresolvable');
				return {
					id,
					external: true,
				};
			}
		},
	} satisfies Plugin;

	const getPackageEntryPoint = (
		subpackagePath: string,
	) => {
		let i = 0;
		let lastEntry: string | undefined = subpackagePath;
		do {
			if (resolvedBareSpecifiers.has(lastEntry)) {
				return resolvedBareSpecifiers.get(lastEntry);
			}
			lastEntry = importPath.get(lastEntry);
			i += 1;
		} while (lastEntry && i < 100);
	};

	return {
		externalizePlugin,
		externalized,
		getPackageEntryPoint,
	};
};
