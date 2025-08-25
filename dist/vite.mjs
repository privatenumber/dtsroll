#!/usr/bin/env node
import { d as dtsroll, l as logOutput } from './index-BpqnsX4d.mjs';
import 'node:path';
import 'node:fs/promises';
import 'rolldown';
import 'rolldown-plugin-dts';
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
        const output = await dtsroll({
          cwd,
          ...options
        });
        built = true;
        if (!noLog) {
          logOutput(output);
          console.log();
        }
      }
    }
  };
};

export { dtsrollPlugin as dtsroll };
