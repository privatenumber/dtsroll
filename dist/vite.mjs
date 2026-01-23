#!/usr/bin/env node
import { d as dtsroll, l as logOutput } from './index-DaiC_aHH.mjs';
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

const dtsrollPlugin = (options) => {
  let built = false;
  let cwd;
  let noLog = false;
  return {
    name: "dtsroll",
    apply: "build",
    enforce: "post",
    config: ({ root, logLevel }) => {
      cwd = root;
      noLog = logLevel === "silent";
    },
    writeBundle: {
      sequential: true,
      order: "post",
      handler: async () => {
        if (built) {
          return;
        }
        try {
          const output = await dtsroll({
            cwd,
            ...options
          });
          built = true;
          if (!noLog) {
            logOutput(output);
            console.log();
          }
        } catch (error) {
          built = true;
          throw new Error(
            `dtsroll failed: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
          );
        }
      }
    }
  };
};

export { dtsrollPlugin as dtsroll };
