import { l as logOutput } from './log-output-ViIhTCJZ.mjs';
import { d as dtsroll } from './index-BW82IRdk.mjs';
import 'node:path';
import 'byte-size';
import 'node:fs/promises';
import 'rollup';
import 'rollup-plugin-dts';
import '@rollup/plugin-node-resolve';

const dtsrollPlugin = (options) => {
  let built = false;
  return {
    name: "dtsroll",
    apply: "build",
    enforce: "post",
    writeBundle: {
      sequential: true,
      order: "post",
      handler: async () => {
        if (built) {
          return;
        }
        logOutput(await dtsroll(options));
        console.log();
        built = true;
      }
    }
  };
};

export { dtsrollPlugin as dtsroll };
