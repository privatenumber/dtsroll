import { d as dtsroll } from './index-mLO1ZfBH.mjs';
import { l as logOutput } from './log-output-BYYnIl2_.mjs';
import 'node:path';
import 'node:fs/promises';
import 'rollup';
import 'rollup-plugin-dts';
import '@rollup/plugin-node-resolve';
import 'byte-size';

const dtsrollPlugin = (options) => ({
  name: "dtsroll",
  writeBundle: async () => {
    logOutput(await dtsroll(options));
  }
});

export { dtsrollPlugin as dtsroll };
