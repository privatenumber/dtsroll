import { l as logOutput } from './log-output-CwMUFOmQ.mjs';
import { d as dtsroll } from './index--BBQtOEp.mjs';
import 'node:path';
import 'byte-size';
import 'node:fs/promises';
import 'rollup';
import 'rollup-plugin-dts';
import '@rollup/plugin-node-resolve';

const dtsrollPlugin = (options) => {
  let built = false;
  let cwd;
  return {
    name: "dtsroll",
    apply: "build",
    enforce: "post",
    config({ root }) {
      cwd = root;
    },
    writeBundle: {
      sequential: true,
      order: "post",
      handler: async () => {
        if (built) {
          return;
        }
        logOutput(await dtsroll({
          cwd,
          ...options
        }));
        console.log();
        built = true;
      }
    }
  };
};

export { dtsrollPlugin as dtsroll };
