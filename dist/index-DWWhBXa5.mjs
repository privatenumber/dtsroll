import path from 'node:path';
import fs from 'node:fs/promises';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';

let enabled = true;
// Support both browser and node environments
const globalVar = typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
            ? global
            : {};
/**
 * Detect how much colors the current terminal supports
 */
let supportLevel = 0 /* none */;
if (globalVar.process && globalVar.process.env && globalVar.process.stdout) {
    const { FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, COLORTERM } = globalVar.process.env;
    if (NODE_DISABLE_COLORS || NO_COLOR || FORCE_COLOR === '0') {
        enabled = false;
    }
    else if (FORCE_COLOR === '1' ||
        FORCE_COLOR === '2' ||
        FORCE_COLOR === '3') {
        enabled = true;
    }
    else if (TERM === 'dumb') {
        enabled = false;
    }
    else if ('CI' in globalVar.process.env &&
        [
            'TRAVIS',
            'CIRCLECI',
            'APPVEYOR',
            'GITLAB_CI',
            'GITHUB_ACTIONS',
            'BUILDKITE',
            'DRONE',
        ].some(vendor => vendor in globalVar.process.env)) {
        enabled = true;
    }
    else {
        enabled = process.stdout.isTTY;
    }
    if (enabled) {
        // Windows supports 24bit True Colors since Windows 10 revision #14931,
        // see https://devblogs.microsoft.com/commandline/24-bit-color-in-the-windows-console/
        if (process.platform === 'win32') {
            supportLevel = 3 /* trueColor */;
        }
        else {
            if (COLORTERM && (COLORTERM === 'truecolor' || COLORTERM === '24bit')) {
                supportLevel = 3 /* trueColor */;
            }
            else if (TERM && (TERM.endsWith('-256color') || TERM.endsWith('256'))) {
                supportLevel = 2 /* ansi256 */;
            }
            else {
                supportLevel = 1 /* ansi */;
            }
        }
    }
}
let options = {
    enabled,
    supportLevel,
};
function kolorist(start, end, level = 1 /* ansi */) {
    const open = `\x1b[${start}m`;
    const close = `\x1b[${end}m`;
    const regex = new RegExp(`\\x1b\\[${end}m`, 'g');
    return (str) => {
        return options.enabled && options.supportLevel >= level
            ? open + ('' + str).replace(regex, open) + close
            : '' + str;
    };
}
const bold = kolorist(1, 22);
const dim = kolorist(2, 22);
// colors
const black = kolorist(30, 39);
const green = kolorist(32, 39);
const yellow = kolorist(33, 39);
const magenta = kolorist(35, 39);
const lightYellow = kolorist(93, 39);
const bgYellow = kolorist(43, 49);

const cwd = process.cwd();

const dtsExtension = ".d.ts";
const warningSignUnicode = "\u26A0";

const isValidIdentifier = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;
const reservedWords = /* @__PURE__ */ new Set([
  "do",
  "if",
  "in",
  "for",
  "int",
  "new",
  "try",
  "var",
  "byte",
  "case",
  "char",
  "else",
  "enum",
  "goto",
  "long",
  "null",
  "this",
  "true",
  "void",
  "with",
  "break",
  "catch",
  "class",
  "const",
  "false",
  "final",
  "float",
  "short",
  "super",
  "throw",
  "while",
  "delete",
  "double",
  "export",
  "import",
  "native",
  "public",
  "return",
  "static",
  "switch",
  "throws",
  "typeof",
  "boolean",
  "default",
  "extends",
  "finally",
  "package",
  "private",
  "abstract",
  "continue",
  "debugger",
  "function",
  "volatile",
  "interface",
  "protected",
  "transient",
  "implements",
  "instanceof",
  "synchronized"
]);
const propertyNeedsQuotes = (property) => !isValidIdentifier.test(property) || reservedWords.has(property);

const pathExists = async (filePath) => fs.access(filePath).then(() => true, () => false);

const typesPrefix = "@types/";
const getOriginalPackageName = (typePackageName) => {
  let originalPackageName = typePackageName.slice(typesPrefix.length);
  if (originalPackageName.includes("__")) {
    originalPackageName = `@${originalPackageName.replace("__", "/")}`;
  }
  return originalPackageName;
};
const getPackageName = (id) => {
  let indexOfSlash = id.indexOf("/");
  if (indexOfSlash === -1) {
    return id;
  }
  if (id[0] === "@") {
    const secondSlash = id.indexOf("/", indexOfSlash + 1);
    if (secondSlash === -1) {
      return id;
    }
    indexOfSlash = secondSlash;
  }
  return id.slice(0, indexOfSlash);
};

const readPackageJson = async (filePath) => {
  const packageJsonString = await fs.readFile(filePath, "utf8");
  return JSON.parse(packageJsonString);
};
const getDtsEntryPoints = (packageJson, packageJsonDirectory) => {
  const entryPoints = {};
  const addEntry = (subpath, from) => {
    if (!subpath.endsWith(dtsExtension)) {
      return;
    }
    const entryPath = path.join(packageJsonDirectory, subpath);
    if (!entryPoints[entryPath]) {
      entryPoints[entryPath] = from;
    }
  };
  if (packageJson.types) {
    addEntry(packageJson.types, "types");
  }
  if (packageJson.typings) {
    addEntry(packageJson.typings, "typings");
  }
  if (packageJson.exports) {
    (function gather(exportValue, propertyPath) {
      if (typeof exportValue === "string") {
        addEntry(exportValue, propertyPath);
      } else if (Array.isArray(exportValue)) {
        exportValue.forEach((value, index) => gather(value, `${propertyPath}[${index}]`));
      }
      if (typeof exportValue === "object" && exportValue) {
        for (const [property, value] of Object.entries(exportValue)) {
          const newProperty = propertyNeedsQuotes(property) ? `["${property}"]` : `.${property}`;
          gather(value, propertyPath + newProperty);
        }
      }
    })(packageJson.exports, "exports");
  }
  return entryPoints;
};
const externalizedDependencies = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies"
];
const getExternals = (packageJson) => {
  const external = /* @__PURE__ */ new Map();
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
const getPackageJson = async () => {
  const packageJsonPath = path.resolve("package.json");
  const exists = await pathExists(packageJsonPath);
  if (!exists) {
    return;
  }
  let packageJson;
  try {
    packageJson = await readPackageJson(packageJsonPath);
  } catch (error) {
    throw new Error(`Failed to parse package.json at ${packageJsonPath}: ${error.message}`);
  }
  return {
    getExternals: () => getExternals(packageJson),
    getDtsEntryPoints: () => getDtsEntryPoints(packageJson, path.dirname(packageJsonPath)),
    devTypePackages: !packageJson.private && packageJson.devDependencies ? Object.fromEntries(
      Object.keys(packageJson.devDependencies).filter((dep) => dep.startsWith(typesPrefix)).map((dep) => [getOriginalPackageName(dep), dep])
    ) : {}
  };
};

const getCommonDirectory = (filePaths) => {
  const splitPaths = filePaths.map((filePath) => filePath.split(path.sep).slice(0, -1));
  const commonPath = [];
  const [firstPath] = splitPaths;
  for (let i = 0; i < firstPath.length; i += 1) {
    const segment = firstPath[i];
    const segmentIsCommon = splitPaths.every((pathParts) => pathParts[i] === segment);
    if (!segmentIsCommon) {
      break;
    }
    commonPath.push(segment);
  }
  return commonPath.join(path.sep);
};

const validateInput = async (inputFiles) => {
  if (!inputFiles) {
    throw new Error("No input files");
  }
  const isCliInput = Array.isArray(inputFiles);
  console.log(bold(`
\u{1F4E5} Entry points${isCliInput ? "" : " in package.json"}`));
  const inputNormalized = isCliInput ? inputFiles.map((i) => [i]) : Object.entries(inputFiles);
  const validInputs = [];
  const stdout = await Promise.all(inputNormalized.map(async ([inputFile, inputSource]) => {
    const relativeInputFile = path.relative(cwd, inputFile);
    if (!inputFile.startsWith(cwd)) {
      return ` ${lightYellow(`${warningSignUnicode} ${relativeInputFile} ${dim("Ignoring file outside of cwd")}`)}`;
    }
    const notDts = !inputFile.endsWith(dtsExtension);
    if (notDts) {
      return ` ${lightYellow(`${warningSignUnicode} ${relativeInputFile} ${dim("Ignoring non-d.ts input")}`)}`;
    }
    const exists = await pathExists(inputFile);
    if (!exists) {
      return ` ${lightYellow(`${warningSignUnicode} ${relativeInputFile} ${dim("File not found")}`)}`;
    }
    validInputs.push(inputFile);
    return ` \u2192 ${green(relativeInputFile)}${inputSource ? ` ${dim(`from ${inputSource}`)}` : ""}`;
  }));
  console.log(stdout.join("\n"));
  if (validInputs.length === 0) {
    throw new Error("No input files");
  }
  return validInputs;
};

const isPath = ([firstCharacter]) => firstCharacter === "." || firstCharacter === path.sep;

const createExternalizePlugin = (configuredExternals) => {
  const resolvedBareSpecifiers = /* @__PURE__ */ new Map();
  const importPath = /* @__PURE__ */ new Map();
  const externalized = /* @__PURE__ */ new Map();
  const externalizePlugin = {
    name: "externalize",
    async resolveId(id, importer, options) {
      const packageName = !isPath(id) && getPackageName(id);
      if (packageName) {
        const externalReason = configuredExternals.get(packageName);
        if (externalReason) {
          externalized.set(packageName, externalReason);
          return {
            id,
            external: true
          };
        }
      }
      const resolved = await this.resolve(id, importer, options);
      if (resolved) {
        if (packageName) {
          resolvedBareSpecifiers.set(resolved.id, id);
        }
        if (importer && resolved.id !== importer) {
          importPath.set(resolved.id, importer);
        }
        return resolved;
      }
      if (packageName) {
        externalized.set(packageName, "because unresolvable");
      }
      return {
        id,
        external: true
      };
    }
  };
  const getPackageEntryPoint = (subpackagePath) => {
    let lastEntry = subpackagePath;
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
    getPackageEntryPoint
  };
};

const nodeModules = `${path.sep}node_modules${path.sep}`;
const removeBundledModulesPlugin = (sizeRef) => {
  let deleteFiles = [];
  return {
    name: "remove-bundled-modules",
    transform: {
      // Get size of raw code before other transformations
      order: "pre",
      handler: (code) => ({
        meta: {
          size: Buffer.byteLength(code)
        }
      })
    },
    async generateBundle(options, bundle) {
      const modules = Object.values(bundle);
      const bundledSourceFiles = Array.from(new Set(
        modules.flatMap(({ moduleIds }) => moduleIds).filter((moduleId) => moduleId.startsWith(cwd) && !moduleId.includes(nodeModules))
      ));
      const fileSizes = bundledSourceFiles.map((moduleId) => this.getModuleInfo(moduleId).meta);
      const totalSize = fileSizes.reduce((total, { size }) => total + size, 0);
      sizeRef.value = totalSize;
      const outputFiles = new Set(modules.map(({ fileName }) => path.join(options.dir, fileName)));
      deleteFiles = bundledSourceFiles.filter((moduleId) => !outputFiles.has(moduleId));
    },
    writeBundle: async () => {
      await Promise.all(
        deleteFiles.map((moduleId) => fs.rm(moduleId))
      );
    }
  };
};

const createInputMap = (input, outputDirectory) => Object.fromEntries(
  input.map((inputFile) => [
    inputFile.slice(outputDirectory.length + 1).slice(0, -dtsExtension.length),
    inputFile
  ])
);
const build = async (input, outputDirectory, externals, mode, conditions) => {
  const {
    externalizePlugin,
    externalized,
    getPackageEntryPoint
  } = createExternalizePlugin(externals);
  const sizeRef = {};
  const rollupConfig = {
    input: createInputMap(input, outputDirectory),
    output: {
      // sourcemap: true,
      dir: outputDirectory,
      chunkFileNames: "_dtsroll-chunks/[name].ts"
    },
    plugins: [
      externalizePlugin,
      removeBundledModulesPlugin(sizeRef),
      nodeResolve({
        extensions: [".ts", dtsExtension],
        exportConditions: conditions
      }),
      dts({
        respectExternal: true
        /**
         * Setting a tsconfig or compilerOptions shouldn't be necessary since
         * we're dealing with pre-compiled d.ts files
         *
         * But may be something we need to support if we want to support
         * aliases in the future
         */
      })
    ]
  };
  const rollupBuild = await rollup(rollupConfig);
  const built = await rollupBuild[mode](rollupConfig.output);
  await rollupBuild.close();
  return {
    built,
    externalized,
    getPackageEntryPoint,
    sourceSize: sizeRef.value
  };
};

const dtsroll = async ({
  inputs,
  external,
  conditions,
  dryRun
} = {}) => {
  const pkgJson = await getPackageJson();
  const externals = pkgJson ? pkgJson.getExternals() : /* @__PURE__ */ new Map();
  if (external && external.length > 0) {
    if (pkgJson) {
      console.warn(`${yellow("Warning:")} The --external flag is only supported when there is no package.json`);
    } else {
      for (const externalDependency of external) {
        externals.set(externalDependency, "by --external flag");
      }
    }
  }
  const input = await validateInput(
    inputs && inputs.length > 0 ? inputs.map((file) => path.resolve(file)) : pkgJson?.getDtsEntryPoints()
  );
  const outputDirectory = getCommonDirectory(input);
  const {
    built,
    externalized,
    getPackageEntryPoint,
    sourceSize
  } = await build(
    input,
    outputDirectory,
    externals,
    dryRun ? "generate" : "write",
    conditions
  );
  let outputSize = 0;
  const outputEntries = [];
  const outputChunks = [];
  const moduleImports = /* @__PURE__ */ new Set();
  for (const file of built.output) {
    const size = Buffer.byteLength(file.code);
    outputSize += size;
    const moduleToPackage = Object.fromEntries(
      file.moduleIds.map((moduleId) => [moduleId, getPackageEntryPoint(moduleId)])
    );
    const chunkWithSize = Object.assign(file, {
      size,
      moduleToPackage
    });
    if (chunkWithSize.isEntry) {
      outputEntries.push(chunkWithSize);
    } else {
      outputChunks.push(chunkWithSize);
    }
    for (const id of file.imports) {
      moduleImports.add(getPackageName(id));
    }
  }
  const externalPackages = [];
  moduleImports.forEach((importedSpecifier) => {
    const reason = externalized.get(importedSpecifier);
    if (reason) {
      externalPackages.push([
        importedSpecifier,
        reason,
        pkgJson?.devTypePackages?.[importedSpecifier]
      ]);
    }
  });
  return {
    outputDirectory,
    output: {
      entries: outputEntries,
      chunks: outputChunks
    },
    size: {
      input: sourceSize,
      output: outputSize
    },
    externals: externalPackages
  };
};

export { black as a, bgYellow as b, cwd as c, dtsroll as d, bold as e, dim as f, green as g, magenta as m, yellow as y };
