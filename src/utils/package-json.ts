import fs from 'node:fs/promises';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { isDts } from './dts-extensions.js';
import { propertyNeedsQuotes } from './property-needs-quotes.js';
import { pathExists } from './path-exists.js';
import { typesPrefix, getOriginalPackageName } from './package-name.js';
import { getAllFiles } from './get-all-files.js';

const readPackageJson = async (
	filePath: string,
) => {
	const packageJsonString = await fs.readFile(filePath, 'utf8');
	return JSON.parse(packageJsonString) as PackageJson;
};

const traverseExports = (
	exportValue: PackageJson['exports'],
	propertyPath: string,
): [subpath: string, fromProperty: string][] => {
	if (typeof exportValue === 'string') {
		return [[exportValue, propertyPath]];
	}

	if (Array.isArray(exportValue)) {
		return exportValue.flatMap((value, index) => traverseExports(value, `${propertyPath}[${index}]`));
	}

	if (typeof exportValue === 'object' && exportValue !== null) {
		return Object.entries(exportValue).flatMap(([property, value]) => {
			const newProperty = propertyNeedsQuotes(property)
				? `["${property}"]`
				: `.${property}`;
			return traverseExports(value, propertyPath + newProperty);
		});
	}

	return [];
};

const getDtsEntryPoints = async (
	packageJson: PackageJson,
	packageJsonDirectory: string,
) => {
	const entryPoints: Record<string, string> = {};

	const addEntry = (
		subpath: string,
		from: string,
	) => {
		if (!isDts(subpath)) {
			return;
		}
		const entryPath = path.join(packageJsonDirectory, subpath);
		if (!entryPoints[entryPath]) {
			entryPoints[entryPath] = from;
		}
	};

	// https://www.typescriptlang.org/docs/handbook/modules/reference.html
	if (packageJson.types) {
		addEntry(packageJson.types, 'types');
	}

	if (packageJson.typings) {
		addEntry(packageJson.typings, 'typings');
	}

	if (packageJson.exports) {
		const subpaths = traverseExports(packageJson.exports, 'exports');
		let packageFiles: string[] | undefined;
		for (const [subpath, fromProperty] of subpaths) {
			if (!subpath.includes('*')) {
				addEntry(subpath, fromProperty);
				continue;
			}

			if (!packageFiles) {
				packageFiles = await getAllFiles(packageJsonDirectory);
			}

			const [prefix, suffix] = subpath.split('*', 2);
			for (const file of packageFiles) {
				if (file.startsWith(prefix!) && file.endsWith(suffix!)) {
					addEntry(file, fromProperty);
				}
			}
		}
	}

	return entryPoints;
};

const externalizedDependencies = [
	'dependencies',
	'peerDependencies',
	'optionalDependencies',
] as const;

const getExternals = (
	packageJson: PackageJson,
) => {
	const external = new Map<string, string>();

	for (const dependencyType of externalizedDependencies) {
		const dependencyObject = packageJson[dependencyType];
		if (dependencyObject) {
			const dependencyNames = Object.keys(dependencyObject);
			for (const dependencyName of dependencyNames) {
				external.set(dependencyName, `by package.json ${dependencyType}`);
			}
		}
	}

	return external;
};

export const getPackageJson = async (
	cwd: string,
) => {
	const packageJsonPath = path.resolve(cwd, 'package.json');
	const exists = await pathExists(packageJsonPath);
	if (!exists) {
		return;
	}

	let packageJson: PackageJson;
	try {
		packageJson = await readPackageJson(packageJsonPath);
	} catch (error) {
		throw new Error(`Failed to parse package.json at ${packageJsonPath}: ${(error as Error).message}`);
	}

	return {
		getExternals: () => getExternals(packageJson),
		getDtsEntryPoints: () => getDtsEntryPoints(packageJson, path.dirname(packageJsonPath)),
		devTypePackages: (
			(!packageJson.private && packageJson.devDependencies)
				? Object.fromEntries(
					Object.keys(packageJson.devDependencies)
						.filter(dep => dep.startsWith(typesPrefix))
						.map(dep => [getOriginalPackageName(dep), dep]),
				)
				: {}
		),
	};
};
