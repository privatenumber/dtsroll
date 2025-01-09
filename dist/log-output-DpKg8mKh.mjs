import path from 'node:path';
import byteSize from 'byte-size';
import { c as cwd, e as bold, m as magenta, f as dim, y as yellow, g as green } from './index-DWWhBXa5.mjs';

const logOutput = ({
  outputDirectory,
  output: {
    entries: outputEntries,
    chunks: outputChunks
  },
  size,
  externals
}) => {
  const outputDirectoryRelative = path.relative(cwd, outputDirectory) + path.sep;
  const logChunk = ({
    file,
    indent,
    bullet,
    color
  }) => {
    const sizeFormatted = byteSize(file.size).toString();
    let log = `${indent}${bullet} ${dim(color(outputDirectoryRelative))}${color(file.fileName)} ${sizeFormatted}`;
    const { moduleIds, moduleToPackage } = file;
    log += `
${moduleIds.sort().map((moduleId, index) => {
      const isLast = index === moduleIds.length - 1;
      const prefix = `${indent}   ${isLast ? "\u2514\u2500 " : "\u251C\u2500 "}`;
      const relativeModuleId = path.relative(cwd, moduleId);
      const bareSpecifier = moduleToPackage[moduleId];
      if (bareSpecifier) {
        return `${prefix}${dim(magenta(bareSpecifier))} ${dim(`(${relativeModuleId})`)}`;
      }
      const fileName = path.basename(relativeModuleId);
      const directoryPath = path.dirname(relativeModuleId) + path.sep;
      return `${prefix}${dim(directoryPath)}${dim(fileName)}`;
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
  const percentage = ((size.input - size.output) / size.input * 100).toFixed(0);
  console.log(`   Input source size:   ${byteSize(size.input).toString()}`);
  console.log(`   Bundled output size: ${byteSize(size.output).toString()} (${percentage}% decrease)`);
  if (externals.length > 0) {
    console.log(bold("\n\u{1F4E6} External packages"));
    console.log(
      externals.map(([packageName, reason, devTypePackage]) => {
        let stdout = ` \u2500 ${magenta(packageName)} ${dim(`externalized ${reason}`)}`;
        if (devTypePackage) {
          stdout += `
   ${yellow("Warning:")} ${magenta(devTypePackage)} should not be in devDependencies if ${magenta(packageName)} is externalized`;
        }
        return stdout;
      }).sort().join("\n")
    );
  }
};

export { logOutput as l };
