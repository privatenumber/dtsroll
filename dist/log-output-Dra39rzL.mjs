import path from 'node:path';
import byteSize from 'byte-size';
import { c as bold, l as lightYellow, w as warningSignUnicode, e as dim, g as green, r as red, m as magenta, y as yellow } from './index-Br9CBpfq.mjs';

const cwd = process.cwd();

const logOutput = (dtsOutput) => {
  const { inputs } = dtsOutput;
  const isCliInput = inputs[0][1] === void 0;
  console.log(bold(`
\u{1F4E5} Entry points${isCliInput ? "" : " in package.json"}`));
  console.log(
    inputs.map(([inputFile, inputSource, error]) => {
      const relativeInputFile = path.relative(cwd, inputFile);
      const logPath2 = relativeInputFile.length < inputFile.length ? relativeInputFile : inputFile;
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
  const logPath = (outputDirectoryRelative.length < outputDirectory.length ? outputDirectoryRelative : outputDirectory) + path.sep;
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
      const logModuleId = relativeModuleId.length < moduleId.length ? relativeModuleId : moduleId;
      const bareSpecifier = moduleToPackage[moduleId];
      if (bareSpecifier) {
        return `${prefix}${dim(magenta(bareSpecifier))} ${dim(`(${logModuleId})`)}`;
      }
      const fileName = path.basename(logModuleId);
      const directoryPath = path.dirname(logModuleId) + path.sep;
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
