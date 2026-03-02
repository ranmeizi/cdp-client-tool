const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const path = require('path');

const pkg = require('./package.json');
const deps = Object.keys(pkg.dependencies || {});
const external = (id) => {
  if (deps.includes(id)) return true;
  if (id.startsWith('node:')) return true;
  return false;
};

module.exports = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  external,
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({
      tsconfig: path.resolve(__dirname, 'tsconfig.json'),
      compilerOptions: { module: 'ESNext' },
    }),
  ],
};
