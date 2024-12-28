import type { Plugin } from 'rollup';
import { isPath } from './is-path.js';
import { getPackageName } from './package-name.js';

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

				// Self imports happen
				if (importer && resolved.id !== importer) {
					importPath.set(resolved.id, importer);
				}

				return resolved;
			}

			if (packageName) {
				externalized.set(packageName, 'because unresolvable');
			}

			return {
				id,
				external: true,
			};
		},
	} satisfies Plugin;

	const getPackageEntryPoint = (
		subpackagePath: string,
	) => {
		let lastEntry: string | undefined = subpackagePath;
		do {
			if (resolvedBareSpecifiers.has(lastEntry)) {
				return resolvedBareSpecifiers.get(lastEntry);
			}
			lastEntry = importPath.get(lastEntry);
		} while (lastEntry);
	};

	return {
		externalizePlugin,
		externalized,
		getPackageEntryPoint,
	};
};
