#!/usr/bin/env node
import { cli } from 'cleye';
import { b as bgYellow, a as black, d as dtsroll, l as logOutput, D as DtsrollBuildError } from './index-DaiC_aHH.mjs';
import 'node:path';
import 'node:fs/promises';
import 'rollup';
import 'typescript';
import 'node:module';
import 'convert-source-map';
import '@rollup/plugin-node-resolve';
import 'empathic/find';
import 'resolve-pkg-maps';
import 'byte-size';

var name = "dtsroll";
var version = "0.0.0-semantic-release";
var description = "Bundle dts files";

const argv = cli({
  name,
  version,
  help: {
    description
  },
  strictFlags: true,
  parameters: ["[input files...]"],
  flags: {
    conditions: {
      type: [String],
      alias: "C",
      description: "Export conditions"
    },
    dryRun: {
      type: Boolean,
      alias: "d",
      description: "Dry run; no files will be written"
    },
    external: {
      type: [String],
      alias: "e",
      description: "Dependency to externalize"
    },
    sourcemap: {
      type: Boolean,
      alias: "s",
      description: "Generate sourcemaps"
    }
  }
});
const { flags } = argv;
if (flags.dryRun) {
  console.log(bgYellow(black(" Dry run - No files will be written ")));
}
dtsroll({
  inputs: argv._.inputFiles,
  external: flags.external,
  conditions: flags.conditions,
  dryRun: flags.dryRun,
  sourcemap: flags.sourcemap
}).then(
  (output) => {
    if ("error" in output) {
      process.exitCode = 1;
    }
    logOutput(output);
  }
).catch(
  (error) => {
    let errorMessage = "\nFailed to build";
    if (error instanceof DtsrollBuildError) {
      errorMessage += `
  File: ${error.id}`;
      if (error.importChain.length > 1) {
        errorMessage += "\n\n  Import chain:\n    ";
        errorMessage += error.importChain.join("\n    \u2192 ");
      }
    }
    errorMessage += `

${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    process.exitCode = 1;
  }
);
