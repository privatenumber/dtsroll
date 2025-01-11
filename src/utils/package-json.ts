import fs from 'node:fs/promises';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { isDts } from './dts-extensions.js';
import { propertyNeedsQuotes } from './property-needs-quotes.js';
import { pathExists } from './path-exists.js';
import { typesPrefix, getOriginalPackageName } from './package-name.js';

const readPackageJson = async (
	filePath: string,
) => {
	const packageJsonString = await fs.readFile(filePath, 'utf8');
	return JSON.parse(packageJsonString) as PackageJson;
};

const getDtsEntryPoints = (
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
		(function gather(
			exportValue: PackageJson['exports'],
			propertyPath: string,
		) {
			if (typeof exportValue === 'string') {
				addEntry(exportValue, propertyPath);
			} else if (Array.isArray(exportValue)) {
				exportValue.forEach((value, index) => gather(value, `${propertyPath}[${index}]`));
			} if (typeof exportValue === 'object' && exportValue) {
				for (const [property, value] of Object.entries(exportValue)) {
					const newProperty = propertyNeedsQuotes(property) ? `["${property}"]` : `.${property}`;
					gather(value, propertyPath + newProperty);
				}
			}
		})(packageJson.exports, 'exports');
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
