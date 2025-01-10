# dtsroll

_dtsroll_ is a CLI tool for bundling TypeScript declaration (`.d.ts`) files.

### Why bundle `.d.ts` files?

- **Smaller distribution**

	Tree-shaking removes unused code, keeping only what's needed and reducing the output size.

- **Bundle in private dependencies**

	Inline types from private dependencies (e.g., monorepo packages) that aren't accessible to consumers.

- **Improve TS performance**

	Flattens multiple files into one, reducing TypeScript's file resolution for type checking.

## Install
```
npm install --save-dev dtsroll
```

## Quick start

1. Compile your TypeScript code with declaration (`.d.ts`) files
	- If using the TypeScript compiler (`tsc`), enable [`declaration`](https://www.typescriptlang.org/tsconfig/#declaration)
	- If using Vite, use a plugin like [vite-plugin-dts](https://www.npmjs.com/package/vite-plugin-dts)

2. Pass in the entry declaration file to _dtsroll_

	```sh
	dtsroll --dry-run dist/index.d.ts
	```

> [!CAUTION]
> _dtsroll_ is designed to run on compiled output so it modifies files in-place.
> - It will modify files you pass in, and files they import.
> - Only pass in backed up or generated files
> - Start with `--dry-run`

3. If the changes look good, remove the `--dry-run` flag:

	```sh
	dtsroll dist/index.d.ts
	```

### Recommended setup

Running `dtsroll` without specifying input files will auto-detect them from `package.json`.

Update your `package.json` to reference `.d.ts` files and include `dtsroll` in the build step:  
```diff
 {
     "name": "my-package",
     "exports": {
+        "types": "./dist/index.d.ts",
         "default": "./dist/index.js"
     },
     "scripts": {
+        "build": "tsc && dtsroll"
     }
 }
```

### Externalization

By default, _dtsroll_ decides which dependencies to bundle or keep external by analyzing the `package.json` file. Packages in `devDependencies` are bundled, and packages in other dependency types are externalized.

When there is no `package.json` file, you can specify packages to externalize with the `--external` flag.

#### Handling `@types` packages

Some packages need separate `@types/*` packages for type definitions. In this setup, typically:

- The main package is in `dependencies`.
- The corresponding `@types/*` package is in `devDependencies`.

Because the main package is in `dependencies`,  _dtsroll_ externalizes it. However, consumers of your package won’t get the type definitions for it because the `@types/*` package is only in `devDependencies`.

To fix this, _dtsroll_ will display a warning suggesting you move the `@types/*` package out of `devDependencies`.

## CLI

### --help, -h
Display usage instructions.

### --dry-run, -d
Simulate the bundling process without modifying the disk and logs what would happen.

### --external, -e
If there is no `package.json` file, you can specify package names to exclude from the bundle.

> [!NOTE]
> This flag can only be used when there is no `package.json`. It's better to define dependencies appropriately in `package.json` instead of using this flag.

### --conditions, -C
Provide resolution conditions to target specific entry points in dependencies, similar to Node’s [`--conditions`](https://nodejs.org/api/cli.html#-c-condition---conditionscondition).

## Node.js API
```ts
import { dtsroll } from 'dtsroll'

await dtsroll({
    /**
     * CWD to find the package.json in
     * @default process.cwd()
     */
    cwd?: string;

    /**
     * Defaults to auto-detecting d.ts files from package.json
     */
    inputs?: string[];

    /**
     * Only used if there's no package.json
     * Defaults to auto-detecting dependencies from package.json
     */
    external?: string[];

    conditions?: string[];

    dryRun?: boolean;
})
```

## Vite plugin

Use it in conjunction with a plugin that generates the initial declaration files like `vite-plugin-dts`.

```ts
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'
import { dtsroll } from 'dtsroll/vite'

export default defineConfig({
    // ...
    plugins: [
        // ...
        dts(),
        dtsroll()
    ]
})
```

## Related

### pkgroll
For package bundling (along with dts bundling), check out [pkgroll](https://github.com/privatenumber/pkgroll).
