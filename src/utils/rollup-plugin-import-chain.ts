import type { Plugin } from 'rollup';

export const createImportChainPlugin = () => {
	const importerMap = new Map<string, string>();

	const plugin: Plugin = {
		name: 'import-chain-tracker',

		buildStart: () => {
			importerMap.clear();
		},

		async resolveId(source, importer) {
			if (!importer) {
				return null;
			}
			const resolved = await this.resolve(source, importer, { skipSelf: true });
			if (resolved && !resolved.external && !importerMap.has(resolved.id)) {
				importerMap.set(resolved.id, importer);
			}
			return null;
		},
	};

	const getImportChain = (errorFileId: string): string[] => {
		const chain: string[] = [];
		let current: string | undefined = errorFileId;
		while (current) {
			chain.unshift(current);
			current = importerMap.get(current);
		}
		return chain;
	};

	return {
		plugin,
		getImportChain,
	};
};
