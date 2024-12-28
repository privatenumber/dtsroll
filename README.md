# dtsroll

_dtsroll_ is a CLI tool for bundling `.d.ts` files into a flattened and optimized output.

### Why?
- **Tree-shaking**

    Bundles only the used exports, removing unused ones for a smaller output.

- **Bundle in private dependencies**

    Inline types from private dependencies (e.g., monorepo packages) that aren't accessible to consumers.

- **Improve TS performance**

    Flattens multiple files into one, reducing TypeScript's file resolution for type checking.

## Install
```
npm install --save-dev dtsroll
```

## Quick usage

1. Compile your TypeScript code and generate `.d.ts` files
    - If using the TypeScript compiler (`tsc`), enable [`declaration`](https://www.typescriptlang.org/tsconfig/#declaration)
    - If using Vite, use a plugin like [vite-plugin-dts](https://www.npmjs.com/package/vite-plugin-dts)

2. Pass in the entry declaration file to _dtsroll_

    ```sh
    npx dtsroll dist/index.d.ts
    ```

    > [!IMPORTANT]
    > This will modify your file directly. Make sure you only pass in files that are generated and you have a backup.

### Recommended Setup

Update your `package.json` to reference `.d.ts` files and include `dtsroll` in the build step:  
```diff
 {
     "name": "my-package",
     "exports": {
+        "types": "./dist/index.d.ts",
         "default": "./dist/index.js"
     },
     "scripts": {
+        "build": "tsc && dtsroll --remove-bundled"
     }
 }
```

Running `dtsroll` without passing in input file will auto-detect entry `.d.ts` files from `package.json`.

The `--remove-bundled` flag deletes `.d.ts` files bundled in, keeping your package lean.

### Externalization

By default, _dtsroll_ decides which dependencies to bundle or keep external by analyzing your `package.json`. All packages listed under `devDependencies` are bundled, and other dependency types are externalized.

When there is no `package.json` file, you can pass in packages to externalize with the `--external` flag.

#### Handling `@types` packages

Some packages need separate `@types/*` packages for type definitions. In this setup, typically:

- The main package is in `dependencies`.
- The corresponding `@types/*` package is in `devDependencies`.

Because the main package is in `dependencies`,  _dtsroll_ externalizes it. However, consumers of your package won’t get the type definitions for it because the `@types/*` package is only in `devDependencies`.

To fix this, _dtsroll_ will display a warning suggesting you move the `@types/*` package out of `devDependencies`.

## CLI Options

### --help
Display usage instructions.

### --dry
Simulate the bundling process without modifying the disk and logs what would happen.

### --remove-bundled
Deletes `.d.ts` files that were bundled, reducing the package size. Recommended for minimizing publish artifacts.

### --external
If there is no `package.json` file, you can specify package names to exclude from the bundle.

> [!WARNING]
> This flag can only be used when there is no `package.json`. It's better to define dependencies appropriately in `package.json` instead of using this flag.

### --conditions
Provide resolution conditions to target specific entry points in dependencies, similar to Node’s [`--conditions`](https://nodejs.org/api/cli.html#-c-condition---conditionscondition).

## Related

### pkgroll
For package bundling (along with dts bundling), check out [pkgroll](https://github.com/privatenumber/pkgroll).
