import path from 'node:path';
import { c as cwd, e as bold, m as magenta, f as dim, y as yellow, g as green } from './index-mLO1ZfBH.mjs';

/**
 * @module byte-size
 */

let defaultOptions = {};
const _options = new WeakMap();

const referenceTables = {
  metric: [
    { from: 0, to: 1e3, unit: 'B', long: 'bytes' },
    { from: 1e3, to: 1e6, unit: 'kB', long: 'kilobytes' },
    { from: 1e6, to: 1e9, unit: 'MB', long: 'megabytes' },
    { from: 1e9, to: 1e12, unit: 'GB', long: 'gigabytes' },
    { from: 1e12, to: 1e15, unit: 'TB', long: 'terabytes' },
    { from: 1e15, to: 1e18, unit: 'PB', long: 'petabytes' },
    { from: 1e18, to: 1e21, unit: 'EB', long: 'exabytes' },
    { from: 1e21, to: 1e24, unit: 'ZB', long: 'zettabytes' },
    { from: 1e24, to: 1e27, unit: 'YB', long: 'yottabytes' }
  ],
  metric_octet: [
    { from: 0, to: 1e3, unit: 'o', long: 'octets' },
    { from: 1e3, to: 1e6, unit: 'ko', long: 'kilooctets' },
    { from: 1e6, to: 1e9, unit: 'Mo', long: 'megaoctets' },
    { from: 1e9, to: 1e12, unit: 'Go', long: 'gigaoctets' },
    { from: 1e12, to: 1e15, unit: 'To', long: 'teraoctets' },
    { from: 1e15, to: 1e18, unit: 'Po', long: 'petaoctets' },
    { from: 1e18, to: 1e21, unit: 'Eo', long: 'exaoctets' },
    { from: 1e21, to: 1e24, unit: 'Zo', long: 'zettaoctets' },
    { from: 1e24, to: 1e27, unit: 'Yo', long: 'yottaoctets' }
  ],
  iec: [
    { from: 0, to: Math.pow(1024, 1), unit: 'B', long: 'bytes' },
    { from: Math.pow(1024, 1), to: Math.pow(1024, 2), unit: 'KiB', long: 'kibibytes' },
    { from: Math.pow(1024, 2), to: Math.pow(1024, 3), unit: 'MiB', long: 'mebibytes' },
    { from: Math.pow(1024, 3), to: Math.pow(1024, 4), unit: 'GiB', long: 'gibibytes' },
    { from: Math.pow(1024, 4), to: Math.pow(1024, 5), unit: 'TiB', long: 'tebibytes' },
    { from: Math.pow(1024, 5), to: Math.pow(1024, 6), unit: 'PiB', long: 'pebibytes' },
    { from: Math.pow(1024, 6), to: Math.pow(1024, 7), unit: 'EiB', long: 'exbibytes' },
    { from: Math.pow(1024, 7), to: Math.pow(1024, 8), unit: 'ZiB', long: 'zebibytes' },
    { from: Math.pow(1024, 8), to: Math.pow(1024, 9), unit: 'YiB', long: 'yobibytes' }
  ],
  iec_octet: [
    { from: 0, to: Math.pow(1024, 1), unit: 'o', long: 'octets' },
    { from: Math.pow(1024, 1), to: Math.pow(1024, 2), unit: 'Kio', long: 'kibioctets' },
    { from: Math.pow(1024, 2), to: Math.pow(1024, 3), unit: 'Mio', long: 'mebioctets' },
    { from: Math.pow(1024, 3), to: Math.pow(1024, 4), unit: 'Gio', long: 'gibioctets' },
    { from: Math.pow(1024, 4), to: Math.pow(1024, 5), unit: 'Tio', long: 'tebioctets' },
    { from: Math.pow(1024, 5), to: Math.pow(1024, 6), unit: 'Pio', long: 'pebioctets' },
    { from: Math.pow(1024, 6), to: Math.pow(1024, 7), unit: 'Eio', long: 'exbioctets' },
    { from: Math.pow(1024, 7), to: Math.pow(1024, 8), unit: 'Zio', long: 'zebioctets' },
    { from: Math.pow(1024, 8), to: Math.pow(1024, 9), unit: 'Yio', long: 'yobioctets' }
  ]
};

class ByteSize {
  constructor (bytes, options) {
    options = Object.assign({
      units: 'metric',
      precision: 1,
      locale: undefined // Default to the user's system locale
    }, defaultOptions, options);
    _options.set(this, options);

    Object.assign(referenceTables, options.customUnits);

    const prefix = bytes < 0 ? '-' : '';
    bytes = Math.abs(bytes);
    const table = referenceTables[options.units];
    if (table) {
      const units = table.find(u => bytes >= u.from && bytes < u.to);
      if (units) {
        const defaultFormat = new Intl.NumberFormat(options.locale, {
          style: 'decimal',
          maximumFractionDigits: options.precision
        });
        const value = units.from === 0
          ? prefix + defaultFormat.format(bytes)
          : prefix + defaultFormat.format(bytes / units.from);
        this.value = value;
        this.unit = units.unit;
        this.long = units.long;
      } else {
        this.value = prefix + bytes;
        this.unit = '';
        this.long = '';
      }
    } else {
      throw new Error(`Invalid units specified: ${options.units}`)
    }
  }

  toString () {
    const options = _options.get(this);
    return options.toStringFn ? options.toStringFn.bind(this)() : `${this.value} ${this.unit}`
  }
}

/**
 * Returns an object with the spec `{ value: string, unit: string, long: string }`. The returned object defines a `toString` method meaning it can be used in any string context.
 * @param {number} - The bytes value to convert.
 * @param [options] {object} - Optional config.
 * @param [options.precision] {number} - Number of decimal places. Defaults to `1`.
 * @param [options.units] {string} - Specify `'metric'`, `'iec'`, `'metric_octet'`, `'iec_octet'` or the name of a property from the custom units table in `options.customUnits`. Defaults to `metric`.
 * @param [options.customUnits] {object} - An object containing one or more custom unit lookup tables.
 * @param [options.toStringFn] {function} - A `toString` function to override the default.
 * @param [options.locale] {string|string[]} - *Node >=13 or modern browser only - on earlier platforms this option is ignored*. The locale to use for number formatting (e.g. `'de-DE'`). Defaults to your system locale. Passed directed into [Intl.NumberFormat()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat).
 * @returns {object}
 * @alias module:byte-size
 */
function byteSize (bytes, options) {
  return new ByteSize(bytes, options)
}

/**
 * Set the default `byteSize` options for the duration of the process.
 * @param options {object} - A `byteSize` options object.
 */
byteSize.defaultOptions = function (options) {
  defaultOptions = options;
};

const logOutput = ({
  outputDirectory,
  output: {
    entries: outputEntries,
    chunks: outputChunks
  },
  size,
  externals
}) => {
  const outputDirectoryRelative = path.relative(cwd, outputDirectory) + path.sep;
  const logChunk = ({
    file,
    indent,
    bullet,
    color
  }) => {
    const sizeFormatted = byteSize(file.size).toString();
    let log = `${indent}${bullet} ${dim(color(outputDirectoryRelative))}${color(file.fileName)} ${sizeFormatted}`;
    const { moduleIds, moduleToPackage } = file;
    log += `
${moduleIds.sort().map((moduleId, index) => {
      const isLast = index === moduleIds.length - 1;
      const prefix = `${indent}   ${isLast ? "\u2514\u2500 " : "\u251C\u2500 "}`;
      const relativeModuleId = path.relative(cwd, moduleId);
      const bareSpecifier = moduleToPackage[moduleId];
      if (bareSpecifier) {
        return `${prefix}${dim(magenta(bareSpecifier))} ${dim(`(${relativeModuleId})`)}`;
      }
      const fileName = path.basename(relativeModuleId);
      const directoryPath = path.dirname(relativeModuleId) + path.sep;
      return `${prefix}${dim(directoryPath)}${dim(fileName)}`;
    }).join("\n")}`;
    return log;
  };
  console.log(bold("\n\u{1F4A0} Bundled output"));
  console.log(
    outputEntries.map((file) => logChunk({
      file,
      indent: " ",
      bullet: "\u25CF",
      color: green
    })).join("\n\n")
  );
  if (outputChunks.length > 0) {
    console.log(bold("\n Chunks"));
    console.log(
      outputChunks.map((file) => logChunk({
        file,
        indent: "   ",
        bullet: "\u25A0",
        color: yellow
      })).join("\n\n")
    );
  }
  console.log(bold("\n\u2696\uFE0F Size savings"));
  const percentage = ((size.input - size.output) / size.input * 100).toFixed(0);
  console.log(`   Input source size:   ${byteSize(size.input).toString()}`);
  console.log(`   Bundled output size: ${byteSize(size.output).toString()} (${percentage}% decrease)`);
  if (externals.length > 0) {
    console.log(bold("\n\u{1F4E6} External packages"));
    console.log(
      externals.map(([packageName, reason, devTypePackage]) => {
        let stdout = ` \u2500 ${magenta(packageName)} ${dim(`externalized ${reason}`)}`;
        if (devTypePackage) {
          stdout += `
   ${yellow("Warning:")} ${magenta(devTypePackage)} should not be in devDependencies if ${magenta(packageName)} is externalized`;
        }
        return stdout;
      }).sort().join("\n")
    );
  }
};

export { logOutput as l };
