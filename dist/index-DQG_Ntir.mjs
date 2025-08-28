import path from 'node:path';
import fs from 'node:fs/promises';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';
import byteSize from 'byte-size';

let enabled = true;
const globalVar = typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {};
let supportLevel = 0;
if (globalVar.process && globalVar.process.env && globalVar.process.stdout) {
  const { FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, COLORTERM } = globalVar.process.env;
  if (NODE_DISABLE_COLORS || NO_COLOR || FORCE_COLOR === "0") {
    enabled = false;
  } else if (FORCE_COLOR === "1" || FORCE_COLOR === "2" || FORCE_COLOR === "3") {
    enabled = true;
  } else if (TERM === "dumb") {
    enabled = false;
  } else if ("CI" in globalVar.process.env && [
    "TRAVIS",
    "CIRCLECI",
    "APPVEYOR",
    "GITLAB_CI",
    "GITHUB_ACTIONS",
    "BUILDKITE",
    "DRONE"
  ].some((vendor) => vendor in globalVar.process.env)) {
    enabled = true;
  } else {
    enabled = process.stdout.isTTY;
  }
  if (enabled) {
    if (process.platform === "win32") {
      supportLevel = 3;
    } else {
      if (COLORTERM && (COLORTERM === "truecolor" || COLORTERM === "24bit")) {
        supportLevel = 3;
      } else if (TERM && (TERM.endsWith("-256color") || TERM.endsWith("256"))) {
        supportLevel = 2;
      } else {
        supportLevel = 1;
      }
    }
  }
}
let options = {
  enabled,
  supportLevel
};
function kolorist(start, end, level = 1) {
  const open = `\x1B[${start}m`;
  const close = `\x1B[${end}m`;
  const regex = new RegExp(`\\x1b\\[${end}m`, "g");
  return (str) => {
    return options.enabled && options.supportLevel >= level ? open + ("" + str).replace(regex, open) + close : "" + str;
  };
}
const bold = kolorist(1, 22);
const dim = kolorist(2, 22);
const underline = kolorist(4, 24);
const black = kolorist(30, 39);
const red = kolorist(31, 39);
const green = kolorist(32, 39);
const yellow = kolorist(33, 39);
const magenta = kolorist(35, 39);
const lightYellow = kolorist(93, 39);
const bgYellow = kolorist(43, 49);

const cwd = process.cwd();

const isPath = (filePath) => filePath[0] === "." || path.isAbsolute(filePath);
const normalizePath = (filepath) => filepath.replaceAll("\\", "/");

const warningSignUnicode = "\u26A0";
const warningPrefix = yellow("Warning:");
const logOutput = (dtsOutput) => {
  console.log(underline("dtsroll"));
  const { inputs } = dtsOutput;
  const isCliInput = inputs[0]?.[1] === void 0;
  console.log(bold(`
\u{1F4E5} Entry points${isCliInput ? "" : " in package.json"}`));
  console.log(
    inputs.map(([inputFile, inputSource, error]) => {
      const relativeInputFile = path.relative(cwd, inputFile);
      const logPath2 = normalizePath(
        relativeInputFile.length < inputFile.length ? relativeInputFile : inputFile
      );
      if (error) {
        return ` ${lightYellow(`${warningSignUnicode} ${logPath2} ${dim(error)}`)}`;
      }
      return ` \u2192 ${green(logPath2)}${inputSource ? ` ${dim(`from ${inputSource}`)}` : ""}`;
    }).join("\n")
  );
  if ("error" in dtsOutput) {
    console.error(`${red("Error:")} ${dtsOutput.error}`);
    return;
  }
  const {
    outputDirectory,
    output: {
      entries: outputEntries,
      chunks: outputChunks
    },
    size,
    externals
  } = dtsOutput;
  const outputDirectoryRelative = path.relative(cwd, outputDirectory);
  const logPath = `${normalizePath(
    outputDirectoryRelative.length < outputDirectory.length ? outputDirectoryRelative : outputDirectory
  )}/`;
  const logChunk = ({
    file,
    indent,
    bullet,
    color
  }) => {
    const sizeFormatted = byteSize(file.size).toString();
    let log = `${indent}${bullet} ${dim(color(logPath))}${color(file.fileName)} ${sizeFormatted}`;
    const { moduleIds, moduleToPackage } = file;
    log += `
${moduleIds.sort().map((moduleId, index) => {
      const isLast = index === moduleIds.length - 1;
      const prefix = `${indent}   ${isLast ? "\u2514\u2500 " : "\u251C\u2500 "}`;
      const relativeModuleId = path.relative(cwd, moduleId);
      const logModuleId = normalizePath(
        relativeModuleId.length < moduleId.length ? relativeModuleId : moduleId
      );
      const bareSpecifier = moduleToPackage[moduleId];
      if (bareSpecifier) {
        return `${prefix}${dim(`${magenta(bareSpecifier)} (${logModuleId})`)}`;
      }
      return `${prefix}${dim(logModuleId)}`;
    }).join("\n")}`;
    return log;
  };
  console.log(bold("\n\u{1F4A0} Bundled output"));
  console.log(
    outputEntries.map((file) => logChunk({
      file,
      indent: " ",
      bullet: "\u25CF",
      color: green
    })).join("\n\n")
  );
  if (outputChunks.length > 0) {
    console.log(bold("\n Chunks"));
    console.log(
      outputChunks.map((file) => logChunk({
        file,
        indent: "   ",
        bullet: "\u25A0",
        color: yellow
      })).join("\n\n")
    );
  }
  console.log(bold("\n\u2696\uFE0F Size savings"));
  const difference = size.input - size.output;
  const direction = difference > 0 ? "decrease" : "increase";
  const percentage = (Math.abs(difference / size.input) * 100).toFixed(0);
  console.log(`   Input source size:   ${byteSize(size.input).toString()}`);
  console.log(`   Bundled output size: ${byteSize(size.output).toString()}${difference === 0 ? "" : ` (${percentage}% ${direction})`}`);
  if (externals.length > 0) {
    console.log(bold("\n\u{1F4E6} External packages"));
    console.log(
      externals.map(([packageName, reason, devTypePackage]) => {
        let stdout = ` \u2500 ${magenta(packageName)} ${dim(`externalized ${reason}`)}`;
        if (devTypePackage) {
          stdout += `
   ${warningPrefix} ${magenta(devTypePackage)} should not be in devDependencies if ${magenta(packageName)} is externalized`;
        }
        return stdout;
      }).sort().join("\n")
    );
  }
};

const dtsExtensions = [".d.ts", ".d.cts", ".d.mts"];
const isDts = (fileName) => dtsExtensions.some((extension) => fileName.endsWith(extension));

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

const getAllFiles = async (directoryPath, dontShortenPath) => {
  const directoryFiles = await fs.readdir(directoryPath, { withFileTypes: true });
  const fileTree = await Promise.all(
    directoryFiles.map(async (entry) => {
      const filePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const files = await getAllFiles(filePath, true);
        return dontShortenPath ? files : files.map((file) => `./${path.relative(directoryPath, file)}`);
      }
      return dontShortenPath ? filePath : `./${path.relative(directoryPath, filePath)}`;
    })
  );
  return fileTree.flat();
};

const readPackageJson = async (filePath) => {
  const packageJsonString = await fs.readFile(filePath, "utf8");
  return JSON.parse(packageJsonString);
};
const traverseExports = (exportValue, propertyPath) => {
  if (typeof exportValue === "string") {
    return [[exportValue, propertyPath]];
  }
  if (Array.isArray(exportValue)) {
    return exportValue.flatMap((value, index) => traverseExports(value, `${propertyPath}[${index}]`));
  }
  if (typeof exportValue === "object" && exportValue !== null) {
    return Object.entries(exportValue).flatMap(([property, value]) => {
      const newProperty = propertyNeedsQuotes(property) ? `["${property}"]` : `.${property}`;
      return traverseExports(value, propertyPath + newProperty);
    });
  }
  return [];
};
const getDtsEntryPoints = async (packageJson, packageJsonDirectory) => {
  const entryPoints = {};
  const addEntry = (subpath, from) => {
    if (!isDts(subpath)) {
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
    const subpaths = traverseExports(packageJson.exports, "exports");
    let packageFiles;
    for (const [subpath, fromProperty] of subpaths) {
      if (!subpath.includes("*")) {
        addEntry(subpath, fromProperty);
        continue;
      }
      if (!packageFiles) {
        packageFiles = await getAllFiles(packageJsonDirectory);
      }
      const [prefix, suffix] = subpath.split("*", 2);
      for (const file of packageFiles) {
        if (file.startsWith(prefix) && file.endsWith(suffix)) {
          addEntry(file, fromProperty);
        }
      }
    }
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
const getPackageJson = async (cwd) => {
  const packageJsonPath = path.resolve(cwd, "package.json");
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
  const inputNormalized = isCliInput ? inputFiles.map((i) => [i]) : Object.entries(inputFiles);
  return await Promise.all(inputNormalized.map(
    async ([inputFile, inputSource]) => {
      if (!isDts(inputFile)) {
        return [inputFile, inputSource, "Ignoring non-d.ts input"];
      }
      const exists = await pathExists(inputFile);
      if (!exists) {
        return [inputFile, inputSource, "File not found"];
      }
      return [inputFile, inputSource];
    }
  ));
};

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
        if (
          // Self imports happen
          importer && resolved.id !== importer && importPath.get(importer) !== resolved.id
        ) {
          importPath.set(resolved.id, importer);
        }
        return resolved;
      }
      if (packageName) {
        externalized.set(packageName, "because unresolvable");
        return {
          id,
          external: true
        };
      }
    }
  };
  const getPackageEntryPoint = (subpackagePath) => {
    let i = 0;
    let lastEntry = subpackagePath;
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
    getPackageEntryPoint
  };
};

const nodeModules = `${path.sep}node_modules${path.sep}`;
const removeBundledModulesPlugin = (outputDirectory, sizeRef) => {
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
      const bundledFiles = Array.from(new Set(modules.flatMap(({ moduleIds }) => moduleIds)));
      const fileSizes = bundledFiles.map((moduleId) => this.getModuleInfo(moduleId).meta);
      const totalSize = fileSizes.reduce((total, { size }) => total + size, 0);
      sizeRef.value = totalSize;
      const outputFiles = new Set(modules.map(({ fileName }) => path.join(options.dir, fileName)));
      deleteFiles = bundledFiles.filter((moduleId) => (
        // To avoid deleting files from symlinked dependencies
        moduleId.startsWith(outputDirectory) && !moduleId.includes(nodeModules) && !outputFiles.has(moduleId)
      ));
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
    inputFile.slice(outputDirectory.length + 1),
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
      entryFileNames: "[name]",
      chunkFileNames: "_dtsroll-chunks/[hash]-[name].ts"
    },
    plugins: [
      externalizePlugin,
      removeBundledModulesPlugin(outputDirectory, sizeRef),
      nodeResolve({
        extensions: [".ts", ...dtsExtensions],
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
  cwd = process.cwd(),
  inputs,
  external,
  conditions,
  dryRun
} = {}) => {
  const pkgJson = await getPackageJson(cwd);
  const externals = pkgJson ? pkgJson.getExternals() : /* @__PURE__ */ new Map();
  if (external && external.length > 0) {
    if (pkgJson) {
      console.warn(`${warningPrefix} The --external flag is only supported when there is no package.json`);
    } else {
      for (const externalDependency of external) {
        externals.set(externalDependency, "by --external flag");
      }
    }
  }
  const manualInput = inputs && inputs.length > 0;
  const validatedInputs = await validateInput(
    manualInput ? inputs.map((file) => path.resolve(file)) : await pkgJson?.getDtsEntryPoints()
  );
  const inputFiles = validatedInputs.filter((input) => !input[2]).map(([file]) => file);
  if (inputFiles.length === 0) {
    return {
      inputs: validatedInputs,
      error: "No input files"
    };
  }
  const outputDirectory = getCommonDirectory(inputFiles);
  const {
    built,
    externalized,
    getPackageEntryPoint,
    sourceSize
  } = await build(
    inputFiles,
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
    inputs: validatedInputs,
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

export { black as a, bgYellow as b, dtsroll as d, logOutput as l };
