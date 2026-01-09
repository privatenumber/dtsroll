import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'rollup';
import { up } from 'empathic/find';
import { resolveImports } from 'resolve-pkg-maps';
import type { PackageJson } from 'type-fest';

const packageJsonCache = new Map<string, PackageJson>();

const findPackageJsonUp = (cwd: string) => {
	const packageJsonPath = up('package.json', { cwd });
	if (!packageJsonPath) {
		return undefined;
	}

	const packageRoot = path.dirname(packageJsonPath);

	let packageJson = packageJsonCache.get(packageRoot);
	if (!packageJson) {
		try {
			const content = fs.readFileSync(packageJsonPath, 'utf8');
			packageJson = JSON.parse(content) as PackageJson;
			packageJsonCache.set(packageRoot, packageJson);
		} catch {
			return undefined;
		}
	}

	if (packageJson.imports) {
		return {
			imports: packageJson.imports,
			packageRoot,
		};
	}
};

export const resolveSubpathImportsPlugin = (): Plugin => ({
	name: 'resolve-subpath-imports',

	async resolveId(id, importer) {
		if (id[0] !== '#' || !importer) {
			return null;
		}

		const result = findPackageJsonUp(path.dirname(importer));
		if (!result) {
			return null;
		}

		const { imports, packageRoot } = result;

		let resolvedPaths: string[];
		try {
			// 'types' first for TypeScript-specific paths, 'import' for ESM
			// 'default' is automatically matched by resolve-pkg-maps
			resolvedPaths = resolveImports(imports, id, ['types', 'import']);
		} catch {
			return null;
		}

		if (resolvedPaths.length === 0) {
			return null;
		}

		// Delegate to subsequent plugins (e.g., node-resolve) to handle extension resolution
		return this.resolve(
			path.join(packageRoot, resolvedPaths[0]!),
			importer,
			{ skipSelf: true },
		);
	},
});
