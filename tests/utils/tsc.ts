import path from 'node:path';
import nanoSpawn from 'nano-spawn';

const tscPath = path.resolve('node_modules/.bin/tsc');
export const tsc = (cwd: string) => nanoSpawn(tscPath, [], { cwd });
