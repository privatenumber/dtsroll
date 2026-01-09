import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'rollup';
import convert from 'convert-source-map';
import { dtsExtensions } from '../../utils/dts-extensions.js';
import { normalizePath } from '../../utils/path-utils.js';

const tryReadFile = async (filePath: string) => {
	try {
		return await fs.promises.readFile(filePath, 'utf8');
	} catch {
		return null;
	}
};

type SourceMapV3 = {
	file?: string;
	names: string[];
	sourceRoot?: string;
	sources: string[];
	sourcesContent?: (string | null)[];
	mappings: string;
	version: number;
};

const loadSourceMap = async (
	codePath: string,
	code: string,
) => {
	// Try the common case: .d.ts.map file next to .d.ts
	const adjacentMapPath = `${codePath}.map`;
	const adjacentMapContent = await tryReadFile(adjacentMapPath);
	if (adjacentMapContent) {
		try {
			const converter = convert.fromJSON(adjacentMapContent);
			return {
				map: converter.toObject() as SourceMapV3,
				mapPath: adjacentMapPath,
			};
		} catch {
			// Malformed JSON, continue to try other methods
		}
	}

	// Try inline sourcemap (data URL)
	try {
		const inlineConverter = convert.fromSource(code);
		if (inlineConverter) {
			return {
				map: inlineConverter.toObject() as SourceMapV3,
				mapPath: codePath,
			};
		}
	} catch {
		// Failed to parse inline sourcemap, continue
	}

	// Try file reference from sourceMappingURL comment
	try {
		// Extract the file path from the comment
		const regex = new RegExp(convert.mapFileCommentRegex.source);
		const commentMatch = regex.exec(code);
		const referencedPath = commentMatch?.[1] ?? commentMatch?.[2];
		if (!referencedPath) {
			return;
		}

		const mapFilePath = path.join(path.dirname(codePath), referencedPath);
		const mapContent = await tryReadFile(mapFilePath);
		if (!mapContent) {
			return;
		}

		const converter = convert.fromJSON(mapContent);
		return {
			map: converter.toObject() as SourceMapV3,
			mapPath: mapFilePath,
		};
	} catch {
		// Failed to load file reference, sourcemap not available
	}
};

type ResolvedSourceMap = {
	sources: string[];
	sourcesContent: string[];
};

/**
 * Plugin to load existing .d.ts.map files and chain them through the bundle.
 * This allows the final sourcemap to point back to original .ts source files
 * instead of intermediate .d.ts files.
 */
export const loadInputSourcemapsPlugin = (): Plugin => {
	// Track input sourcemaps for fixing empty output sourcemaps
	const inputSourcemaps = new Map<string, ResolvedSourceMap>();

	return {
		name: 'load-input-sourcemaps',

		async load(id) {
			// Only handle .d.ts files
			const isDts = dtsExtensions.some(extension => id.endsWith(extension));
			if (!isDts) {
				return null;
			}

			const code = await tryReadFile(id);
			if (!code) {
				return null;
			}

			const result = await loadSourceMap(id, code);
			if (!result) {
				return { code };
			}

			const { map: inputMap, mapPath } = result;

			// Resolve source paths relative to the map file location
			const sourceRoot = path.resolve(path.dirname(mapPath), inputMap.sourceRoot ?? '.');
			const sources = inputMap.sources.map(
				source => (path.isAbsolute(source) ? source : path.resolve(sourceRoot, source)),
			);

			// Load missing sourcesContent and filter out nulls for Rollup compatibility
			const sourcesContentRaw = await Promise.all(
				sources.map(
					async (source, index) => inputMap.sourcesContent?.[index] ?? tryReadFile(source),
				),
			);
			const sourcesContent = sourcesContentRaw.filter(
				(content): content is string => content !== null,
			);

			// Store for fixing empty sourcemaps later
			inputSourcemaps.set(id, {
				sources,
				sourcesContent,
			});

			return {
				code,
				map: {
					version: inputMap.version,
					names: inputMap.names,
					sources,
					mappings: inputMap.mappings,
					...(sourcesContent.length > 0 ? { sourcesContent } : {}),
					...(inputMap.file ? { file: inputMap.file } : {}),
				},
			};
		},

		async writeBundle(options, bundle) {
			// Fix empty sourcemaps for empty chunks
			// Rollup generates empty sourcemaps for empty files, but we want to preserve
			// the original source references for IDE navigation
			const outputDir = options.dir ?? path.dirname(options.file ?? '');
			if (!outputDir) {
				return;
			}

			for (const [fileName, chunk] of Object.entries(bundle)) {
				if (chunk.type !== 'chunk' || !chunk.map) {
					continue;
				}

				// Only fix if output sourcemap has no sources but we have input sources
				if (chunk.map.sources.length > 0) {
					continue;
				}

				// Find the input sourcemap for this chunk's entry module
				const entryModule = chunk.facadeModuleId;
				if (!entryModule) {
					continue;
				}

				const inputSourcemap = inputSourcemaps.get(entryModule);
				if (!inputSourcemap || inputSourcemap.sources.length === 0) {
					continue;
				}

				// Rewrite the sourcemap file with preserved sources
				const mapFileName = `${fileName}.map`;
				const mapPath = path.join(outputDir, mapFileName);

				// Make sources relative to the output file for portability
				const outputFileDir = path.dirname(path.join(outputDir, fileName));
				const relativeSources = inputSourcemap.sources.map(
					source => normalizePath(path.relative(outputFileDir, source)),
				);

				const fixedMap = {
					...chunk.map,
					sources: relativeSources,
					sourcesContent: inputSourcemap.sourcesContent.length > 0
						? inputSourcemap.sourcesContent
						: undefined,
				};
				await fs.promises.writeFile(mapPath, JSON.stringify(fixedMap));
			}
		},
	};
};
