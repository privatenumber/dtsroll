import { l as logOutput } from './log-output-DpKg8mKh.mjs';
import { d as dtsroll } from './index-DWWhBXa5.mjs';
import 'node:path';
import 'byte-size';
import 'node:fs/promises';
import 'rollup';
import 'rollup-plugin-dts';
import '@rollup/plugin-node-resolve';

const dtsrollPlugin = (options) => ({
  name: "dtsroll",
  writeBundle: async () => {
    logOutput(await dtsroll(options));
  }
});

export { dtsrollPlugin as dtsroll };
