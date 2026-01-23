import{createRequire as _pkgrollCR}from"node:module";const require=_pkgrollCR(import.meta.url);import * as path from 'node:path';
import path__default from 'node:path';
import fs from 'node:fs/promises';
import { rollup } from 'rollup';
import ts from 'typescript';
import { createRequire } from 'node:module';
import convert$1 from 'convert-source-map';
import nodeResolve from '@rollup/plugin-node-resolve';
import { up } from 'empathic/find';
import { resolveImports } from 'resolve-pkg-maps';
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

const isPath = (filePath) => filePath[0] === "." || path__default.isAbsolute(filePath);
const normalizePath$1 = (filepath) => filepath.replaceAll("\\", "/");
const getDisplayPath = (fullPath) => {
  const relativePath = path__default.relative(cwd, fullPath);
  return normalizePath$1(
    relativePath.length < fullPath.length ? relativePath : fullPath
  );
};

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
      const logPath2 = getDisplayPath(inputFile);
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
  const logPath = `${getDisplayPath(outputDirectory)}/`;
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
      const logModuleId = getDisplayPath(moduleId);
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

class DtsrollBuildError extends Error {
  id;
  importChain;
  constructor(message, id, importChain) {
    super(message);
    this.name = "DtsrollBuildError";
    this.id = id;
    this.importChain = importChain;
  }
}

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
      const filePath = path__default.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const files = await getAllFiles(filePath, true);
        return dontShortenPath ? files : files.map((file) => `./${normalizePath$1(path__default.relative(directoryPath, file))}`);
      }
      return dontShortenPath ? filePath : `./${normalizePath$1(path__default.relative(directoryPath, filePath))}`;
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
    const entryPath = path__default.join(packageJsonDirectory, subpath);
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
  const packageJsonPath = path__default.resolve(cwd, "package.json");
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
    getDtsEntryPoints: () => getDtsEntryPoints(packageJson, path__default.dirname(packageJsonPath)),
    devTypePackages: !packageJson.private && packageJson.devDependencies ? Object.fromEntries(
      Object.keys(packageJson.devDependencies).filter((dep) => dep.startsWith(typesPrefix)).map((dep) => [getOriginalPackageName(dep), dep])
    ) : {}
  };
};

const getCommonDirectory = (filePaths) => {
  const splitPaths = filePaths.map((filePath) => filePath.split(path__default.sep).slice(0, -1));
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
  return commonPath.join(path__default.sep);
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

var comma = ",".charCodeAt(0);
var semicolon = ";".charCodeAt(0);
var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var intToChar = new Uint8Array(64);
var charToInt = new Uint8Array(128);
for (let i = 0; i < chars.length; i++) {
  const c = chars.charCodeAt(i);
  intToChar[i] = c;
  charToInt[c] = i;
}
function decodeInteger(reader, relative) {
  let value = 0;
  let shift = 0;
  let integer = 0;
  do {
    const c = reader.next();
    integer = charToInt[c];
    value |= (integer & 31) << shift;
    shift += 5;
  } while (integer & 32);
  const shouldNegate = value & 1;
  value >>>= 1;
  if (shouldNegate) {
    value = -2147483648 | -value;
  }
  return relative + value;
}
function encodeInteger(builder, num, relative) {
  let delta = num - relative;
  delta = delta < 0 ? -delta << 1 | 1 : delta << 1;
  do {
    let clamped = delta & 31;
    delta >>>= 5;
    if (delta > 0) clamped |= 32;
    builder.write(intToChar[clamped]);
  } while (delta > 0);
  return num;
}
function hasMoreVlq(reader, max) {
  if (reader.pos >= max) return false;
  return reader.peek() !== comma;
}
var bufLength = 1024 * 16;
var td = typeof TextDecoder !== "undefined" ? /* @__PURE__ */ new TextDecoder() : typeof Buffer !== "undefined" ? {
  decode(buf) {
    const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    return out.toString();
  }
} : {
  decode(buf) {
    let out = "";
    for (let i = 0; i < buf.length; i++) {
      out += String.fromCharCode(buf[i]);
    }
    return out;
  }
};
var StringWriter = class {
  constructor() {
    this.pos = 0;
    this.out = "";
    this.buffer = new Uint8Array(bufLength);
  }
  write(v) {
    const { buffer } = this;
    buffer[this.pos++] = v;
    if (this.pos === bufLength) {
      this.out += td.decode(buffer);
      this.pos = 0;
    }
  }
  flush() {
    const { buffer, out, pos } = this;
    return pos > 0 ? out + td.decode(buffer.subarray(0, pos)) : out;
  }
};
var StringReader = class {
  constructor(buffer) {
    this.pos = 0;
    this.buffer = buffer;
  }
  next() {
    return this.buffer.charCodeAt(this.pos++);
  }
  peek() {
    return this.buffer.charCodeAt(this.pos);
  }
  indexOf(char) {
    const { buffer, pos } = this;
    const idx = buffer.indexOf(char, pos);
    return idx === -1 ? buffer.length : idx;
  }
};
function decode(mappings) {
  const { length } = mappings;
  const reader = new StringReader(mappings);
  const decoded = [];
  let genColumn = 0;
  let sourcesIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let namesIndex = 0;
  do {
    const semi = reader.indexOf(";");
    const line = [];
    let sorted = true;
    let lastCol = 0;
    genColumn = 0;
    while (reader.pos < semi) {
      let seg;
      genColumn = decodeInteger(reader, genColumn);
      if (genColumn < lastCol) sorted = false;
      lastCol = genColumn;
      if (hasMoreVlq(reader, semi)) {
        sourcesIndex = decodeInteger(reader, sourcesIndex);
        sourceLine = decodeInteger(reader, sourceLine);
        sourceColumn = decodeInteger(reader, sourceColumn);
        if (hasMoreVlq(reader, semi)) {
          namesIndex = decodeInteger(reader, namesIndex);
          seg = [genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex];
        } else {
          seg = [genColumn, sourcesIndex, sourceLine, sourceColumn];
        }
      } else {
        seg = [genColumn];
      }
      line.push(seg);
      reader.pos++;
    }
    if (!sorted) sort(line);
    decoded.push(line);
    reader.pos = semi + 1;
  } while (reader.pos <= length);
  return decoded;
}
function sort(line) {
  line.sort(sortComparator$1);
}
function sortComparator$1(a, b) {
  return a[0] - b[0];
}
function encode(decoded) {
  const writer = new StringWriter();
  let sourcesIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let namesIndex = 0;
  for (let i = 0; i < decoded.length; i++) {
    const line = decoded[i];
    if (i > 0) writer.write(semicolon);
    if (line.length === 0) continue;
    let genColumn = 0;
    for (let j = 0; j < line.length; j++) {
      const segment = line[j];
      if (j > 0) writer.write(comma);
      genColumn = encodeInteger(writer, segment[0], genColumn);
      if (segment.length === 1) continue;
      sourcesIndex = encodeInteger(writer, segment[1], sourcesIndex);
      sourceLine = encodeInteger(writer, segment[2], sourceLine);
      sourceColumn = encodeInteger(writer, segment[3], sourceColumn);
      if (segment.length === 4) continue;
      namesIndex = encodeInteger(writer, segment[4], namesIndex);
    }
  }
  return writer.flush();
}

const schemeRegex = /^[\w+.-]+:\/\//;
const urlRegex = /^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?(\?[^#]*)?(#.*)?/;
const fileRegex = /^file:(?:\/\/((?![a-z]:)[^/#?]*)?)?(\/?[^#?]*)(\?[^#]*)?(#.*)?/i;
function isAbsoluteUrl(input) {
  return schemeRegex.test(input);
}
function isSchemeRelativeUrl(input) {
  return input.startsWith("//");
}
function isAbsolutePath(input) {
  return input.startsWith("/");
}
function isFileUrl(input) {
  return input.startsWith("file:");
}
function isRelative(input) {
  return /^[.?#]/.test(input);
}
function parseAbsoluteUrl(input) {
  const match = urlRegex.exec(input);
  return makeUrl(match[1], match[2] || "", match[3], match[4] || "", match[5] || "/", match[6] || "", match[7] || "");
}
function parseFileUrl(input) {
  const match = fileRegex.exec(input);
  const path = match[2];
  return makeUrl("file:", "", match[1] || "", "", isAbsolutePath(path) ? path : "/" + path, match[3] || "", match[4] || "");
}
function makeUrl(scheme, user, host, port, path, query, hash) {
  return {
    scheme,
    user,
    host,
    port,
    path,
    query,
    hash,
    type: 7
  };
}
function parseUrl(input) {
  if (isSchemeRelativeUrl(input)) {
    const url2 = parseAbsoluteUrl("http:" + input);
    url2.scheme = "";
    url2.type = 6;
    return url2;
  }
  if (isAbsolutePath(input)) {
    const url2 = parseAbsoluteUrl("http://foo.com" + input);
    url2.scheme = "";
    url2.host = "";
    url2.type = 5;
    return url2;
  }
  if (isFileUrl(input))
    return parseFileUrl(input);
  if (isAbsoluteUrl(input))
    return parseAbsoluteUrl(input);
  const url = parseAbsoluteUrl("http://foo.com/" + input);
  url.scheme = "";
  url.host = "";
  url.type = input ? input.startsWith("?") ? 3 : input.startsWith("#") ? 2 : 4 : 1;
  return url;
}
function stripPathFilename(path) {
  if (path.endsWith("/.."))
    return path;
  const index = path.lastIndexOf("/");
  return path.slice(0, index + 1);
}
function mergePaths(url, base) {
  normalizePath(base, base.type);
  if (url.path === "/") {
    url.path = base.path;
  } else {
    url.path = stripPathFilename(base.path) + url.path;
  }
}
function normalizePath(url, type) {
  const rel = type <= 4;
  const pieces = url.path.split("/");
  let pointer = 1;
  let positive = 0;
  let addTrailingSlash = false;
  for (let i = 1; i < pieces.length; i++) {
    const piece = pieces[i];
    if (!piece) {
      addTrailingSlash = true;
      continue;
    }
    addTrailingSlash = false;
    if (piece === ".")
      continue;
    if (piece === "..") {
      if (positive) {
        addTrailingSlash = true;
        positive--;
        pointer--;
      } else if (rel) {
        pieces[pointer++] = piece;
      }
      continue;
    }
    pieces[pointer++] = piece;
    positive++;
  }
  let path = "";
  for (let i = 1; i < pointer; i++) {
    path += "/" + pieces[i];
  }
  if (!path || addTrailingSlash && !path.endsWith("/..")) {
    path += "/";
  }
  url.path = path;
}
function resolve(input, base) {
  if (!input && !base)
    return "";
  const url = parseUrl(input);
  let inputType = url.type;
  if (base && inputType !== 7) {
    const baseUrl = parseUrl(base);
    const baseType = baseUrl.type;
    switch (inputType) {
      case 1:
        url.hash = baseUrl.hash;
      // fall through
      case 2:
        url.query = baseUrl.query;
      // fall through
      case 3:
      case 4:
        mergePaths(url, baseUrl);
      // fall through
      case 5:
        url.user = baseUrl.user;
        url.host = baseUrl.host;
        url.port = baseUrl.port;
      // fall through
      case 6:
        url.scheme = baseUrl.scheme;
    }
    if (baseType > inputType)
      inputType = baseType;
  }
  normalizePath(url, inputType);
  const queryHash = url.query + url.hash;
  switch (inputType) {
    // This is impossible, because of the empty checks at the start of the function.
    // case UrlType.Empty:
    case 2:
    case 3:
      return queryHash;
    case 4: {
      const path = url.path.slice(1);
      if (!path)
        return queryHash || ".";
      if (isRelative(base || input) && !isRelative(path)) {
        return "./" + path + queryHash;
      }
      return path + queryHash;
    }
    case 5:
      return url.path + queryHash;
    default:
      return url.scheme + "//" + url.user + url.host + url.port + url.path + queryHash;
  }
}

function stripFilename(path) {
  if (!path) return "";
  const index = path.lastIndexOf("/");
  return path.slice(0, index + 1);
}
function resolver(mapUrl, sourceRoot) {
  const from = stripFilename(mapUrl);
  const prefix = sourceRoot ? sourceRoot + "/" : "";
  return (source) => resolve(prefix + (source || ""), from);
}
var COLUMN$1 = 0;
function maybeSort(mappings, owned) {
  const unsortedIndex = nextUnsortedSegmentLine(mappings, 0);
  if (unsortedIndex === mappings.length) return mappings;
  if (!owned) mappings = mappings.slice();
  for (let i = unsortedIndex; i < mappings.length; i = nextUnsortedSegmentLine(mappings, i + 1)) {
    mappings[i] = sortSegments(mappings[i], owned);
  }
  return mappings;
}
function nextUnsortedSegmentLine(mappings, start) {
  for (let i = start; i < mappings.length; i++) {
    if (!isSorted(mappings[i])) return i;
  }
  return mappings.length;
}
function isSorted(line) {
  for (let j = 1; j < line.length; j++) {
    if (line[j][COLUMN$1] < line[j - 1][COLUMN$1]) {
      return false;
    }
  }
  return true;
}
function sortSegments(line, owned) {
  if (!owned) line = line.slice();
  return line.sort(sortComparator);
}
function sortComparator(a, b) {
  return a[COLUMN$1] - b[COLUMN$1];
}
var found = false;
function binarySearch(haystack, needle, low, high) {
  while (low <= high) {
    const mid = low + (high - low >> 1);
    const cmp = haystack[mid][COLUMN$1] - needle;
    if (cmp === 0) {
      found = true;
      return mid;
    }
    if (cmp < 0) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  found = false;
  return low - 1;
}
function lowerBound(haystack, needle, index) {
  for (let i = index - 1; i >= 0; index = i--) {
    if (haystack[i][COLUMN$1] !== needle) break;
  }
  return index;
}
function memoizedState() {
  return {
    lastKey: -1,
    lastNeedle: -1,
    lastIndex: -1
  };
}
function memoizedBinarySearch(haystack, needle, state, key) {
  const { lastKey, lastNeedle, lastIndex } = state;
  let low = 0;
  let high = haystack.length - 1;
  if (key === lastKey) {
    if (needle === lastNeedle) {
      found = lastIndex !== -1 && haystack[lastIndex][COLUMN$1] === needle;
      return lastIndex;
    }
    if (needle >= lastNeedle) {
      low = lastIndex === -1 ? 0 : lastIndex;
    } else {
      high = lastIndex;
    }
  }
  state.lastKey = key;
  state.lastNeedle = needle;
  return state.lastIndex = binarySearch(haystack, needle, low, high);
}
function parse$1(map) {
  return typeof map === "string" ? JSON.parse(map) : map;
}
var TraceMap = class {
  constructor(map, mapUrl) {
    const isString = typeof map === "string";
    if (!isString && map._decodedMemo) return map;
    const parsed = parse$1(map);
    const { version, file, names, sourceRoot, sources, sourcesContent } = parsed;
    this.version = version;
    this.file = file;
    this.names = names || [];
    this.sourceRoot = sourceRoot;
    this.sources = sources;
    this.sourcesContent = sourcesContent;
    this.ignoreList = parsed.ignoreList || parsed.x_google_ignoreList || void 0;
    const resolve = resolver(mapUrl, sourceRoot);
    this.resolvedSources = sources.map(resolve);
    const { mappings } = parsed;
    if (typeof mappings === "string") {
      this._encoded = mappings;
      this._decoded = void 0;
    } else if (Array.isArray(mappings)) {
      this._encoded = void 0;
      this._decoded = maybeSort(mappings, isString);
    } else if (parsed.sections) {
      throw new Error(`TraceMap passed sectioned source map, please use FlattenMap export instead`);
    } else {
      throw new Error(`invalid source map: ${JSON.stringify(parsed)}`);
    }
    this._decodedMemo = memoizedState();
    this._bySources = void 0;
    this._bySourceMemos = void 0;
  }
};
function cast$1(map) {
  return map;
}
function decodedMappings(map) {
  var _a;
  return (_a = cast$1(map))._decoded || (_a._decoded = decode(cast$1(map)._encoded));
}
function traceSegment(map, line, column) {
  const decoded = decodedMappings(map);
  if (line >= decoded.length) return null;
  const segments = decoded[line];
  const index = traceSegmentInternal(
    segments,
    cast$1(map)._decodedMemo,
    line,
    column);
  return index === -1 ? null : segments[index];
}
function traceSegmentInternal(segments, memo, line, column, bias) {
  let index = memoizedBinarySearch(segments, column, memo, line);
  if (found) {
    index = (lowerBound)(segments, column, index);
  }
  if (index === -1 || index === segments.length) return -1;
  return index;
}

var SetArray = class {
  constructor() {
    this._indexes = { __proto__: null };
    this.array = [];
  }
};
function cast(set) {
  return set;
}
function get(setarr, key) {
  return cast(setarr)._indexes[key];
}
function put(setarr, key) {
  const index = get(setarr, key);
  if (index !== void 0) return index;
  const { array, _indexes: indexes } = cast(setarr);
  const length = array.push(key);
  return indexes[key] = length - 1;
}
function remove(setarr, key) {
  const index = get(setarr, key);
  if (index === void 0) return;
  const { array, _indexes: indexes } = cast(setarr);
  for (let i = index + 1; i < array.length; i++) {
    const k = array[i];
    array[i - 1] = k;
    indexes[k]--;
  }
  indexes[key] = void 0;
  array.pop();
}
var COLUMN = 0;
var SOURCES_INDEX = 1;
var SOURCE_LINE = 2;
var SOURCE_COLUMN = 3;
var NAMES_INDEX = 4;
var NO_NAME = -1;
var GenMapping = class {
  constructor({ file, sourceRoot } = {}) {
    this._names = new SetArray();
    this._sources = new SetArray();
    this._sourcesContent = [];
    this._mappings = [];
    this.file = file;
    this.sourceRoot = sourceRoot;
    this._ignoreList = new SetArray();
  }
};
function cast2(map) {
  return map;
}
var maybeAddSegment = (map, genLine, genColumn, source, sourceLine, sourceColumn, name, content) => {
  return addSegmentInternal(
    true,
    map,
    genLine,
    genColumn,
    source,
    sourceLine,
    sourceColumn,
    name);
};
function setSourceContent(map, source, content) {
  const {
    _sources: sources,
    _sourcesContent: sourcesContent
    // _originalScopes: originalScopes,
  } = cast2(map);
  const index = put(sources, source);
  sourcesContent[index] = content;
}
function setIgnore(map, source, ignore = true) {
  const {
    _sources: sources,
    _sourcesContent: sourcesContent,
    _ignoreList: ignoreList
    // _originalScopes: originalScopes,
  } = cast2(map);
  const index = put(sources, source);
  if (index === sourcesContent.length) sourcesContent[index] = null;
  if (ignore) put(ignoreList, index);
  else remove(ignoreList, index);
}
function toDecodedMap(map) {
  const {
    _mappings: mappings,
    _sources: sources,
    _sourcesContent: sourcesContent,
    _names: names,
    _ignoreList: ignoreList
    // _originalScopes: originalScopes,
    // _generatedRanges: generatedRanges,
  } = cast2(map);
  removeEmptyFinalLines(mappings);
  return {
    version: 3,
    file: map.file || void 0,
    names: names.array,
    sourceRoot: map.sourceRoot || void 0,
    sources: sources.array,
    sourcesContent,
    mappings,
    // originalScopes,
    // generatedRanges,
    ignoreList: ignoreList.array
  };
}
function toEncodedMap(map) {
  const decoded = toDecodedMap(map);
  return Object.assign({}, decoded, {
    // originalScopes: decoded.originalScopes.map((os) => encodeOriginalScopes(os)),
    // generatedRanges: encodeGeneratedRanges(decoded.generatedRanges as GeneratedRange[]),
    mappings: encode(decoded.mappings)
  });
}
function addSegmentInternal(skipable, map, genLine, genColumn, source, sourceLine, sourceColumn, name, content) {
  const {
    _mappings: mappings,
    _sources: sources,
    _sourcesContent: sourcesContent,
    _names: names
    // _originalScopes: originalScopes,
  } = cast2(map);
  const line = getIndex(mappings, genLine);
  const index = getColumnIndex(line, genColumn);
  if (!source) {
    if (skipSourceless(line, index)) return;
    return insert(line, index, [genColumn]);
  }
  const sourcesIndex = put(sources, source);
  const namesIndex = name ? put(names, name) : NO_NAME;
  if (sourcesIndex === sourcesContent.length) sourcesContent[sourcesIndex] = null;
  if (skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex)) {
    return;
  }
  return insert(
    line,
    index,
    name ? [genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex] : [genColumn, sourcesIndex, sourceLine, sourceColumn]
  );
}
function getIndex(arr, index) {
  for (let i = arr.length; i <= index; i++) {
    arr[i] = [];
  }
  return arr[index];
}
function getColumnIndex(line, genColumn) {
  let index = line.length;
  for (let i = index - 1; i >= 0; index = i--) {
    const current = line[i];
    if (genColumn >= current[COLUMN]) break;
  }
  return index;
}
function insert(array, index, value) {
  for (let i = array.length; i > index; i--) {
    array[i] = array[i - 1];
  }
  array[index] = value;
}
function removeEmptyFinalLines(mappings) {
  const { length } = mappings;
  let len = length;
  for (let i = len - 1; i >= 0; len = i, i--) {
    if (mappings[i].length > 0) break;
  }
  if (len < length) mappings.length = len;
}
function skipSourceless(line, index) {
  if (index === 0) return true;
  const prev = line[index - 1];
  return prev.length === 1;
}
function skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex) {
  if (index === 0) return false;
  const prev = line[index - 1];
  if (prev.length === 1) return false;
  return sourcesIndex === prev[SOURCES_INDEX] && sourceLine === prev[SOURCE_LINE] && sourceColumn === prev[SOURCE_COLUMN] && namesIndex === (prev.length === 5 ? prev[NAMES_INDEX] : NO_NAME);
}

var SOURCELESS_MAPPING = /* @__PURE__ */ SegmentObject("", -1, -1, "", null, false);
var EMPTY_SOURCES = [];
function SegmentObject(source, line, column, name, content, ignore) {
  return { source, line, column, name, content, ignore };
}
function Source(map, sources, source, content, ignore) {
  return {
    map,
    sources,
    source,
    content,
    ignore
  };
}
function MapSource(map, sources) {
  return Source(map, sources, "", null, false);
}
function OriginalSource(source, content, ignore) {
  return Source(null, EMPTY_SOURCES, source, content, ignore);
}
function traceMappings(tree) {
  const gen = new GenMapping({ file: tree.map.file });
  const { sources: rootSources, map } = tree;
  const rootNames = map.names;
  const rootMappings = decodedMappings(map);
  for (let i = 0; i < rootMappings.length; i++) {
    const segments = rootMappings[i];
    for (let j = 0; j < segments.length; j++) {
      const segment = segments[j];
      const genCol = segment[0];
      let traced = SOURCELESS_MAPPING;
      if (segment.length !== 1) {
        const source2 = rootSources[segment[1]];
        traced = originalPositionFor(
          source2,
          segment[2],
          segment[3],
          segment.length === 5 ? rootNames[segment[4]] : ""
        );
        if (traced == null) continue;
      }
      const { column, line, name, content, source, ignore } = traced;
      maybeAddSegment(gen, i, genCol, source, line, column, name);
      if (source && content != null) setSourceContent(gen, source, content);
      if (ignore) setIgnore(gen, source, true);
    }
  }
  return gen;
}
function originalPositionFor(source, line, column, name) {
  if (!source.map) {
    return SegmentObject(source.source, line, column, name, source.content, source.ignore);
  }
  const segment = traceSegment(source.map, line, column);
  if (segment == null) return null;
  if (segment.length === 1) return SOURCELESS_MAPPING;
  return originalPositionFor(
    source.sources[segment[1]],
    segment[2],
    segment[3],
    segment.length === 5 ? source.map.names[segment[4]] : name
  );
}
function asArray(value) {
  if (Array.isArray(value)) return value;
  return [value];
}
function buildSourceMapTree(input, loader) {
  const maps = asArray(input).map((m) => new TraceMap(m, ""));
  const map = maps.pop();
  for (let i = 0; i < maps.length; i++) {
    if (maps[i].sources.length > 1) {
      throw new Error(
        `Transformation map ${i} must have exactly one source file.
Did you specify these with the most recent transformation maps first?`
      );
    }
  }
  let tree = build$1(map, loader, "", 0);
  for (let i = maps.length - 1; i >= 0; i--) {
    tree = MapSource(maps[i], [tree]);
  }
  return tree;
}
function build$1(map, loader, importer, importerDepth) {
  const { resolvedSources, sourcesContent, ignoreList } = map;
  const depth = importerDepth + 1;
  const children = resolvedSources.map((sourceFile, i) => {
    const ctx = {
      importer,
      depth,
      source: sourceFile || "",
      content: void 0,
      ignore: void 0
    };
    const sourceMap = loader(ctx.source, ctx);
    const { source} = ctx;
    if (sourceMap) return build$1(new TraceMap(sourceMap, source), loader, source, depth);
    const sourceContent = sourcesContent ? sourcesContent[i] : null;
    const ignored = ignoreList ? ignoreList.includes(i) : false;
    return OriginalSource(source, sourceContent, ignored);
  });
  return MapSource(map, children);
}
var SourceMap$1 = class SourceMap {
  constructor(map, options) {
    const out = options.decodedMappings ? toDecodedMap(map) : toEncodedMap(map);
    this.version = out.version;
    this.file = out.file;
    this.mappings = out.mappings;
    this.names = out.names;
    this.ignoreList = out.ignoreList;
    this.sourceRoot = out.sourceRoot;
    this.sources = out.sources;
    if (!options.excludeContent) {
      this.sourcesContent = out.sourcesContent;
    }
  }
  toString() {
    return JSON.stringify(this);
  }
};
function remapping(input, loader, options) {
  const opts = { excludeContent: false, decodedMappings: false };
  const tree = buildSourceMapTree(input, loader);
  return new SourceMap$1(traceMappings(tree), opts);
}

class BitSet {
  constructor(arg) {
    this.bits = arg instanceof BitSet ? arg.bits.slice() : [];
  }
  add(n2) {
    this.bits[n2 >> 5] |= 1 << (n2 & 31);
  }
  has(n2) {
    return !!(this.bits[n2 >> 5] & 1 << (n2 & 31));
  }
}
class Chunk {
  constructor(start, end, content) {
    this.start = start;
    this.end = end;
    this.original = content;
    this.intro = "";
    this.outro = "";
    this.content = content;
    this.storeName = false;
    this.edited = false;
    {
      this.previous = null;
      this.next = null;
    }
  }
  appendLeft(content) {
    this.outro += content;
  }
  appendRight(content) {
    this.intro = this.intro + content;
  }
  clone() {
    const chunk = new Chunk(this.start, this.end, this.original);
    chunk.intro = this.intro;
    chunk.outro = this.outro;
    chunk.content = this.content;
    chunk.storeName = this.storeName;
    chunk.edited = this.edited;
    return chunk;
  }
  contains(index) {
    return this.start < index && index < this.end;
  }
  eachNext(fn) {
    let chunk = this;
    while (chunk) {
      fn(chunk);
      chunk = chunk.next;
    }
  }
  eachPrevious(fn) {
    let chunk = this;
    while (chunk) {
      fn(chunk);
      chunk = chunk.previous;
    }
  }
  edit(content, storeName, contentOnly) {
    this.content = content;
    if (!contentOnly) {
      this.intro = "";
      this.outro = "";
    }
    this.storeName = storeName;
    this.edited = true;
    return this;
  }
  prependLeft(content) {
    this.outro = content + this.outro;
  }
  prependRight(content) {
    this.intro = content + this.intro;
  }
  reset() {
    this.intro = "";
    this.outro = "";
    if (this.edited) {
      this.content = this.original;
      this.storeName = false;
      this.edited = false;
    }
  }
  split(index) {
    const sliceIndex = index - this.start;
    const originalBefore = this.original.slice(0, sliceIndex);
    const originalAfter = this.original.slice(sliceIndex);
    this.original = originalBefore;
    const newChunk = new Chunk(index, this.end, originalAfter);
    newChunk.outro = this.outro;
    this.outro = "";
    this.end = index;
    if (this.edited) {
      newChunk.edit("", false);
      this.content = "";
    } else {
      this.content = originalBefore;
    }
    newChunk.next = this.next;
    if (newChunk.next) newChunk.next.previous = newChunk;
    newChunk.previous = this;
    this.next = newChunk;
    return newChunk;
  }
  toString() {
    return this.intro + this.content + this.outro;
  }
  trimEnd(rx) {
    this.outro = this.outro.replace(rx, "");
    if (this.outro.length) return true;
    const trimmed = this.content.replace(rx, "");
    if (trimmed.length) {
      if (trimmed !== this.content) {
        this.split(this.start + trimmed.length).edit("", void 0, true);
        if (this.edited) {
          this.edit(trimmed, this.storeName, true);
        }
      }
      return true;
    } else {
      this.edit("", void 0, true);
      this.intro = this.intro.replace(rx, "");
      if (this.intro.length) return true;
    }
  }
  trimStart(rx) {
    this.intro = this.intro.replace(rx, "");
    if (this.intro.length) return true;
    const trimmed = this.content.replace(rx, "");
    if (trimmed.length) {
      if (trimmed !== this.content) {
        const newChunk = this.split(this.end - trimmed.length);
        if (this.edited) {
          newChunk.edit(trimmed, this.storeName, true);
        }
        this.edit("", void 0, true);
      }
      return true;
    } else {
      this.edit("", void 0, true);
      this.outro = this.outro.replace(rx, "");
      if (this.outro.length) return true;
    }
  }
}
function getBtoa() {
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    return (str) => globalThis.btoa(unescape(encodeURIComponent(str)));
  } else if (typeof Buffer === "function") {
    return (str) => Buffer.from(str, "utf-8").toString("base64");
  } else {
    return () => {
      throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
    };
  }
}
const btoa = /* @__PURE__ */ getBtoa();
class SourceMap {
  constructor(properties) {
    this.version = 3;
    this.file = properties.file;
    this.sources = properties.sources;
    this.sourcesContent = properties.sourcesContent;
    this.names = properties.names;
    this.mappings = encode(properties.mappings);
    if (typeof properties.x_google_ignoreList !== "undefined") {
      this.x_google_ignoreList = properties.x_google_ignoreList;
    }
    if (typeof properties.debugId !== "undefined") {
      this.debugId = properties.debugId;
    }
  }
  toString() {
    return JSON.stringify(this);
  }
  toUrl() {
    return "data:application/json;charset=utf-8;base64," + btoa(this.toString());
  }
}
function guessIndent(code) {
  const lines = code.split("\n");
  const tabbed = lines.filter((line) => /^\t+/.test(line));
  const spaced = lines.filter((line) => /^ {2,}/.test(line));
  if (tabbed.length === 0 && spaced.length === 0) {
    return null;
  }
  if (tabbed.length >= spaced.length) {
    return "	";
  }
  const min = spaced.reduce((previous, current) => {
    const numSpaces = /^ +/.exec(current)[0].length;
    return Math.min(numSpaces, previous);
  }, Infinity);
  return new Array(min + 1).join(" ");
}
function getRelativePath(from, to) {
  const fromParts = from.split(/[/\\]/);
  const toParts = to.split(/[/\\]/);
  fromParts.pop();
  while (fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  if (fromParts.length) {
    let i = fromParts.length;
    while (i--) fromParts[i] = "..";
  }
  return fromParts.concat(toParts).join("/");
}
const toString = Object.prototype.toString;
function isObject(thing) {
  return toString.call(thing) === "[object Object]";
}
function getLocator(source) {
  const originalLines = source.split("\n");
  const lineOffsets = [];
  for (let i = 0, pos = 0; i < originalLines.length; i++) {
    lineOffsets.push(pos);
    pos += originalLines[i].length + 1;
  }
  return function locate(index) {
    let i = 0;
    let j = lineOffsets.length;
    while (i < j) {
      const m = i + j >> 1;
      if (index < lineOffsets[m]) {
        j = m;
      } else {
        i = m + 1;
      }
    }
    const line = i - 1;
    const column = index - lineOffsets[line];
    return { line, column };
  };
}
const wordRegex = /\w/;
class Mappings {
  constructor(hires) {
    this.hires = hires;
    this.generatedCodeLine = 0;
    this.generatedCodeColumn = 0;
    this.raw = [];
    this.rawSegments = this.raw[this.generatedCodeLine] = [];
    this.pending = null;
  }
  addEdit(sourceIndex, content, loc, nameIndex) {
    if (content.length) {
      const contentLengthMinusOne = content.length - 1;
      let contentLineEnd = content.indexOf("\n", 0);
      let previousContentLineEnd = -1;
      while (contentLineEnd >= 0 && contentLengthMinusOne > contentLineEnd) {
        const segment2 = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
        if (nameIndex >= 0) {
          segment2.push(nameIndex);
        }
        this.rawSegments.push(segment2);
        this.generatedCodeLine += 1;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
        this.generatedCodeColumn = 0;
        previousContentLineEnd = contentLineEnd;
        contentLineEnd = content.indexOf("\n", contentLineEnd + 1);
      }
      const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
      if (nameIndex >= 0) {
        segment.push(nameIndex);
      }
      this.rawSegments.push(segment);
      this.advance(content.slice(previousContentLineEnd + 1));
    } else if (this.pending) {
      this.rawSegments.push(this.pending);
      this.advance(content);
    }
    this.pending = null;
  }
  addUneditedChunk(sourceIndex, chunk, original, loc, sourcemapLocations) {
    let originalCharIndex = chunk.start;
    let first = true;
    let charInHiresBoundary = false;
    while (originalCharIndex < chunk.end) {
      if (original[originalCharIndex] === "\n") {
        loc.line += 1;
        loc.column = 0;
        this.generatedCodeLine += 1;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
        this.generatedCodeColumn = 0;
        first = true;
        charInHiresBoundary = false;
      } else {
        if (this.hires || first || sourcemapLocations.has(originalCharIndex)) {
          const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
          if (this.hires === "boundary") {
            if (wordRegex.test(original[originalCharIndex])) {
              if (!charInHiresBoundary) {
                this.rawSegments.push(segment);
                charInHiresBoundary = true;
              }
            } else {
              this.rawSegments.push(segment);
              charInHiresBoundary = false;
            }
          } else {
            this.rawSegments.push(segment);
          }
        }
        loc.column += 1;
        this.generatedCodeColumn += 1;
        first = false;
      }
      originalCharIndex += 1;
    }
    this.pending = null;
  }
  advance(str) {
    if (!str) return;
    const lines = str.split("\n");
    if (lines.length > 1) {
      for (let i = 0; i < lines.length - 1; i++) {
        this.generatedCodeLine++;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
      }
      this.generatedCodeColumn = 0;
    }
    this.generatedCodeColumn += lines[lines.length - 1].length;
  }
}
const n = "\n";
const warned = {
  insertLeft: false,
  insertRight: false,
  storeName: false
};
class MagicString {
  constructor(string, options = {}) {
    const chunk = new Chunk(0, string.length, string);
    Object.defineProperties(this, {
      original: { writable: true, value: string },
      outro: { writable: true, value: "" },
      intro: { writable: true, value: "" },
      firstChunk: { writable: true, value: chunk },
      lastChunk: { writable: true, value: chunk },
      lastSearchedChunk: { writable: true, value: chunk },
      byStart: { writable: true, value: {} },
      byEnd: { writable: true, value: {} },
      filename: { writable: true, value: options.filename },
      indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
      sourcemapLocations: { writable: true, value: new BitSet() },
      storedNames: { writable: true, value: {} },
      indentStr: { writable: true, value: void 0 },
      ignoreList: { writable: true, value: options.ignoreList },
      offset: { writable: true, value: options.offset || 0 }
    });
    this.byStart[0] = chunk;
    this.byEnd[string.length] = chunk;
  }
  addSourcemapLocation(char) {
    this.sourcemapLocations.add(char);
  }
  append(content) {
    if (typeof content !== "string") throw new TypeError("outro content must be a string");
    this.outro += content;
    return this;
  }
  appendLeft(index, content) {
    index = index + this.offset;
    if (typeof content !== "string") throw new TypeError("inserted content must be a string");
    this._split(index);
    const chunk = this.byEnd[index];
    if (chunk) {
      chunk.appendLeft(content);
    } else {
      this.intro += content;
    }
    return this;
  }
  appendRight(index, content) {
    index = index + this.offset;
    if (typeof content !== "string") throw new TypeError("inserted content must be a string");
    this._split(index);
    const chunk = this.byStart[index];
    if (chunk) {
      chunk.appendRight(content);
    } else {
      this.outro += content;
    }
    return this;
  }
  clone() {
    const cloned = new MagicString(this.original, { filename: this.filename, offset: this.offset });
    let originalChunk = this.firstChunk;
    let clonedChunk = cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone();
    while (originalChunk) {
      cloned.byStart[clonedChunk.start] = clonedChunk;
      cloned.byEnd[clonedChunk.end] = clonedChunk;
      const nextOriginalChunk = originalChunk.next;
      const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();
      if (nextClonedChunk) {
        clonedChunk.next = nextClonedChunk;
        nextClonedChunk.previous = clonedChunk;
        clonedChunk = nextClonedChunk;
      }
      originalChunk = nextOriginalChunk;
    }
    cloned.lastChunk = clonedChunk;
    if (this.indentExclusionRanges) {
      cloned.indentExclusionRanges = this.indentExclusionRanges.slice();
    }
    cloned.sourcemapLocations = new BitSet(this.sourcemapLocations);
    cloned.intro = this.intro;
    cloned.outro = this.outro;
    return cloned;
  }
  generateDecodedMap(options) {
    options = options || {};
    const sourceIndex = 0;
    const names = Object.keys(this.storedNames);
    const mappings = new Mappings(options.hires);
    const locate = getLocator(this.original);
    if (this.intro) {
      mappings.advance(this.intro);
    }
    this.firstChunk.eachNext((chunk) => {
      const loc = locate(chunk.start);
      if (chunk.intro.length) mappings.advance(chunk.intro);
      if (chunk.edited) {
        mappings.addEdit(
          sourceIndex,
          chunk.content,
          loc,
          chunk.storeName ? names.indexOf(chunk.original) : -1
        );
      } else {
        mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations);
      }
      if (chunk.outro.length) mappings.advance(chunk.outro);
    });
    if (this.outro) {
      mappings.advance(this.outro);
    }
    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : void 0,
      sources: [
        options.source ? getRelativePath(options.file || "", options.source) : options.file || ""
      ],
      sourcesContent: options.includeContent ? [this.original] : void 0,
      names,
      mappings: mappings.raw,
      x_google_ignoreList: this.ignoreList ? [sourceIndex] : void 0
    };
  }
  generateMap(options) {
    return new SourceMap(this.generateDecodedMap(options));
  }
  _ensureindentStr() {
    if (this.indentStr === void 0) {
      this.indentStr = guessIndent(this.original);
    }
  }
  _getRawIndentString() {
    this._ensureindentStr();
    return this.indentStr;
  }
  getIndentString() {
    this._ensureindentStr();
    return this.indentStr === null ? "	" : this.indentStr;
  }
  indent(indentStr, options) {
    const pattern = /^[^\r\n]/gm;
    if (isObject(indentStr)) {
      options = indentStr;
      indentStr = void 0;
    }
    if (indentStr === void 0) {
      this._ensureindentStr();
      indentStr = this.indentStr || "	";
    }
    if (indentStr === "") return this;
    options = options || {};
    const isExcluded = {};
    if (options.exclude) {
      const exclusions = typeof options.exclude[0] === "number" ? [options.exclude] : options.exclude;
      exclusions.forEach((exclusion) => {
        for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
          isExcluded[i] = true;
        }
      });
    }
    let shouldIndentNextCharacter = options.indentStart !== false;
    const replacer = (match) => {
      if (shouldIndentNextCharacter) return `${indentStr}${match}`;
      shouldIndentNextCharacter = true;
      return match;
    };
    this.intro = this.intro.replace(pattern, replacer);
    let charIndex = 0;
    let chunk = this.firstChunk;
    while (chunk) {
      const end = chunk.end;
      if (chunk.edited) {
        if (!isExcluded[charIndex]) {
          chunk.content = chunk.content.replace(pattern, replacer);
          if (chunk.content.length) {
            shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === "\n";
          }
        }
      } else {
        charIndex = chunk.start;
        while (charIndex < end) {
          if (!isExcluded[charIndex]) {
            const char = this.original[charIndex];
            if (char === "\n") {
              shouldIndentNextCharacter = true;
            } else if (char !== "\r" && shouldIndentNextCharacter) {
              shouldIndentNextCharacter = false;
              if (charIndex === chunk.start) {
                chunk.prependRight(indentStr);
              } else {
                this._splitChunk(chunk, charIndex);
                chunk = chunk.next;
                chunk.prependRight(indentStr);
              }
            }
          }
          charIndex += 1;
        }
      }
      charIndex = chunk.end;
      chunk = chunk.next;
    }
    this.outro = this.outro.replace(pattern, replacer);
    return this;
  }
  insert() {
    throw new Error(
      "magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)"
    );
  }
  insertLeft(index, content) {
    if (!warned.insertLeft) {
      console.warn(
        "magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"
      );
      warned.insertLeft = true;
    }
    return this.appendLeft(index, content);
  }
  insertRight(index, content) {
    if (!warned.insertRight) {
      console.warn(
        "magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"
      );
      warned.insertRight = true;
    }
    return this.prependRight(index, content);
  }
  move(start, end, index) {
    start = start + this.offset;
    end = end + this.offset;
    index = index + this.offset;
    if (index >= start && index <= end) throw new Error("Cannot move a selection inside itself");
    this._split(start);
    this._split(end);
    this._split(index);
    const first = this.byStart[start];
    const last = this.byEnd[end];
    const oldLeft = first.previous;
    const oldRight = last.next;
    const newRight = this.byStart[index];
    if (!newRight && last === this.lastChunk) return this;
    const newLeft = newRight ? newRight.previous : this.lastChunk;
    if (oldLeft) oldLeft.next = oldRight;
    if (oldRight) oldRight.previous = oldLeft;
    if (newLeft) newLeft.next = first;
    if (newRight) newRight.previous = last;
    if (!first.previous) this.firstChunk = last.next;
    if (!last.next) {
      this.lastChunk = first.previous;
      this.lastChunk.next = null;
    }
    first.previous = newLeft;
    last.next = newRight || null;
    if (!newLeft) this.firstChunk = first;
    if (!newRight) this.lastChunk = last;
    return this;
  }
  overwrite(start, end, content, options) {
    options = options || {};
    return this.update(start, end, content, { ...options, overwrite: !options.contentOnly });
  }
  update(start, end, content, options) {
    start = start + this.offset;
    end = end + this.offset;
    if (typeof content !== "string") throw new TypeError("replacement content must be a string");
    if (this.original.length !== 0) {
      while (start < 0) start += this.original.length;
      while (end < 0) end += this.original.length;
    }
    if (end > this.original.length) throw new Error("end is out of bounds");
    if (start === end)
      throw new Error(
        "Cannot overwrite a zero-length range \u2013 use appendLeft or prependRight instead"
      );
    this._split(start);
    this._split(end);
    if (options === true) {
      if (!warned.storeName) {
        console.warn(
          "The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"
        );
        warned.storeName = true;
      }
      options = { storeName: true };
    }
    const storeName = options !== void 0 ? options.storeName : false;
    const overwrite = options !== void 0 ? options.overwrite : false;
    if (storeName) {
      const original = this.original.slice(start, end);
      Object.defineProperty(this.storedNames, original, {
        writable: true,
        value: true,
        enumerable: true
      });
    }
    const first = this.byStart[start];
    const last = this.byEnd[end];
    if (first) {
      let chunk = first;
      while (chunk !== last) {
        if (chunk.next !== this.byStart[chunk.end]) {
          throw new Error("Cannot overwrite across a split point");
        }
        chunk = chunk.next;
        chunk.edit("", false);
      }
      first.edit(content, storeName, !overwrite);
    } else {
      const newChunk = new Chunk(start, end, "").edit(content, storeName);
      last.next = newChunk;
      newChunk.previous = last;
    }
    return this;
  }
  prepend(content) {
    if (typeof content !== "string") throw new TypeError("outro content must be a string");
    this.intro = content + this.intro;
    return this;
  }
  prependLeft(index, content) {
    index = index + this.offset;
    if (typeof content !== "string") throw new TypeError("inserted content must be a string");
    this._split(index);
    const chunk = this.byEnd[index];
    if (chunk) {
      chunk.prependLeft(content);
    } else {
      this.intro = content + this.intro;
    }
    return this;
  }
  prependRight(index, content) {
    index = index + this.offset;
    if (typeof content !== "string") throw new TypeError("inserted content must be a string");
    this._split(index);
    const chunk = this.byStart[index];
    if (chunk) {
      chunk.prependRight(content);
    } else {
      this.outro = content + this.outro;
    }
    return this;
  }
  remove(start, end) {
    start = start + this.offset;
    end = end + this.offset;
    if (this.original.length !== 0) {
      while (start < 0) start += this.original.length;
      while (end < 0) end += this.original.length;
    }
    if (start === end) return this;
    if (start < 0 || end > this.original.length) throw new Error("Character is out of bounds");
    if (start > end) throw new Error("end must be greater than start");
    this._split(start);
    this._split(end);
    let chunk = this.byStart[start];
    while (chunk) {
      chunk.intro = "";
      chunk.outro = "";
      chunk.edit("");
      chunk = end > chunk.end ? this.byStart[chunk.end] : null;
    }
    return this;
  }
  reset(start, end) {
    start = start + this.offset;
    end = end + this.offset;
    if (this.original.length !== 0) {
      while (start < 0) start += this.original.length;
      while (end < 0) end += this.original.length;
    }
    if (start === end) return this;
    if (start < 0 || end > this.original.length) throw new Error("Character is out of bounds");
    if (start > end) throw new Error("end must be greater than start");
    this._split(start);
    this._split(end);
    let chunk = this.byStart[start];
    while (chunk) {
      chunk.reset();
      chunk = end > chunk.end ? this.byStart[chunk.end] : null;
    }
    return this;
  }
  lastChar() {
    if (this.outro.length) return this.outro[this.outro.length - 1];
    let chunk = this.lastChunk;
    do {
      if (chunk.outro.length) return chunk.outro[chunk.outro.length - 1];
      if (chunk.content.length) return chunk.content[chunk.content.length - 1];
      if (chunk.intro.length) return chunk.intro[chunk.intro.length - 1];
    } while (chunk = chunk.previous);
    if (this.intro.length) return this.intro[this.intro.length - 1];
    return "";
  }
  lastLine() {
    let lineIndex = this.outro.lastIndexOf(n);
    if (lineIndex !== -1) return this.outro.substr(lineIndex + 1);
    let lineStr = this.outro;
    let chunk = this.lastChunk;
    do {
      if (chunk.outro.length > 0) {
        lineIndex = chunk.outro.lastIndexOf(n);
        if (lineIndex !== -1) return chunk.outro.substr(lineIndex + 1) + lineStr;
        lineStr = chunk.outro + lineStr;
      }
      if (chunk.content.length > 0) {
        lineIndex = chunk.content.lastIndexOf(n);
        if (lineIndex !== -1) return chunk.content.substr(lineIndex + 1) + lineStr;
        lineStr = chunk.content + lineStr;
      }
      if (chunk.intro.length > 0) {
        lineIndex = chunk.intro.lastIndexOf(n);
        if (lineIndex !== -1) return chunk.intro.substr(lineIndex + 1) + lineStr;
        lineStr = chunk.intro + lineStr;
      }
    } while (chunk = chunk.previous);
    lineIndex = this.intro.lastIndexOf(n);
    if (lineIndex !== -1) return this.intro.substr(lineIndex + 1) + lineStr;
    return this.intro + lineStr;
  }
  slice(start = 0, end = this.original.length - this.offset) {
    start = start + this.offset;
    end = end + this.offset;
    if (this.original.length !== 0) {
      while (start < 0) start += this.original.length;
      while (end < 0) end += this.original.length;
    }
    let result = "";
    let chunk = this.firstChunk;
    while (chunk && (chunk.start > start || chunk.end <= start)) {
      if (chunk.start < end && chunk.end >= end) {
        return result;
      }
      chunk = chunk.next;
    }
    if (chunk && chunk.edited && chunk.start !== start)
      throw new Error(`Cannot use replaced character ${start} as slice start anchor.`);
    const startChunk = chunk;
    while (chunk) {
      if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
        result += chunk.intro;
      }
      const containsEnd = chunk.start < end && chunk.end >= end;
      if (containsEnd && chunk.edited && chunk.end !== end)
        throw new Error(`Cannot use replaced character ${end} as slice end anchor.`);
      const sliceStart = startChunk === chunk ? start - chunk.start : 0;
      const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;
      result += chunk.content.slice(sliceStart, sliceEnd);
      if (chunk.outro && (!containsEnd || chunk.end === end)) {
        result += chunk.outro;
      }
      if (containsEnd) {
        break;
      }
      chunk = chunk.next;
    }
    return result;
  }
  // TODO deprecate this? not really very useful
  snip(start, end) {
    const clone = this.clone();
    clone.remove(0, start);
    clone.remove(end, clone.original.length);
    return clone;
  }
  _split(index) {
    if (this.byStart[index] || this.byEnd[index]) return;
    let chunk = this.lastSearchedChunk;
    let previousChunk = chunk;
    const searchForward = index > chunk.end;
    while (chunk) {
      if (chunk.contains(index)) return this._splitChunk(chunk, index);
      chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
      if (chunk === previousChunk) return;
      previousChunk = chunk;
    }
  }
  _splitChunk(chunk, index) {
    if (chunk.edited && chunk.content.length) {
      const loc = getLocator(this.original)(index);
      throw new Error(
        `Cannot split a chunk that has already been edited (${loc.line}:${loc.column} \u2013 "${chunk.original}")`
      );
    }
    const newChunk = chunk.split(index);
    this.byEnd[index] = chunk;
    this.byStart[index] = newChunk;
    this.byEnd[newChunk.end] = newChunk;
    if (chunk === this.lastChunk) this.lastChunk = newChunk;
    this.lastSearchedChunk = chunk;
    return true;
  }
  toString() {
    let str = this.intro;
    let chunk = this.firstChunk;
    while (chunk) {
      str += chunk.toString();
      chunk = chunk.next;
    }
    return str + this.outro;
  }
  isEmpty() {
    let chunk = this.firstChunk;
    do {
      if (chunk.intro.length && chunk.intro.trim() || chunk.content.length && chunk.content.trim() || chunk.outro.length && chunk.outro.trim())
        return false;
    } while (chunk = chunk.next);
    return true;
  }
  length() {
    let chunk = this.firstChunk;
    let length = 0;
    do {
      length += chunk.intro.length + chunk.content.length + chunk.outro.length;
    } while (chunk = chunk.next);
    return length;
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(charType) {
    return this.trimStart(charType).trimEnd(charType);
  }
  trimEndAborted(charType) {
    const rx = new RegExp((charType || "\\s") + "+$");
    this.outro = this.outro.replace(rx, "");
    if (this.outro.length) return true;
    let chunk = this.lastChunk;
    do {
      const end = chunk.end;
      const aborted = chunk.trimEnd(rx);
      if (chunk.end !== end) {
        if (this.lastChunk === chunk) {
          this.lastChunk = chunk.next;
        }
        this.byEnd[chunk.end] = chunk;
        this.byStart[chunk.next.start] = chunk.next;
        this.byEnd[chunk.next.end] = chunk.next;
      }
      if (aborted) return true;
      chunk = chunk.previous;
    } while (chunk);
    return false;
  }
  trimEnd(charType) {
    this.trimEndAborted(charType);
    return this;
  }
  trimStartAborted(charType) {
    const rx = new RegExp("^" + (charType || "\\s") + "+");
    this.intro = this.intro.replace(rx, "");
    if (this.intro.length) return true;
    let chunk = this.firstChunk;
    do {
      const end = chunk.end;
      const aborted = chunk.trimStart(rx);
      if (chunk.end !== end) {
        if (chunk === this.lastChunk) this.lastChunk = chunk.next;
        this.byEnd[chunk.end] = chunk;
        this.byStart[chunk.next.start] = chunk.next;
        this.byEnd[chunk.next.end] = chunk.next;
      }
      if (aborted) return true;
      chunk = chunk.next;
    } while (chunk);
    return false;
  }
  trimStart(charType) {
    this.trimStartAborted(charType);
    return this;
  }
  hasChanged() {
    return this.original !== this.toString();
  }
  _replaceRegexp(searchValue, replacement) {
    function getReplacement(match, str) {
      if (typeof replacement === "string") {
        return replacement.replace(/\$(\$|&|\d+)/g, (_, i) => {
          if (i === "$") return "$";
          if (i === "&") return match[0];
          const num = +i;
          if (num < match.length) return match[+i];
          return `$${i}`;
        });
      } else {
        return replacement(...match, match.index, str, match.groups);
      }
    }
    function matchAll(re, str) {
      let match;
      const matches = [];
      while (match = re.exec(str)) {
        matches.push(match);
      }
      return matches;
    }
    if (searchValue.global) {
      const matches = matchAll(searchValue, this.original);
      matches.forEach((match) => {
        if (match.index != null) {
          const replacement2 = getReplacement(match, this.original);
          if (replacement2 !== match[0]) {
            this.overwrite(match.index, match.index + match[0].length, replacement2);
          }
        }
      });
    } else {
      const match = this.original.match(searchValue);
      if (match && match.index != null) {
        const replacement2 = getReplacement(match, this.original);
        if (replacement2 !== match[0]) {
          this.overwrite(match.index, match.index + match[0].length, replacement2);
        }
      }
    }
    return this;
  }
  _replaceString(string, replacement) {
    const { original } = this;
    const index = original.indexOf(string);
    if (index !== -1) {
      if (typeof replacement === "function") {
        replacement = replacement(string, index, original);
      }
      if (string !== replacement) {
        this.overwrite(index, index + string.length, replacement);
      }
    }
    return this;
  }
  replace(searchValue, replacement) {
    if (typeof searchValue === "string") {
      return this._replaceString(searchValue, replacement);
    }
    return this._replaceRegexp(searchValue, replacement);
  }
  _replaceAllString(string, replacement) {
    const { original } = this;
    const stringLength = string.length;
    for (let index = original.indexOf(string); index !== -1; index = original.indexOf(string, index + stringLength)) {
      const previous = original.slice(index, index + stringLength);
      let _replacement = replacement;
      if (typeof replacement === "function") {
        _replacement = replacement(previous, index, original);
      }
      if (previous !== _replacement) this.overwrite(index, index + stringLength, _replacement);
    }
    return this;
  }
  replaceAll(searchValue, replacement) {
    if (typeof searchValue === "string") {
      return this._replaceAllString(searchValue, replacement);
    }
    if (!searchValue.global) {
      throw new TypeError(
        "MagicString.prototype.replaceAll called with a non-global RegExp argument"
      );
    }
    return this._replaceRegexp(searchValue, replacement);
  }
}

function resolveDefaultOptions(options) {
  return {
    ...options,
    compilerOptions: options.compilerOptions ?? {},
    respectExternal: options.respectExternal ?? false,
    includeExternal: options.includeExternal ?? []
  };
}
const DTS_EXTENSIONS = /\.d\.(c|m)?tsx?$/;
const JSON_EXTENSIONS = /\.json$/;
const SUPPORTED_EXTENSIONS = /((\.d)?\.(c|m)?(t|j)sx?|\.json)$/;
function trimExtension(path2) {
  return path2.replace(SUPPORTED_EXTENSIONS, "");
}
function getDeclarationId(path2) {
  return path2.replace(SUPPORTED_EXTENSIONS, ".d.ts");
}
function parse(fileName, code) {
  return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
}
const formatHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getNewLine: () => ts.sys.newLine,
  getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase()
};
const DEFAULT_OPTIONS = {
  // Ensure ".d.ts" modules are generated
  declaration: true,
  // Skip ".js" generation
  noEmit: false,
  emitDeclarationOnly: true,
  // Skip code generation when error occurs
  noEmitOnError: true,
  // Avoid extra work
  checkJs: false,
  declarationMap: false,
  skipLibCheck: true,
  // Ensure TS2742 errors are visible
  preserveSymlinks: true,
  // Ensure we can parse the latest code
  target: ts.ScriptTarget.ESNext,
  // Allows importing `*.json`
  resolveJsonModule: true
};
const configByPath = /* @__PURE__ */ new Map();
const logCache = (...args) => process.env.DTS_LOG_CACHE ? console.log("[cache]", ...args) : null;
function cacheConfig([fromPath, toPath], config) {
  logCache(fromPath);
  configByPath.set(fromPath, config);
  while (fromPath !== toPath && // make sure we're not stuck in an infinite loop
  fromPath !== path.dirname(fromPath)) {
    fromPath = path.dirname(fromPath);
    logCache("up", fromPath);
    if (configByPath.has(fromPath))
      return logCache("has", fromPath);
    configByPath.set(fromPath, config);
  }
}
function getCompilerOptions(input, overrideOptions, overrideConfigPath) {
  const compilerOptions = { ...DEFAULT_OPTIONS, ...overrideOptions };
  let dirName = path.dirname(input);
  let dtsFiles = [];
  const cacheKey = overrideConfigPath || dirName;
  if (!configByPath.has(cacheKey)) {
    logCache("miss", cacheKey);
    const configPath = overrideConfigPath ? path.resolve(process.cwd(), overrideConfigPath) : ts.findConfigFile(dirName, ts.sys.fileExists);
    if (!configPath) {
      return { dtsFiles, dirName, compilerOptions };
    }
    const inputDirName = dirName;
    dirName = path.dirname(configPath);
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
      console.error(ts.formatDiagnostic(error, formatHost));
      return { dtsFiles, dirName, compilerOptions };
    }
    logCache("tsconfig", config);
    const configContents = ts.parseJsonConfigFileContent(config, ts.sys, dirName);
    if (overrideConfigPath) {
      cacheConfig([overrideConfigPath, overrideConfigPath], configContents);
    } else {
      cacheConfig([inputDirName, dirName], configContents);
    }
  } else {
    logCache("HIT", cacheKey);
  }
  const { fileNames, options, errors } = configByPath.get(cacheKey);
  dtsFiles = fileNames.filter((name) => DTS_EXTENSIONS.test(name));
  if (errors.length) {
    console.error(ts.formatDiagnostics(errors, formatHost));
    return { dtsFiles, dirName, compilerOptions };
  }
  return {
    dtsFiles,
    dirName,
    compilerOptions: {
      ...options,
      ...compilerOptions
    }
  };
}
function createProgram$1(fileName, overrideOptions, tsconfig) {
  const { dtsFiles, compilerOptions } = getCompilerOptions(fileName, overrideOptions, tsconfig);
  return ts.createProgram([fileName].concat(Array.from(dtsFiles)), compilerOptions, ts.createCompilerHost(compilerOptions, true));
}
function createPrograms(input, overrideOptions, tsconfig) {
  const programs = [];
  const dtsFiles = /* @__PURE__ */ new Set();
  let inputs = [];
  let dirName = "";
  let compilerOptions = {};
  for (let main of input) {
    if (DTS_EXTENSIONS.test(main)) {
      continue;
    }
    main = path.resolve(main);
    const options = getCompilerOptions(main, overrideOptions, tsconfig);
    options.dtsFiles.forEach(dtsFiles.add, dtsFiles);
    if (!inputs.length) {
      inputs.push(main);
      ({ dirName, compilerOptions } = options);
      continue;
    }
    if (options.dirName === dirName) {
      inputs.push(main);
    } else {
      const host = ts.createCompilerHost(compilerOptions, true);
      const program = ts.createProgram(inputs.concat(Array.from(dtsFiles)), compilerOptions, host);
      programs.push(program);
      inputs = [main];
      ({ dirName, compilerOptions } = options);
    }
  }
  if (inputs.length) {
    const host = ts.createCompilerHost(compilerOptions, true);
    const program = ts.createProgram(inputs.concat(Array.from(dtsFiles)), compilerOptions, host);
    programs.push(program);
  }
  return programs;
}
function getCodeFrame() {
  let codeFrameColumns = void 0;
  try {
    ({ codeFrameColumns } = require("@babel/code-frame"));
    return codeFrameColumns;
  } catch {
    try {
      const esmRequire = createRequire(import.meta.url);
      ({ codeFrameColumns } = esmRequire("@babel/code-frame"));
      return codeFrameColumns;
    } catch {
    }
  }
  return void 0;
}
function getLocation(node) {
  const sourceFile = node.getSourceFile();
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    start: { line: start.line + 1, column: start.character + 1 },
    end: { line: end.line + 1, column: end.character + 1 }
  };
}
function frameNode(node) {
  const codeFrame = getCodeFrame();
  const sourceFile = node.getSourceFile();
  const code = sourceFile.getFullText();
  const location = getLocation(node);
  if (codeFrame) {
    return "\n" + codeFrame(code, location, {
      highlightCode: true
    });
  } else {
    return `
${location.start.line}:${location.start.column}: \`${node.getFullText().trim()}\``;
  }
}
class UnsupportedSyntaxError extends Error {
  constructor(node, message = "Syntax not yet supported") {
    super(`${message}
${frameNode(node)}`);
  }
}
class NamespaceFixer {
  constructor(sourceFile) {
    this.sourceFile = sourceFile;
  }
  findNamespaces() {
    const namespaces = [];
    const items = {};
    for (const node of this.sourceFile.statements) {
      const location = {
        start: node.getStart(),
        end: node.getEnd()
      };
      if (ts.isEmptyStatement(node)) {
        namespaces.unshift({
          name: "",
          exports: [],
          location
        });
        continue;
      }
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const { text } = node.moduleSpecifier;
        if (text.startsWith(".") && (text.endsWith(".d.ts") || text.endsWith(".d.cts") || text.endsWith(".d.mts"))) {
          const start = node.moduleSpecifier.getStart() + 1;
          const end = node.moduleSpecifier.getEnd() - 1;
          namespaces.unshift({
            name: "",
            exports: [],
            location: {
              start,
              end
            },
            textBeforeCodeAfter: text.replace(/\.d\.ts$/, ".js").replace(/\.d\.cts$/, ".cjs").replace(/\.d\.mts$/, ".mjs")
          });
        }
      }
      if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
        for (const stmt of node.body.statements) {
          if (ts.isExportDeclaration(stmt) && stmt.exportClause) {
            if (ts.isNamespaceExport(stmt.exportClause)) {
              continue;
            }
            for (const decl2 of stmt.exportClause.elements) {
              if (decl2.propertyName && decl2.propertyName.getText() == decl2.name.getText()) {
                namespaces.unshift({
                  name: "",
                  exports: [],
                  location: {
                    start: decl2.propertyName.getEnd(),
                    end: decl2.name.getEnd()
                  }
                });
              }
            }
          }
        }
      }
      if (ts.isClassDeclaration(node)) {
        items[node.name.getText()] = { type: "class", generics: node.typeParameters };
      } else if (ts.isFunctionDeclaration(node)) {
        items[node.name.getText()] = { type: "function" };
      } else if (ts.isInterfaceDeclaration(node)) {
        items[node.name.getText()] = { type: "interface", generics: node.typeParameters };
      } else if (ts.isTypeAliasDeclaration(node)) {
        items[node.name.getText()] = { type: "type", generics: node.typeParameters };
      } else if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
        items[node.name.getText()] = { type: "namespace" };
      } else if (ts.isEnumDeclaration(node)) {
        items[node.name.getText()] = { type: "enum" };
      }
      if (!ts.isVariableStatement(node)) {
        continue;
      }
      const { declarations } = node.declarationList;
      if (declarations.length !== 1) {
        continue;
      }
      const decl = declarations[0];
      const name = decl.name.getText();
      if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
        items[name] = { type: "var" };
        continue;
      }
      const obj = decl.initializer.arguments[0];
      if (!decl.initializer.expression.getFullText().includes("/*#__PURE__*/Object.freeze") || !ts.isObjectLiteralExpression(obj)) {
        continue;
      }
      const exports$1 = [];
      for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop) || !(ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) || prop.name.text !== "__proto__" && !ts.isIdentifier(prop.initializer)) {
          throw new UnsupportedSyntaxError(prop, "Expected a property assignment");
        }
        if (prop.name.text === "__proto__") {
          continue;
        }
        exports$1.push({
          exportedName: prop.name.text,
          localName: prop.initializer.getText()
        });
      }
      namespaces.unshift({
        name,
        exports: exports$1,
        location
      });
    }
    return { namespaces, itemTypes: items };
  }
  fix() {
    let code = this.sourceFile.getFullText();
    const { namespaces, itemTypes } = this.findNamespaces();
    for (const ns of namespaces) {
      const codeAfter = code.slice(ns.location.end);
      code = code.slice(0, ns.location.start);
      for (const { exportedName, localName } of ns.exports) {
        if (exportedName === localName) {
          const { type, generics } = itemTypes[localName] || {};
          if (type === "interface" || type === "type") {
            const typeParams = renderTypeParams(generics);
            code += `type ${ns.name}_${exportedName}${typeParams.in} = ${localName}${typeParams.out};
`;
          } else if (type === "enum" || type === "class") {
            const typeParams = renderTypeParams(generics);
            code += `type ${ns.name}_${exportedName}${typeParams.in} = ${localName}${typeParams.out};
`;
            code += `declare const ${ns.name}_${exportedName}: typeof ${localName};
`;
          } else if (type === "namespace") {
            code += `import ${ns.name}_${exportedName} = ${localName};
`;
          } else {
            code += `declare const ${ns.name}_${exportedName}: typeof ${localName};
`;
          }
        }
      }
      if (ns.name) {
        code += `declare namespace ${ns.name} {
`;
        code += `  export {
`;
        for (const { exportedName, localName } of ns.exports) {
          if (exportedName === localName) {
            code += `    ${ns.name}_${exportedName} as ${exportedName},
`;
          } else {
            code += `    ${localName} as ${exportedName},
`;
          }
        }
        code += `  };
`;
        code += `}`;
      }
      code += ns.textBeforeCodeAfter ?? "";
      code += codeAfter;
    }
    return code;
  }
}
function renderTypeParams(typeParameters) {
  if (!typeParameters || !typeParameters.length) {
    return { in: "", out: "" };
  }
  return {
    in: `<${typeParameters.map((param) => param.getText()).join(", ")}>`,
    out: `<${typeParameters.map((param) => param.name.getText()).join(", ")}>`
  };
}
let IDs = 1;
function createProgram(node) {
  return withStartEnd({
    type: "Program",
    sourceType: "module",
    body: []
  }, { start: node.getFullStart(), end: node.getEnd() });
}
function createReference(id) {
  const ident = {
    type: "Identifier",
    name: String(IDs++)
  };
  return {
    ident,
    expr: {
      type: "AssignmentPattern",
      left: ident,
      right: id
    }
  };
}
function createIdentifier(node) {
  return withStartEnd({
    type: "Identifier",
    name: node.getText()
  }, node);
}
function createIIFE(range) {
  const fn = withStartEnd({
    type: "FunctionExpression",
    id: null,
    params: [],
    body: { type: "BlockStatement", body: [] }
  }, range);
  const iife = withStartEnd({
    type: "ExpressionStatement",
    expression: {
      type: "CallExpression",
      callee: { type: "Identifier", name: String(IDs++) },
      arguments: [fn],
      optional: false
    }
  }, range);
  return { fn, iife };
}
function createReturn() {
  const expr = {
    type: "ArrayExpression",
    elements: []
  };
  return {
    expr,
    stmt: {
      type: "ReturnStatement",
      argument: expr
    }
  };
}
function createDeclaration(id, range) {
  return withStartEnd({
    type: "FunctionDeclaration",
    id: withStartEnd({
      type: "Identifier",
      name: ts.idText(id)
    }, id),
    params: [],
    body: { type: "BlockStatement", body: [] }
  }, range);
}
function convertExpression(node) {
  if (ts.isLiteralExpression(node)) {
    return { type: "Literal", value: node.text };
  }
  if (ts.isPropertyAccessExpression(node)) {
    if (ts.isPrivateIdentifier(node.name)) {
      throw new UnsupportedSyntaxError(node.name);
    }
    return withStartEnd({
      type: "MemberExpression",
      computed: false,
      optional: false,
      object: convertExpression(node.expression),
      property: convertExpression(node.name)
    }, {
      start: node.expression.getStart(),
      end: node.name.getEnd()
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    return withStartEnd({
      type: "ObjectExpression",
      properties: node.properties.map((prop) => {
        if (ts.isPropertyAssignment(prop)) {
          return withStartEnd({
            type: "Property",
            key: ts.isIdentifier(prop.name) ? createIdentifier(prop.name) : convertExpression(prop.name),
            value: convertExpression(prop.initializer),
            kind: "init",
            method: false,
            shorthand: false,
            computed: ts.isComputedPropertyName(prop.name)
          }, prop);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          return withStartEnd({
            type: "Property",
            key: createIdentifier(prop.name),
            value: createIdentifier(prop.name),
            kind: "init",
            method: false,
            shorthand: true,
            computed: false
          }, prop);
        } else {
          throw new UnsupportedSyntaxError(prop, "Unsupported property type in object literal");
        }
      })
    }, node);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return withStartEnd({
      type: "ArrayExpression",
      elements: node.elements.map((elem) => {
        if (ts.isExpression(elem)) {
          return convertExpression(elem);
        } else {
          throw new UnsupportedSyntaxError(elem, "Unsupported element type in array literal");
        }
      })
    }, node);
  }
  if (ts.isIdentifier(node)) {
    return createIdentifier(node);
  } else if (node.kind == ts.SyntaxKind.NullKeyword) {
    return { type: "Literal", value: null };
  } else {
    throw new UnsupportedSyntaxError(node);
  }
}
function withStartEnd(esNode, nodeOrRange) {
  const range = "start" in nodeOrRange ? nodeOrRange : { start: nodeOrRange.getStart(), end: nodeOrRange.getEnd() };
  return Object.assign(esNode, range);
}
function matchesModifier(node, flags) {
  const nodeFlags = ts.getCombinedModifierFlags(node);
  return (nodeFlags & flags) === flags;
}
class LanguageService {
  constructor(code) {
    this.fileName = "index.d.ts";
    const serviceHost = {
      getCompilationSettings: () => ({
        noEmit: true,
        noResolve: true,
        skipLibCheck: true,
        declaration: false,
        checkJs: false,
        declarationMap: false,
        target: ts.ScriptTarget.ESNext
      }),
      getScriptFileNames: () => [this.fileName],
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => fileName === this.fileName ? ts.ScriptSnapshot.fromString(code) : void 0,
      getCurrentDirectory: () => "",
      getDefaultLibFileName: () => "",
      fileExists: (fileName) => fileName === this.fileName,
      readFile: (fileName) => fileName === this.fileName ? code : void 0
    };
    this.service = ts.createLanguageService(serviceHost, ts.createDocumentRegistry(void 0, ""), ts.LanguageServiceMode.PartialSemantic);
  }
  findReferenceCount(node) {
    const referencedSymbols = this.service.findReferences(this.fileName, node.getStart());
    if (!referencedSymbols?.length) {
      return 0;
    }
    return referencedSymbols.reduce((total, symbol) => total + symbol.references.length, 0);
  }
}
class TypeOnlyFixer {
  constructor(fileName, rawCode) {
    this.DEBUG = !!process.env.DTS_EXPORTS_FIXER_DEBUG;
    this.types = /* @__PURE__ */ new Set();
    this.values = /* @__PURE__ */ new Set();
    this.typeHints = /* @__PURE__ */ new Map();
    this.reExportTypeHints = /* @__PURE__ */ new Map();
    this.importNodes = [];
    this.exportNodes = [];
    this.rawCode = rawCode;
    this.source = parse(fileName, rawCode);
    this.code = new MagicString(rawCode);
  }
  fix() {
    this.analyze(this.source.statements);
    if (this.typeHints.size || this.reExportTypeHints.size) {
      this.service = new LanguageService(this.rawCode);
      this.importNodes.forEach((node) => this.fixTypeOnlyImport(node));
    }
    if (this.types.size) {
      this.exportNodes.forEach((node) => this.fixTypeOnlyExport(node));
    }
    return this.types.size ? {
      magicCode: this.code
    } : {
      code: this.rawCode,
      map: null
    };
  }
  fixTypeOnlyImport(node) {
    let hasRemoved = false;
    const typeImports = [];
    const valueImports = [];
    const specifier = node.moduleSpecifier.getText();
    const nameNode = node.importClause.name;
    const namedBindings = node.importClause.namedBindings;
    if (nameNode) {
      const name = nameNode.text;
      if (this.isTypeOnly(name)) {
        if (this.isUselessImport(nameNode)) {
          hasRemoved = true;
        } else {
          typeImports.push(`import type ${name} from ${specifier};`);
        }
      } else {
        valueImports.push(`import ${name} from ${specifier};`);
      }
    }
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      const name = namedBindings.name.text;
      if (this.isTypeOnly(name)) {
        if (this.isUselessImport(namedBindings.name)) {
          hasRemoved = true;
        } else {
          typeImports.push(`import type * as ${name} from ${specifier};`);
        }
      } else {
        valueImports.push(`import * as ${name} from ${specifier};`);
      }
    }
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      const typeNames = [];
      const valueNames = [];
      for (const element of namedBindings.elements) {
        if (this.isTypeOnly(element.name.text)) {
          if (this.isUselessImport(element.name)) {
            hasRemoved = true;
          } else {
            typeNames.push(element.getText());
          }
        } else {
          valueNames.push(element.getText());
        }
      }
      if (typeNames.length) {
        typeImports.push(`import type { ${typeNames.join(", ")} } from ${specifier};`);
      }
      if (valueNames.length) {
        valueImports.push(`import { ${valueNames.join(", ")} } from ${specifier};`);
      }
    }
    if (typeImports.length || hasRemoved) {
      this.code.overwrite(node.getStart(), node.getEnd(), [...valueImports, ...typeImports].join(`
${getNodeIndent(node)}`));
    }
  }
  fixTypeOnlyExport(node) {
    const typeExports = [];
    const valueExports = [];
    const specifier = node.moduleSpecifier?.getText();
    if (ts.isNamespaceExport(node.exportClause)) {
      const name = node.exportClause.name.text;
      if (this.isReExportTypeOnly(name)) {
        typeExports.push(`export type * as ${name} from ${specifier};`);
      } else {
        valueExports.push(`export * as ${name} from ${specifier};`);
      }
    }
    if (ts.isNamedExports(node.exportClause)) {
      const typeNames = [];
      const valueNames = [];
      for (const element of node.exportClause.elements) {
        const name = element.propertyName?.text || element.name.text;
        const isType = node.moduleSpecifier ? this.isReExportTypeOnly(element.name.text) : this.isTypeOnly(name);
        if (isType) {
          typeNames.push(element.getText());
        } else {
          valueNames.push(element.getText());
        }
      }
      if (typeNames.length) {
        typeExports.push(`export type { ${typeNames.join(", ")} }${specifier ? ` from ${specifier}` : ""};`);
      }
      if (valueNames.length) {
        valueExports.push(`export { ${valueNames.join(", ")} }${specifier ? ` from ${specifier}` : ""};`);
      }
    }
    if (typeExports.length) {
      this.code.overwrite(node.getStart(), node.getEnd(), [...valueExports, ...typeExports].join(`
${getNodeIndent(node)}`));
    }
  }
  analyze(nodes) {
    for (const node of nodes) {
      this.DEBUG && console.log(node.getText(), node.kind);
      if (ts.isImportDeclaration(node) && node.importClause) {
        this.importNodes.push(node);
        continue;
      }
      if (ts.isExportDeclaration(node) && node.exportClause) {
        this.exportNodes.push(node);
        continue;
      }
      if (ts.isInterfaceDeclaration(node)) {
        this.DEBUG && console.log(`${node.name.getFullText()} is a type`);
        this.types.add(node.name.text);
        continue;
      }
      if (ts.isTypeAliasDeclaration(node)) {
        const alias = node.name.text;
        this.DEBUG && console.log(`${node.name.getFullText()} is a type`);
        this.types.add(alias);
        continue;
      }
      if (ts.isEnumDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isVariableStatement(node)) {
        if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) {
              this.DEBUG && console.log(`${declaration.name.getFullText()} is a value (from var statement)`);
              this.values.add(declaration.name.text);
            }
          }
        } else {
          if (node.name) {
            this.DEBUG && console.log(`${node.name.getFullText()} is a value (from declaration)`);
            this.values.add(node.name.text);
          }
        }
        continue;
      }
      if (ts.isModuleBlock(node)) {
        this.analyze(node.statements);
        continue;
      }
      if (ts.isModuleDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          this.DEBUG && console.log(`${node.name.getFullText()} is a value (from module declaration)`);
          this.values.add(node.name.text);
        }
        this.analyze(node.getChildren());
        continue;
      }
      this.DEBUG && console.log("unhandled statement", node.getFullText(), node.kind);
    }
  }
  // The type-hint statements may lead to redundant import statements.
  // After type-hint statements been removed,
  // it is better to also remove these redundant import statements as well.
  // Of course, this is not necessary since it won't cause issues,
  // but it can make the output bundles cleaner :)
  isUselessImport(node) {
    const referenceCount = this.service.findReferenceCount(node);
    const typeHintCount = this.typeHints.get(node.text);
    return typeHintCount && typeHintCount + 1 >= referenceCount;
  }
  isTypeOnly(name) {
    return this.typeHints.has(name) || this.types.has(name) && !this.values.has(name);
  }
  isReExportTypeOnly(name) {
    return this.reExportTypeHints.has(name);
  }
}
function getNodeIndent(node) {
  const match = node.getFullText().match(/^(?:\n*)([ ]*)/);
  return " ".repeat(match?.[1]?.length || 0);
}
function preProcessNamespaceBody(body, code, sourceFile) {
  for (const stmt of body.statements) {
    fixModifiers(code, stmt);
    if (ts.isModuleDeclaration(stmt) && stmt.body && ts.isModuleBlock(stmt.body)) {
      preProcessNamespaceBody(stmt.body, code);
    }
  }
}
function preProcess({ sourceFile, isEntry, isJSON }) {
  const code = new MagicString(sourceFile.getFullText());
  const treatAsGlobalModule = !isEntry && isGlobalModule(sourceFile);
  const declaredNames = /* @__PURE__ */ new Set();
  const exportedNames = /* @__PURE__ */ new Set();
  let defaultExport = "";
  const inlineImports = /* @__PURE__ */ new Map();
  const nameRanges = /* @__PURE__ */ new Map();
  for (const node of sourceFile.statements) {
    if (ts.isEmptyStatement(node)) {
      code.remove(node.getStart(), node.getEnd());
      continue;
    }
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause) {
        continue;
      }
      if (node.importClause.name) {
        declaredNames.add(node.importClause.name.text);
      }
      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          declaredNames.add(node.importClause.namedBindings.name.text);
        } else {
          node.importClause.namedBindings.elements.forEach((element) => declaredNames.add(element.name.text));
        }
      }
    } else if (ts.isEnumDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isModuleDeclaration(node)) {
      if (node.name) {
        const name = node.name.getText();
        declaredNames.add(name);
        if (matchesModifier(node, ts.ModifierFlags.ExportDefault)) {
          defaultExport = name;
        } else if (treatAsGlobalModule && ts.isIdentifier(node.name) || matchesModifier(node, ts.ModifierFlags.Export)) {
          exportedNames.add(name);
        }
        if (!(node.flags & ts.NodeFlags.GlobalAugmentation)) {
          pushNamedNode(name, [getStart(node), getEnd(node)]);
        }
      }
      if (ts.isModuleDeclaration(node)) {
        if (node.body && ts.isModuleBlock(node.body)) {
          preProcessNamespaceBody(node.body, code);
        }
        duplicateExports(code, node);
      }
      fixModifiers(code, node);
    } else if (ts.isVariableStatement(node)) {
      const { declarations } = node.declarationList;
      const isExport = matchesModifier(node, ts.ModifierFlags.Export);
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.getText();
          declaredNames.add(name);
          if (treatAsGlobalModule || isExport) {
            exportedNames.add(name);
          }
        }
      }
      fixModifiers(code, node);
      if (declarations.length === 1) {
        const decl = declarations[0];
        if (ts.isIdentifier(decl.name)) {
          pushNamedNode(decl.name.getText(), [getStart(node), getEnd(node)]);
        }
      } else {
        const decls = declarations.slice();
        const first = decls.shift();
        pushNamedNode(first.name.getText(), [getStart(node), first.getEnd()]);
        for (const decl of decls) {
          if (ts.isIdentifier(decl.name)) {
            pushNamedNode(decl.name.getText(), [decl.getFullStart(), decl.getEnd()]);
          }
        }
      }
      const { flags } = node.declarationList;
      const type = flags & ts.NodeFlags.Let ? "let" : flags & ts.NodeFlags.Const ? "const" : "var";
      const prefix = `declare ${type} `;
      const list = node.declarationList.getChildren().find((c) => c.kind === ts.SyntaxKind.SyntaxList).getChildren();
      let commaPos = 0;
      for (const node2 of list) {
        if (node2.kind === ts.SyntaxKind.CommaToken) {
          commaPos = node2.getStart();
          code.remove(commaPos, node2.getEnd());
        } else if (commaPos) {
          code.appendLeft(commaPos, ";\n");
          const start = node2.getFullStart();
          const slice = code.slice(start, node2.getStart());
          const whitespace = slice.length - slice.trimStart().length;
          if (whitespace) {
            code.overwrite(start, start + whitespace, prefix);
          } else {
            code.appendLeft(start, prefix);
          }
        }
      }
    }
  }
  for (const node of sourceFile.statements) {
    checkInlineImport(node);
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      if (ts.isObjectLiteralExpression(node.expression) || ts.isArrayLiteralExpression(node.expression)) {
        if (!defaultExport) {
          defaultExport = uniqName("export_default");
        }
        code.overwrite(node.getStart(), node.expression.getStart(), `declare var ${defaultExport} = `);
        continue;
      }
    }
    if (!matchesModifier(node, ts.ModifierFlags.ExportDefault)) {
      continue;
    }
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      if (node.name) {
        continue;
      }
      if (!defaultExport) {
        defaultExport = uniqName("export_default");
      }
      const children = node.getChildren();
      const idx = children.findIndex((node2) => node2.kind === ts.SyntaxKind.ClassKeyword || node2.kind === ts.SyntaxKind.FunctionKeyword);
      const token = children[idx];
      const nextToken = children[idx + 1];
      const isPunctuation = nextToken.kind >= ts.SyntaxKind.FirstPunctuation && nextToken.kind <= ts.SyntaxKind.LastPunctuation;
      if (isPunctuation) {
        const addSpace = code.slice(token.getEnd(), nextToken.getStart()) != " ";
        code.appendLeft(nextToken.getStart(), `${addSpace ? " " : ""}${defaultExport}`);
      } else {
        code.appendRight(token.getEnd(), ` ${defaultExport}`);
      }
    }
  }
  for (const ranges of nameRanges.values()) {
    const last = ranges.pop();
    const start = last[0];
    for (const node of ranges) {
      code.move(node[0], node[1], start);
    }
  }
  if (defaultExport) {
    code.append(`
export default ${defaultExport};
`);
  }
  if (exportedNames.size) {
    code.append(`
export { ${[...exportedNames].join(", ")} };
`);
  }
  if (isJSON && exportedNames.size) {
    defaultExport = uniqName("export_default");
    code.append([
      `
declare const ${defaultExport}: {`,
      [...exportedNames].map((name) => `  ${name}: typeof ${name};`).join("\n"),
      `};`,
      `export default ${defaultExport};
`
    ].join("\n"));
  }
  for (const [fileId, importName] of inlineImports.entries()) {
    code.prepend(`import * as ${importName} from "${fileId}";
`);
  }
  const lineStarts = sourceFile.getLineStarts();
  const typeReferences = /* @__PURE__ */ new Set();
  for (const ref of sourceFile.typeReferenceDirectives) {
    typeReferences.add(ref.fileName);
    const { line } = sourceFile.getLineAndCharacterOfPosition(ref.pos);
    const start = lineStarts[line];
    let end = sourceFile.getLineEndOfPosition(ref.pos);
    if (code.slice(end, end + 1) === "\n") {
      end += 1;
    }
    code.remove(start, end);
  }
  const fileReferences = /* @__PURE__ */ new Set();
  for (const ref of sourceFile.referencedFiles) {
    fileReferences.add(ref.fileName);
    const { line } = sourceFile.getLineAndCharacterOfPosition(ref.pos);
    const start = lineStarts[line];
    let end = sourceFile.getLineEndOfPosition(ref.pos);
    if (code.slice(end, end + 1) === "\n") {
      end += 1;
    }
    code.remove(start, end);
  }
  return {
    code,
    typeReferences,
    fileReferences
  };
  function checkInlineImport(node) {
    ts.forEachChild(node, checkInlineImport);
    if (ts.isImportTypeNode(node)) {
      if (!ts.isLiteralTypeNode(node.argument) || !ts.isStringLiteral(node.argument.literal)) {
        throw new UnsupportedSyntaxError(node, "inline imports should have a literal argument");
      }
      const fileId = node.argument.literal.text;
      const children = node.getChildren();
      const start = children.find((t) => t.kind === ts.SyntaxKind.ImportKeyword).getStart();
      let end = node.getEnd();
      const token = children.find((t) => t.kind === ts.SyntaxKind.DotToken || t.kind === ts.SyntaxKind.LessThanToken);
      if (token) {
        end = token.getStart();
      }
      const importName = createNamespaceImport(fileId);
      code.overwrite(start, end, importName);
    }
  }
  function createNamespaceImport(fileId) {
    let importName = inlineImports.get(fileId);
    if (!importName) {
      importName = uniqName(getSafeName(fileId));
      inlineImports.set(fileId, importName);
    }
    return importName;
  }
  function uniqName(hint) {
    let name = hint;
    while (declaredNames.has(name)) {
      name = `_${name}`;
    }
    declaredNames.add(name);
    return name;
  }
  function pushNamedNode(name, range) {
    let nodes = nameRanges.get(name);
    if (!nodes) {
      nodes = [range];
      nameRanges.set(name, nodes);
    } else {
      const last = nodes[nodes.length - 1];
      if (last[1] === range[0]) {
        last[1] = range[1];
      } else {
        nodes.push(range);
      }
    }
  }
}
function isGlobalModule(sourceFile) {
  let isModule = false;
  for (const node of sourceFile.statements) {
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      return false;
    }
    if (isModule || ts.isImportDeclaration(node) || matchesModifier(node, ts.ModifierFlags.Export)) {
      isModule = true;
    }
  }
  return isModule;
}
function fixModifiers(code, node) {
  if (!ts.canHaveModifiers(node)) {
    return;
  }
  const isTopLevel = node.parent.kind === ts.SyntaxKind.SourceFile;
  if (isTopLevel) {
    let hasDeclare = false;
    const needsDeclare = ts.isEnumDeclaration(node) || ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isModuleDeclaration(node) || ts.isVariableStatement(node);
    for (const mod of node.modifiers ?? []) {
      switch (mod.kind) {
        case ts.SyntaxKind.ExportKeyword:
        // fall through
        case ts.SyntaxKind.DefaultKeyword:
          code.remove(mod.getStart(), mod.getEnd() + 1);
          break;
        case ts.SyntaxKind.DeclareKeyword:
          hasDeclare = true;
      }
    }
    if (needsDeclare && !hasDeclare) {
      code.appendRight(node.getStart(), "declare ");
    }
  }
}
function duplicateExports(code, module) {
  if (!module.body || !ts.isModuleBlock(module.body)) {
    return;
  }
  for (const node of module.body.statements) {
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamespaceExport(node.exportClause)) {
        continue;
      }
      for (const decl of node.exportClause.elements) {
        if (!decl.propertyName) {
          code.appendLeft(decl.name.getEnd(), ` as ${decl.name.getText()}`);
        }
      }
    }
  }
}
function getSafeName(fileId) {
  return fileId.replace(/[^a-zA-Z0-9_$]/g, () => "_");
}
function getStart(node) {
  const start = node.getFullStart();
  return start + (newlineAt(node, start) ? 1 : 0);
}
function getEnd(node) {
  const end = node.getEnd();
  return end + (newlineAt(node, end) ? 1 : 0);
}
function newlineAt(node, idx) {
  return node.getSourceFile().getFullText()[idx] === "\n";
}
const IGNORE_TYPENODES = /* @__PURE__ */ new Set([
  ts.SyntaxKind.LiteralType,
  ts.SyntaxKind.VoidKeyword,
  ts.SyntaxKind.UnknownKeyword,
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.BooleanKeyword,
  ts.SyntaxKind.NumberKeyword,
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.ObjectKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.NeverKeyword,
  ts.SyntaxKind.ThisKeyword,
  ts.SyntaxKind.ThisType,
  ts.SyntaxKind.BigIntKeyword
]);
class DeclarationScope {
  constructor({ id, range }) {
    this.scopes = [];
    if (id) {
      this.declaration = createDeclaration(id, range);
    } else {
      const { iife, fn } = createIIFE(range);
      this.iife = iife;
      this.declaration = fn;
    }
    const ret = createReturn();
    this.declaration.body.body.push(ret.stmt);
    this.returnExpr = ret.expr;
  }
  pushScope() {
    this.scopes.push(/* @__PURE__ */ new Set());
  }
  popScope(n = 1) {
    for (let i = 0; i < n; i++) {
      this.scopes.pop();
    }
  }
  pushTypeVariable(id) {
    const name = id.getText();
    this.scopes[this.scopes.length - 1]?.add(name);
  }
  pushReference(id) {
    let name;
    if (id.type === "Identifier") {
      name = id.name;
    } else if (id.type === "MemberExpression") {
      if (id.object.type === "Identifier") {
        name = id.object.name;
      }
    }
    if (name) {
      for (const scope of this.scopes) {
        if (scope.has(name)) {
          return;
        }
      }
    }
    if (name === "this")
      return;
    const { ident, expr } = createReference(id);
    this.declaration.params.push(expr);
    this.returnExpr.elements.push(ident);
  }
  pushIdentifierReference(id) {
    this.pushReference(createIdentifier(id));
  }
  convertEntityName(node) {
    if (ts.isIdentifier(node)) {
      return createIdentifier(node);
    }
    return withStartEnd({
      type: "MemberExpression",
      computed: false,
      optional: false,
      object: this.convertEntityName(node.left),
      property: createIdentifier(node.right)
    }, node);
  }
  convertPropertyAccess(node) {
    if (!ts.isIdentifier(node.expression) && !ts.isPropertyAccessExpression(node.expression)) {
      throw new UnsupportedSyntaxError(node.expression);
    }
    if (ts.isPrivateIdentifier(node.name)) {
      throw new UnsupportedSyntaxError(node.name);
    }
    const object = ts.isIdentifier(node.expression) ? createIdentifier(node.expression) : this.convertPropertyAccess(node.expression);
    return withStartEnd({
      type: "MemberExpression",
      computed: false,
      optional: false,
      object,
      property: createIdentifier(node.name)
    }, node);
  }
  convertComputedPropertyName(node) {
    if (!node.name || !ts.isComputedPropertyName(node.name)) {
      return;
    }
    const { expression } = node.name;
    if (ts.isLiteralExpression(expression) || ts.isPrefixUnaryExpression(expression)) {
      return;
    }
    if (ts.isIdentifier(expression)) {
      return this.pushReference(createIdentifier(expression));
    }
    if (ts.isPropertyAccessExpression(expression)) {
      return this.pushReference(this.convertPropertyAccess(expression));
    }
    throw new UnsupportedSyntaxError(expression);
  }
  convertParametersAndType(node) {
    this.convertComputedPropertyName(node);
    const typeVariables = this.convertTypeParameters(node.typeParameters);
    for (const param of node.parameters) {
      this.convertTypeNode(param.type);
    }
    this.convertTypeNode(node.type);
    this.popScope(typeVariables);
  }
  convertHeritageClauses(node) {
    for (const heritage of node.heritageClauses || []) {
      for (const type of heritage.types) {
        this.pushReference(convertExpression(type.expression));
        this.convertTypeArguments(type);
      }
    }
  }
  convertTypeArguments(node) {
    if (!node.typeArguments) {
      return;
    }
    for (const arg of node.typeArguments) {
      this.convertTypeNode(arg);
    }
  }
  convertMembers(members) {
    for (const node of members) {
      if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isIndexSignatureDeclaration(node)) {
        if (ts.isPropertyDeclaration(node) && node.initializer && ts.isPropertyAccessExpression(node.initializer)) {
          this.pushReference(this.convertPropertyAccess(node.initializer));
        }
        this.convertComputedPropertyName(node);
        this.convertTypeNode(node.type);
        continue;
      }
      if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isConstructorDeclaration(node) || ts.isConstructSignatureDeclaration(node) || ts.isCallSignatureDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
        this.convertParametersAndType(node);
      } else {
        throw new UnsupportedSyntaxError(node);
      }
    }
  }
  convertTypeParameters(params) {
    if (!params) {
      return 0;
    }
    for (const node of params) {
      this.convertTypeNode(node.constraint);
      this.convertTypeNode(node.default);
      this.pushScope();
      this.pushTypeVariable(node.name);
    }
    return params.length;
  }
  convertTypeNode(node) {
    if (!node) {
      return;
    }
    if (IGNORE_TYPENODES.has(node.kind)) {
      return;
    }
    if (ts.isTypeReferenceNode(node)) {
      this.pushReference(this.convertEntityName(node.typeName));
      this.convertTypeArguments(node);
      return;
    }
    if (ts.isTypeLiteralNode(node)) {
      this.convertMembers(node.members);
      return;
    }
    if (ts.isArrayTypeNode(node)) {
      this.convertTypeNode(node.elementType);
      return;
    }
    if (ts.isTupleTypeNode(node)) {
      for (const type of node.elements) {
        this.convertTypeNode(type);
      }
      return;
    }
    if (ts.isNamedTupleMember(node) || ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node) || ts.isTypePredicateNode(node)) {
      this.convertTypeNode(node.type);
      return;
    }
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) {
        this.convertTypeNode(type);
      }
      return;
    }
    if (ts.isMappedTypeNode(node)) {
      const { typeParameter, type, nameType } = node;
      this.convertTypeNode(typeParameter.constraint);
      this.pushScope();
      this.pushTypeVariable(typeParameter.name);
      this.convertTypeNode(type);
      if (nameType) {
        this.convertTypeNode(nameType);
      }
      this.popScope();
      return;
    }
    if (ts.isConditionalTypeNode(node)) {
      this.convertTypeNode(node.checkType);
      this.pushScope();
      this.convertTypeNode(node.extendsType);
      this.convertTypeNode(node.trueType);
      this.convertTypeNode(node.falseType);
      this.popScope();
      return;
    }
    if (ts.isIndexedAccessTypeNode(node)) {
      this.convertTypeNode(node.objectType);
      this.convertTypeNode(node.indexType);
      return;
    }
    if (ts.isFunctionOrConstructorTypeNode(node)) {
      this.convertParametersAndType(node);
      return;
    }
    if (ts.isTypeQueryNode(node)) {
      const reference = this.convertEntityName(node.exprName);
      this.pushReference(reference);
      this.convertTypeArguments(node);
      return;
    }
    if (ts.isRestTypeNode(node)) {
      this.convertTypeNode(node.type);
      return;
    }
    if (ts.isOptionalTypeNode(node)) {
      this.convertTypeNode(node.type);
      return;
    }
    if (ts.isTemplateLiteralTypeNode(node)) {
      for (const span of node.templateSpans) {
        this.convertTypeNode(span.type);
      }
      return;
    }
    if (ts.isInferTypeNode(node)) {
      const { typeParameter } = node;
      this.convertTypeNode(typeParameter.constraint);
      this.pushTypeVariable(typeParameter.name);
      return;
    } else {
      throw new UnsupportedSyntaxError(node);
    }
  }
  convertNamespace(node, relaxedModuleBlock = false) {
    this.pushScope();
    if (relaxedModuleBlock && node.body && ts.isModuleDeclaration(node.body)) {
      this.convertNamespace(node.body, true);
      return;
    }
    if (!node.body || !ts.isModuleBlock(node.body)) {
      throw new UnsupportedSyntaxError(node, `namespace must have a "ModuleBlock" body.`);
    }
    const { statements } = node.body;
    for (const stmt of statements) {
      if (ts.isEnumDeclaration(stmt) || ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isModuleDeclaration(stmt)) {
        if (stmt.name && ts.isIdentifier(stmt.name)) {
          this.pushTypeVariable(stmt.name);
        } else {
          throw new UnsupportedSyntaxError(stmt, "non-Identifier name not supported");
        }
        continue;
      }
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            this.pushTypeVariable(decl.name);
          } else {
            throw new UnsupportedSyntaxError(decl, "non-Identifier name not supported");
          }
        }
        continue;
      }
      if (ts.isImportDeclaration(stmt)) {
        if (stmt.importClause) {
          if (stmt.importClause.name) {
            this.pushTypeVariable(stmt.importClause.name);
          }
          if (stmt.importClause.namedBindings) {
            if (ts.isNamespaceImport(stmt.importClause.namedBindings)) {
              this.pushTypeVariable(stmt.importClause.namedBindings.name);
            } else {
              for (const el of stmt.importClause.namedBindings.elements) {
                this.pushTypeVariable(el.name);
              }
            }
          }
        }
        continue;
      }
      if (ts.isImportEqualsDeclaration(stmt)) {
        this.pushTypeVariable(stmt.name);
        continue;
      }
      if (ts.isExportDeclaration(stmt)) ;
      else {
        throw new UnsupportedSyntaxError(stmt, "namespace child (hoisting) not supported yet");
      }
    }
    for (const stmt of statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (decl.type) {
            this.convertTypeNode(decl.type);
          }
        }
        continue;
      }
      if (ts.isFunctionDeclaration(stmt)) {
        this.convertParametersAndType(stmt);
        continue;
      }
      if (ts.isInterfaceDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
        const typeVariables = this.convertTypeParameters(stmt.typeParameters);
        this.convertHeritageClauses(stmt);
        this.convertMembers(stmt.members);
        this.popScope(typeVariables);
        continue;
      }
      if (ts.isTypeAliasDeclaration(stmt)) {
        const typeVariables = this.convertTypeParameters(stmt.typeParameters);
        this.convertTypeNode(stmt.type);
        this.popScope(typeVariables);
        continue;
      }
      if (ts.isModuleDeclaration(stmt)) {
        this.convertNamespace(stmt, relaxedModuleBlock);
        continue;
      }
      if (ts.isEnumDeclaration(stmt)) {
        continue;
      }
      if (ts.isImportDeclaration(stmt)) {
        continue;
      }
      if (ts.isImportEqualsDeclaration(stmt)) {
        if (ts.isEntityName(stmt.moduleReference)) {
          this.pushReference(this.convertEntityName(stmt.moduleReference));
        }
        continue;
      }
      if (ts.isExportDeclaration(stmt)) {
        if (stmt.exportClause) {
          if (ts.isNamespaceExport(stmt.exportClause)) {
            throw new UnsupportedSyntaxError(stmt.exportClause);
          }
          for (const decl of stmt.exportClause.elements) {
            const id = decl.propertyName || decl.name;
            this.pushIdentifierReference(id);
          }
        }
      } else {
        throw new UnsupportedSyntaxError(stmt, "namespace child (walking) not supported yet");
      }
    }
    this.popScope();
  }
}
function convert({ sourceFile }) {
  const transformer = new Transformer(sourceFile);
  return transformer.transform();
}
class Transformer {
  constructor(sourceFile) {
    this.sourceFile = sourceFile;
    this.declarations = /* @__PURE__ */ new Map();
    this.ast = createProgram(sourceFile);
    for (const stmt of sourceFile.statements) {
      this.convertStatement(stmt);
    }
  }
  transform() {
    return {
      ast: this.ast
    };
  }
  pushStatement(node) {
    this.ast.body.push(node);
  }
  createDeclaration(node, id) {
    const range = { start: node.getFullStart(), end: node.getEnd() };
    if (!id) {
      const scope2 = new DeclarationScope({ range });
      this.pushStatement(scope2.iife);
      return scope2;
    }
    const name = id.getText();
    const scope = new DeclarationScope({ id, range });
    const existingScope = this.declarations.get(name);
    if (existingScope) {
      existingScope.pushIdentifierReference(id);
      existingScope.declaration.end = range.end;
      const selfIdx = this.ast.body.findIndex((node2) => node2 == existingScope.declaration);
      for (let i = selfIdx + 1; i < this.ast.body.length; i++) {
        const decl = this.ast.body[i];
        decl.start = decl.end = range.end;
      }
    } else {
      this.pushStatement(scope.declaration);
      this.declarations.set(name, scope);
    }
    return existingScope || scope;
  }
  convertStatement(node) {
    if (ts.isEnumDeclaration(node)) {
      return this.convertEnumDeclaration(node);
    }
    if (ts.isFunctionDeclaration(node)) {
      return this.convertFunctionDeclaration(node);
    }
    if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
      return this.convertClassOrInterfaceDeclaration(node);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return this.convertTypeAliasDeclaration(node);
    }
    if (ts.isVariableStatement(node)) {
      return this.convertVariableStatement(node);
    }
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      return this.convertExportDeclaration(node);
    }
    if (ts.isModuleDeclaration(node)) {
      return this.convertNamespaceDeclaration(node);
    }
    if (node.kind === ts.SyntaxKind.NamespaceExportDeclaration) {
      return this.removeStatement(node);
    }
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      return this.convertImportDeclaration(node);
    } else {
      throw new UnsupportedSyntaxError(node);
    }
  }
  removeStatement(node) {
    this.pushStatement(withStartEnd({
      type: "ExpressionStatement",
      expression: { type: "Literal", value: "pls remove me" }
    }, node));
  }
  convertNamespaceDeclaration(node) {
    const isGlobalAugmentation = node.flags & ts.NodeFlags.GlobalAugmentation;
    if (isGlobalAugmentation || !ts.isIdentifier(node.name)) {
      const scope2 = this.createDeclaration(node);
      scope2.convertNamespace(node, true);
      return;
    }
    const scope = this.createDeclaration(node, node.name);
    scope.pushIdentifierReference(node.name);
    scope.convertNamespace(node);
  }
  convertEnumDeclaration(node) {
    const scope = this.createDeclaration(node, node.name);
    scope.pushIdentifierReference(node.name);
  }
  convertFunctionDeclaration(node) {
    if (!node.name) {
      throw new UnsupportedSyntaxError(node, "FunctionDeclaration should have a name");
    }
    const scope = this.createDeclaration(node, node.name);
    scope.pushIdentifierReference(node.name);
    scope.convertParametersAndType(node);
  }
  convertClassOrInterfaceDeclaration(node) {
    if (!node.name) {
      throw new UnsupportedSyntaxError(node, "ClassDeclaration / InterfaceDeclaration should have a name");
    }
    const scope = this.createDeclaration(node, node.name);
    const typeVariables = scope.convertTypeParameters(node.typeParameters);
    scope.convertHeritageClauses(node);
    scope.convertMembers(node.members);
    scope.popScope(typeVariables);
  }
  convertTypeAliasDeclaration(node) {
    const scope = this.createDeclaration(node, node.name);
    const typeVariables = scope.convertTypeParameters(node.typeParameters);
    scope.convertTypeNode(node.type);
    scope.popScope(typeVariables);
  }
  convertVariableStatement(node) {
    const { declarations } = node.declarationList;
    if (declarations.length !== 1) {
      throw new UnsupportedSyntaxError(node, "VariableStatement with more than one declaration not yet supported");
    }
    for (const decl of declarations) {
      if (!ts.isIdentifier(decl.name)) {
        throw new UnsupportedSyntaxError(node, "VariableDeclaration must have a name");
      }
      const scope = this.createDeclaration(node, decl.name);
      scope.convertTypeNode(decl.type);
      if (decl.initializer) {
        this.trackExpressionReferences(decl.initializer, scope);
      }
    }
  }
  // Helper to track identifier references in expressions
  trackExpressionReferences(expr, scope) {
    if (ts.isIdentifier(expr)) {
      scope.pushIdentifierReference(expr);
    } else if (ts.isObjectLiteralExpression(expr)) {
      for (const prop of expr.properties) {
        if (ts.isShorthandPropertyAssignment(prop)) {
          scope.pushIdentifierReference(prop.name);
        } else if (ts.isPropertyAssignment(prop)) {
          this.trackExpressionReferences(prop.initializer, scope);
        }
      }
    } else if (ts.isArrayLiteralExpression(expr)) {
      for (const elem of expr.elements) {
        if (ts.isExpression(elem)) {
          this.trackExpressionReferences(elem, scope);
        }
      }
    } else if (ts.isPropertyAccessExpression(expr)) {
      this.trackExpressionReferences(expr.expression, scope);
    }
  }
  convertExportDeclaration(node) {
    if (ts.isExportAssignment(node)) {
      this.pushStatement(withStartEnd({
        type: "ExportDefaultDeclaration",
        declaration: convertExpression(node.expression)
      }, node));
      return;
    }
    const source = node.moduleSpecifier ? convertExpression(node.moduleSpecifier) : void 0;
    if (!node.exportClause) {
      this.pushStatement(withStartEnd({
        type: "ExportAllDeclaration",
        source,
        exported: null,
        attributes: []
      }, node));
    } else if (ts.isNamespaceExport(node.exportClause)) {
      this.pushStatement(withStartEnd({
        type: "ExportAllDeclaration",
        source,
        exported: createIdentifier(node.exportClause.name),
        attributes: []
      }, node));
    } else {
      const specifiers = [];
      for (const elem of node.exportClause.elements) {
        specifiers.push(this.convertExportSpecifier(elem));
      }
      this.pushStatement(withStartEnd({
        type: "ExportNamedDeclaration",
        declaration: null,
        specifiers,
        source,
        attributes: []
      }, node));
    }
  }
  convertImportDeclaration(node) {
    if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isEntityName(node.moduleReference)) {
        const scope = this.createDeclaration(node, node.name);
        scope.pushReference(scope.convertEntityName(node.moduleReference));
        return;
      }
      if (!ts.isExternalModuleReference(node.moduleReference)) {
        throw new UnsupportedSyntaxError(node, "ImportEquals should have a literal source.");
      }
      this.pushStatement(withStartEnd({
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: createIdentifier(node.name)
          }
        ],
        source: convertExpression(node.moduleReference.expression),
        attributes: []
      }, node));
      return;
    }
    const source = convertExpression(node.moduleSpecifier);
    const specifiers = node.importClause && node.importClause.namedBindings ? this.convertNamedImportBindings(node.importClause.namedBindings) : [];
    if (node.importClause && node.importClause.name) {
      specifiers.push({
        type: "ImportDefaultSpecifier",
        local: createIdentifier(node.importClause.name)
      });
    }
    this.pushStatement(withStartEnd({
      type: "ImportDeclaration",
      specifiers,
      source,
      attributes: []
    }, node));
  }
  convertNamedImportBindings(node) {
    if (ts.isNamedImports(node)) {
      return node.elements.map((el) => {
        const local = createIdentifier(el.name);
        const imported = el.propertyName ? createIdentifier(el.propertyName) : local;
        return {
          type: "ImportSpecifier",
          local,
          imported
        };
      });
    }
    return [
      {
        type: "ImportNamespaceSpecifier",
        local: createIdentifier(node.name)
      }
    ];
  }
  convertExportSpecifier(node) {
    const exported = createIdentifier(node.name);
    return {
      type: "ExportSpecifier",
      exported,
      local: node.propertyName ? createIdentifier(node.propertyName) : exported
    };
  }
}
class RelativeModuleDeclarationFixer {
  constructor(fileName, code, sourcemap, name) {
    this.sourcemap = sourcemap;
    this.DEBUG = !!process.env.DTS_EXPORTS_FIXER_DEBUG;
    this.relativeModuleDeclarations = [];
    this.source = parse(fileName, code.toString());
    this.code = code;
    this.name = name || "./index";
  }
  fix() {
    this.analyze(this.source.statements);
    for (const node of this.relativeModuleDeclarations) {
      const start = node.getStart();
      const end = node.getEnd();
      const quote = node.name.kind === ts.SyntaxKind.StringLiteral && "singleQuote" in node.name && node.name.singleQuote ? "'" : '"';
      const code = `declare module ${quote}${this.name}${quote} ${node.body.getText()}`;
      this.code.overwrite(start, end, code);
    }
    return {
      code: this.code.toString(),
      map: this.relativeModuleDeclarations.length && this.sourcemap ? this.code.generateMap() : null
    };
  }
  analyze(nodes) {
    for (const node of nodes) {
      if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body) && /^\.\.?\//.test(node.name.text)) {
        if (this.DEBUG) {
          console.log(`Found relative module declaration: ${node.name.text} in ${this.source.fileName}`);
        }
        this.relativeModuleDeclarations.push(node);
      }
    }
  }
}
function hydrateSourcemap(sparseMappings, inputMap, outputCode) {
  const sparseDecoded = decode(sparseMappings);
  const inputDecoded = decode(inputMap.mappings);
  const outputLines = outputCode.split("\n");
  const hydratedMappings = [];
  for (let outLine = 0; outLine < sparseDecoded.length; outLine += 1) {
    const sparseSegments = sparseDecoded[outLine];
    if (!sparseSegments || sparseSegments.length === 0) {
      hydratedMappings.push([]);
      continue;
    }
    const anchor = sparseSegments[0];
    if (!anchor || anchor.length < 4) {
      hydratedMappings.push(sparseSegments);
      continue;
    }
    const [, srcIdx, srcLine] = anchor;
    if (srcIdx !== 0 || srcLine === void 0 || srcLine < 0 || srcLine >= inputDecoded.length) {
      hydratedMappings.push(sparseSegments);
      continue;
    }
    const inputSegments = inputDecoded[srcLine];
    if (!inputSegments || inputSegments.length === 0) {
      hydratedMappings.push(sparseSegments);
      continue;
    }
    const anchorOutCol = anchor[0];
    const anchorSrcCol = anchor.length >= 4 ? anchor[3] : 0;
    const delta = anchorOutCol - (anchorSrcCol ?? 0);
    const outputLine = outputLines[outLine] || "";
    const hydratedSegments = [];
    for (const seg of inputSegments) {
      const adjustedCol = seg[0] + delta;
      if (adjustedCol < 0 || adjustedCol > outputLine.length)
        continue;
      if (seg.length === 5) {
        hydratedSegments.push([adjustedCol, seg[1], seg[2], seg[3], seg[4]]);
      } else if (seg.length === 4) {
        hydratedSegments.push([adjustedCol, seg[1], seg[2], seg[3]]);
      } else {
        hydratedSegments.push([adjustedCol]);
      }
    }
    hydratedSegments.sort((a, b) => a[0] - b[0]);
    hydratedMappings.push(hydratedSegments);
  }
  return encode(hydratedMappings);
}
async function loadInputSourcemap(info) {
  const { fileName, originalCode } = info;
  const inlineConverter = convert$1.fromSource(originalCode);
  if (inlineConverter) {
    return inlineConverter.toObject();
  }
  const readMap = async (mapFile) => {
    const urlWithoutQuery = mapFile.split(/[?#]/)[0];
    const mapFilePath = path.resolve(path.dirname(fileName), urlWithoutQuery);
    return fs.readFile(mapFilePath, "utf8");
  };
  try {
    const fileConverter = await convert$1.fromMapFileSource(originalCode, readMap);
    if (fileConverter) {
      return fileConverter.toObject();
    }
  } catch {
  }
  try {
    const mapContent = await fs.readFile(fileName + ".map", "utf8");
    return JSON.parse(mapContent);
  } catch {
    return null;
  }
}
const transform = () => {
  const allTypeReferences = /* @__PURE__ */ new Map();
  const allFileReferences = /* @__PURE__ */ new Map();
  const pendingSourcemaps = /* @__PURE__ */ new Map();
  return {
    name: "dts-transform",
    buildStart() {
      allTypeReferences.clear();
      allFileReferences.clear();
      pendingSourcemaps.clear();
    },
    options({ onLog, ...options }) {
      return {
        ...options,
        onLog(level, log, defaultHandler) {
          if (level === "warn" && log.code === "CIRCULAR_DEPENDENCY") {
            return;
          }
          if (onLog) {
            onLog(level, log, defaultHandler);
          } else {
            defaultHandler(level, log);
          }
        },
        treeshake: {
          moduleSideEffects: "no-external",
          propertyReadSideEffects: true,
          unknownGlobalSideEffects: false
        }
      };
    },
    outputOptions(options) {
      return {
        ...options,
        chunkFileNames: options.chunkFileNames || "[name]-[hash].d.ts",
        entryFileNames: options.entryFileNames || "[name].d.ts",
        format: "es",
        exports: "named",
        compact: false,
        freeze: true,
        interop: "esModule",
        generatedCode: Object.assign({ symbols: false }, options.generatedCode),
        strict: false
      };
    },
    transform(code, fileName) {
      const name = trimExtension(fileName);
      const moduleIds = this.getModuleIds();
      const moduleId = Array.from(moduleIds).find((id) => trimExtension(id) === name);
      const isEntry = Boolean(moduleId && this.getModuleInfo(moduleId)?.isEntry);
      const isJSON = Boolean(moduleId && JSON_EXTENSIONS.test(moduleId));
      let sourceFile = parse(fileName, code);
      const preprocessed = preProcess({ sourceFile, isEntry, isJSON });
      allTypeReferences.set(sourceFile.fileName, preprocessed.typeReferences);
      allFileReferences.set(sourceFile.fileName, preprocessed.fileReferences);
      code = preprocessed.code.toString();
      sourceFile = parse(fileName, code);
      const converted = convert({ sourceFile });
      if (process.env.DTS_DUMP_AST) {
        console.log(fileName);
        console.log(code);
        console.log(JSON.stringify(converted.ast.body, void 0, 2));
      }
      const map = preprocessed.code.generateMap({ hires: true, source: fileName });
      if (DTS_EXTENSIONS.test(fileName)) {
        pendingSourcemaps.set(fileName, {
          fileName,
          originalCode: code
        });
      }
      return { code, ast: converted.ast, map };
    },
    renderChunk(inputCode, chunk, options) {
      const source = parse(chunk.fileName, inputCode);
      const fixer = new NamespaceFixer(source);
      const typeReferences = /* @__PURE__ */ new Set();
      const fileReferences = /* @__PURE__ */ new Set();
      for (const fileName of Object.keys(chunk.modules)) {
        for (const ref of allTypeReferences.get(fileName.split("\\").join("/")) || []) {
          typeReferences.add(ref);
        }
        for (const ref of allFileReferences.get(fileName.split("\\").join("/")) || []) {
          if (ref.startsWith(".")) {
            const absolutePathToOriginal = path.join(path.dirname(fileName), ref);
            const chunkFolder = options.file && path.dirname(options.file) || chunk.facadeModuleId && path.dirname(chunk.facadeModuleId) || ".";
            let targetRelPath = path.relative(chunkFolder, absolutePathToOriginal).split("\\").join("/");
            if (targetRelPath[0] !== ".") {
              targetRelPath = "./" + targetRelPath;
            }
            fileReferences.add(targetRelPath);
          } else {
            fileReferences.add(ref);
          }
        }
      }
      let code = writeBlock(Array.from(fileReferences, (ref) => `/// <reference path="${ref}" />`));
      code += writeBlock(Array.from(typeReferences, (ref) => `/// <reference types="${ref}" />`));
      code += fixer.fix();
      if (!code) {
        code += "\nexport { };";
      }
      const typeOnlyFixer = new TypeOnlyFixer(chunk.fileName, code);
      const typesFixed = typeOnlyFixer.fix();
      const relativeModuleDeclarationFixed = new RelativeModuleDeclarationFixer(chunk.fileName, "magicCode" in typesFixed && typesFixed.magicCode ? typesFixed.magicCode : new MagicString(code), !!options.sourcemap, "./" + path.basename(chunk.fileName, ".d.ts"));
      return relativeModuleDeclarationFixed.fix();
    },
    async generateBundle(options, bundle) {
      if (!options.sourcemap)
        return;
      const inputSourcemaps = /* @__PURE__ */ new Map();
      const entries = Array.from(pendingSourcemaps.entries());
      const loadedMaps = await Promise.all(entries.map(async ([fileName, info]) => ({
        fileName,
        inputMap: await loadInputSourcemap(info)
      })));
      for (const { fileName, inputMap } of loadedMaps) {
        if (inputMap && inputMap.sources) {
          const inputMapDir = path.dirname(fileName);
          inputSourcemaps.set(fileName, {
            version: inputMap.version ?? 3,
            sources: inputMap.sources.map((source) => path.isAbsolute(source) ? source : path.resolve(inputMapDir, source)),
            sourcesContent: inputMap.sourcesContent,
            mappings: inputMap.mappings,
            names: inputMap.names
          });
        }
      }
      const outputDir = options.dir || (options.file ? path.dirname(options.file) : process.cwd());
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || !chunk.map)
          continue;
        const chunkDir = path.join(outputDir, path.dirname(chunk.fileName));
        const toRelativeSourcePath = (source) => {
          const relative = path.isAbsolute(source) ? path.relative(chunkDir, source) : source;
          return relative.replaceAll("\\", "/");
        };
        const sourcesToRemap = /* @__PURE__ */ new Map();
        for (const source of chunk.map.sources) {
          if (!source)
            continue;
          const absoluteSource = path.resolve(chunkDir, source);
          const inputMap = inputSourcemaps.get(absoluteSource);
          if (inputMap) {
            sourcesToRemap.set(absoluteSource, inputMap);
          }
        }
        if (sourcesToRemap.size === 0) {
          if (chunk.map.sources.length === 0 && chunk.facadeModuleId) {
            const inputMap = inputSourcemaps.get(chunk.facadeModuleId);
            if (inputMap && inputMap.sources.length > 0) {
              const newSources2 = inputMap.sources.map(toRelativeSourcePath);
              const newSourcesContent2 = inputMap.sourcesContent || [];
              chunk.map.sources = newSources2;
              chunk.map.sourcesContent = newSourcesContent2;
              updateSourcemapAsset(bundle, chunk.fileName, {
                sources: newSources2,
                sourcesContent: newSourcesContent2,
                mappings: chunk.map.mappings,
                names: chunk.map.names || []
              });
            }
          }
          continue;
        }
        const isSingleSource = chunk.map.sources.length === 1 && sourcesToRemap.size === 1;
        const singleInputMap = isSingleSource ? Array.from(sourcesToRemap.values())[0] : null;
        const canSimplyReplace = singleInputMap && singleInputMap.sources.length === 1;
        let newSources;
        let newSourcesContent;
        let newMappings;
        let newNames;
        if (canSimplyReplace && singleInputMap) {
          newSources = singleInputMap.sources.map(toRelativeSourcePath);
          newSourcesContent = singleInputMap.sourcesContent || [null];
          newMappings = hydrateSourcemap(chunk.map.mappings, singleInputMap, chunk.code);
          newNames = singleInputMap.names || [];
        } else {
          const remapped = remapping(chunk.map, (file) => {
            const absolutePath = path.resolve(chunkDir, file);
            const inputMap = sourcesToRemap.get(absolutePath);
            if (inputMap) {
              return inputMap;
            }
            return null;
          });
          newSources = remapped.sources.filter((s) => s !== null).map(toRelativeSourcePath);
          newSourcesContent = remapped.sourcesContent || [];
          newMappings = typeof remapped.mappings === "string" ? remapped.mappings : "";
          newNames = remapped.names || [];
        }
        chunk.map.sources = newSources;
        chunk.map.sourcesContent = newSourcesContent;
        chunk.map.mappings = newMappings;
        chunk.map.names = newNames;
        updateSourcemapAsset(bundle, chunk.fileName, {
          sources: newSources,
          sourcesContent: newSourcesContent,
          mappings: newMappings,
          names: newNames
        });
      }
    }
  };
};
function writeBlock(codes) {
  if (codes.length) {
    return codes.join("\n") + "\n";
  }
  return "";
}
function updateSourcemapAsset(bundle, chunkFileName, data) {
  const mapFileName = `${chunkFileName}.map`;
  const mapAsset = bundle[mapFileName];
  if (mapAsset && mapAsset.type === "asset") {
    mapAsset.source = JSON.stringify({
      version: 3,
      // file should be just the basename since the .map is in the same directory
      file: path.basename(chunkFileName),
      ...data
    });
  }
}
const TS_EXTENSIONS = /\.([cm]ts|[tj]sx?)$/;
function getModule({ entries, programs, resolvedOptions }, fileName, code) {
  const { compilerOptions, tsconfig } = resolvedOptions;
  if (!programs.length && DTS_EXTENSIONS.test(fileName)) {
    return { code };
  }
  const isEntry = entries.includes(fileName);
  const existingProgram = programs.find((p) => {
    if (isEntry) {
      return p.getRootFileNames().includes(fileName);
    } else {
      const sourceFile = p.getSourceFile(fileName);
      if (sourceFile && p.isSourceFileFromExternalLibrary(sourceFile)) {
        return false;
      }
      return !!sourceFile;
    }
  });
  if (existingProgram) {
    const source = existingProgram.getSourceFile(fileName);
    return {
      code: source?.getFullText(),
      source,
      program: existingProgram
    };
  } else if (ts.sys.fileExists(fileName)) {
    if (programs.length > 0 && DTS_EXTENSIONS.test(fileName)) {
      const shouldBundleExternal = resolvedOptions.includeExternal.length > 0 || resolvedOptions.respectExternal;
      if (shouldBundleExternal) {
        return { code };
      }
    }
    const newProgram = createProgram$1(fileName, compilerOptions, tsconfig);
    programs.push(newProgram);
    const source = newProgram.getSourceFile(fileName);
    return {
      code: source?.getFullText(),
      source,
      program: newProgram
    };
  } else {
    return null;
  }
}
const plugin = (options = {}) => {
  const transformPlugin = transform();
  const ctx = { entries: [], programs: [], resolvedOptions: resolveDefaultOptions(options) };
  return {
    name: "dts",
    // pass outputOptions, renderChunk, and generateBundle hooks to the inner transform plugin
    outputOptions: transformPlugin.outputOptions,
    renderChunk: transformPlugin.renderChunk,
    generateBundle: transformPlugin.generateBundle,
    options(options2) {
      let { input = [] } = options2;
      if (!Array.isArray(input)) {
        input = typeof input === "string" ? [input] : Object.values(input);
      } else if (input.length > 1) {
        options2.input = {};
        for (const filename of input) {
          let name = trimExtension(filename);
          if (path.isAbsolute(filename)) {
            name = path.basename(name);
          } else {
            name = path.normalize(name);
          }
          options2.input[name] = filename;
        }
      }
      ctx.programs = createPrograms(Object.values(input), ctx.resolvedOptions.compilerOptions, ctx.resolvedOptions.tsconfig);
      return transformPlugin.options.call(this, options2);
    },
    transform(code, id) {
      if (!TS_EXTENSIONS.test(id) && !JSON_EXTENSIONS.test(id)) {
        return null;
      }
      const watchFiles = (module) => {
        if (module.program) {
          const sourceDirectory = path.dirname(id);
          const sourceFilesInProgram = module.program.getSourceFiles().map((sourceFile) => sourceFile.fileName).filter((fileName) => fileName.startsWith(sourceDirectory));
          sourceFilesInProgram.forEach(this.addWatchFile);
        }
      };
      const handleDtsFile = () => {
        const module = getModule(ctx, id, code);
        if (module) {
          watchFiles(module);
          return transformPlugin.transform.call(this, module.code, id);
        }
        return null;
      };
      const treatTsAsDts = () => {
        const declarationId = getDeclarationId(id);
        const module = getModule(ctx, declarationId, code);
        if (module) {
          watchFiles(module);
          return transformPlugin.transform.call(this, module.code, declarationId);
        }
        return null;
      };
      const generateDts = () => {
        const module = getModule(ctx, id, code);
        if (!module || !module.source || !module.program)
          return null;
        watchFiles(module);
        const declarationId = getDeclarationId(id);
        let generated;
        const { emitSkipped, diagnostics } = module.program.emit(
          module.source,
          (_, declarationText) => {
            generated = transformPlugin.transform.call(this, declarationText, declarationId);
          },
          void 0,
          // cancellationToken
          true,
          // emitOnlyDtsFiles
          void 0,
          // customTransformers
          // @ts-ignore This is a private API for workers, should be safe to use as TypeScript Playground has used it for a long time.
          true
        );
        if (emitSkipped) {
          const errors = diagnostics.filter((diag) => diag.category === ts.DiagnosticCategory.Error);
          if (errors.length) {
            console.error(ts.formatDiagnostics(errors, formatHost));
            this.error("Failed to compile. Check the logs above.");
          }
        }
        return generated;
      };
      if (DTS_EXTENSIONS.test(id))
        return handleDtsFile();
      if (JSON_EXTENSIONS.test(id))
        return generateDts();
      return treatTsAsDts() ?? generateDts();
    },
    resolveId(source, importer) {
      if (!importer) {
        ctx.entries.push(path.resolve(source));
        return;
      }
      importer = importer.split("\\").join("/");
      let resolvedCompilerOptions = ctx.resolvedOptions.compilerOptions;
      if (ctx.resolvedOptions.tsconfig) {
        const resolvedSource = source.startsWith(".") ? path.resolve(path.dirname(importer), source) : source;
        resolvedCompilerOptions = getCompilerOptions(resolvedSource, ctx.resolvedOptions.compilerOptions, ctx.resolvedOptions.tsconfig).compilerOptions;
      }
      const { resolvedModule } = ts.resolveModuleName(source, importer, resolvedCompilerOptions, ts.sys);
      if (!resolvedModule) {
        return;
      }
      if (resolvedModule.isExternalLibraryImport && resolvedModule.packageId && ctx.resolvedOptions.includeExternal.includes(resolvedModule.packageId.name)) {
        return { id: path.resolve(resolvedModule.resolvedFileName) };
      } else if (!ctx.resolvedOptions.respectExternal && resolvedModule.isExternalLibraryImport) {
        return { id: source, external: true };
      } else {
        return { id: path.resolve(resolvedModule.resolvedFileName) };
      }
    }
  };
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

const createImportChainPlugin = () => {
  const importerMap = /* @__PURE__ */ new Map();
  const plugin = {
    name: "import-chain-tracker",
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
    }
  };
  const getImportChain = (errorFileId) => {
    const chain = [];
    let current = errorFileId;
    while (current) {
      chain.unshift(current);
      current = importerMap.get(current);
    }
    return chain;
  };
  return {
    plugin,
    getImportChain
  };
};

const nodeModules = `${path__default.sep}node_modules${path__default.sep}`;
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
      let totalSize = 0;
      for (const moduleId of bundledFiles) {
        const moduleInfo = this.getModuleInfo(moduleId);
        const size = moduleInfo?.meta?.size;
        if (typeof size === "number") {
          totalSize += size;
        }
      }
      sizeRef.value = totalSize;
      const outputFiles = new Set(modules.map(({ fileName }) => path__default.join(options.dir, fileName)));
      deleteFiles = bundledFiles.filter((moduleId) => moduleId && moduleId.startsWith(outputDirectory) && !moduleId.includes(nodeModules) && !outputFiles.has(moduleId));
    },
    writeBundle: async () => {
      await Promise.all(
        deleteFiles.flatMap((moduleId) => [
          fs.rm(moduleId),
          // Also delete orphaned sourcemap files
          fs.rm(`${moduleId}.map`, { force: true })
        ])
      );
    }
  };
};

const packageJsonCache = /* @__PURE__ */ new Map();
const findPackageJsonUp = async (cwd) => {
  const packageJsonPath = up("package.json", { cwd });
  if (!packageJsonPath) {
    return void 0;
  }
  const packageRoot = path__default.dirname(packageJsonPath);
  let packageJson = packageJsonCache.get(packageRoot);
  if (!packageJson) {
    try {
      const content = await fs.readFile(packageJsonPath, "utf8");
      packageJson = JSON.parse(content);
      packageJsonCache.set(packageRoot, packageJson);
    } catch {
      return void 0;
    }
  }
  if (packageJson.imports) {
    return {
      imports: packageJson.imports,
      packageRoot
    };
  }
};
const resolveSubpathImportsPlugin = () => ({
  name: "resolve-subpath-imports",
  async resolveId(id, importer) {
    if (id[0] !== "#" || !importer) {
      return null;
    }
    const result = await findPackageJsonUp(path__default.dirname(importer));
    if (!result) {
      return null;
    }
    const { imports, packageRoot } = result;
    let resolvedPaths;
    try {
      resolvedPaths = resolveImports(imports, id, ["types", "import"]);
    } catch {
      return null;
    }
    if (resolvedPaths.length === 0) {
      return null;
    }
    return this.resolve(
      path__default.join(packageRoot, resolvedPaths[0]),
      importer,
      { skipSelf: true }
    );
  }
});

const createInputMap = (input, outputDirectory) => Object.fromEntries(
  input.map((inputFile) => [
    inputFile.slice(outputDirectory.length + 1),
    inputFile
  ])
);
const build = async (input, outputDirectory, externals, mode, conditions, sourcemap) => {
  const {
    externalizePlugin,
    externalized,
    getPackageEntryPoint
  } = createExternalizePlugin(externals);
  const { plugin: importChainPlugin, getImportChain } = createImportChainPlugin();
  const sizeRef = {};
  const rollupConfig = {
    input: createInputMap(input, outputDirectory),
    output: {
      sourcemap,
      dir: outputDirectory,
      entryFileNames: "[name]",
      chunkFileNames: "_dtsroll-chunks/[hash]-[name].ts"
    },
    plugins: [
      importChainPlugin,
      externalizePlugin,
      removeBundledModulesPlugin(outputDirectory, sizeRef),
      resolveSubpathImportsPlugin(),
      nodeResolve({
        extensions: [".ts", ...dtsExtensions],
        exportConditions: conditions
      }),
      plugin({
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
  try {
    const rollupBuild = await rollup(rollupConfig);
    const built = await rollupBuild[mode](rollupConfig.output);
    await rollupBuild.close();
    return {
      built,
      externalized,
      getPackageEntryPoint,
      sourceSize: sizeRef.value ?? 0
    };
  } catch (error) {
    if (error instanceof Error && "id" in error && typeof error.id === "string") {
      throw new DtsrollBuildError(
        error.message,
        error.id,
        getImportChain(error.id)
      );
    }
    throw error;
  }
};

const dtsroll = async ({
  cwd = process.cwd(),
  inputs,
  external,
  conditions,
  dryRun,
  sourcemap
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
    manualInput ? inputs.map((file) => path__default.resolve(file)) : await pkgJson?.getDtsEntryPoints()
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
    conditions,
    sourcemap
  );
  let outputSize = 0;
  const outputEntries = [];
  const outputChunks = [];
  const moduleImports = /* @__PURE__ */ new Set();
  const chunks = built.output.filter((file) => file.type === "chunk");
  for (const file of chunks) {
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

export { DtsrollBuildError as D, black as a, bgYellow as b, dtsroll as d, logOutput as l };
