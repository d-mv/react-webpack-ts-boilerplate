'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const { log, error, warn, info } = require('../config/logger');

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', (err) => {
  error('Unhandled rejection', err);
  throw err;
});

// Ensure environment variables are read.
require('../config/env');

const chalk = require('react-dev-utils/chalk');
const fs = require('fs-extra');
const bfj = require('bfj');
const webpack = require('webpack');
const config = require('../config/webpack.prod.config');
const paths = require('../config/paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');
const { checkBrowsers } = require('react-dev-utils/browsersHelper');

const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  error('Either fields are missing:', {
    'paths.appHtml': paths.appHtml,
    'paths.appIndexJs': paths.appIndexJs,
  });
  process.exit(1);
}

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

const isInteractive = process.stdout.isTTY;

const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;

info('Build server settings:', { argv, isInteractive });

let oldSize = 0;

// We require that you explicitly set browsers and do not fall back to
// browserslist defaults.
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    return measureFileSizesBeforeBuild(paths.appBuild);
  })
  .then((previousFileSizes) => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    fs.emptyDirSync(paths.appBuild);
    // Merge with the public folder
    copyPublicFolder();
    // Start the webpack build
    return build(previousFileSizes);
  })
  .then(
    async ({ stats, previousFileSizes, warnings }) => {
      if (warnings.length) {
        warn('Compiled with warnings.\n', warnings.join('\n\n'));
        console.log();
        warn(
          '\nSearch for the ' +
            chalk.underline('keywords') +
            ' to learn more about each warning.'
        );
        info(
          'To ignore, add "// eslint-disable-next-line"  to the line before.\n'
        );
      } else {
        info('Compiled successfully.\n');
      }
      const before = getFilesTotalSize(previousFileSizes);

      const newFiles = await measureFileSizesBeforeBuild(paths.appBuild);
      const after = getFilesTotalSize(newFiles);

      info('Total sizes, KB:', {
        before: Math.round(before) / 1000,
        after: Math.round(after) / 1000,
      });

      log('File sizes after gzip:\n');
      printFileSizesAfterBuild(
        stats,
        previousFileSizes,
        paths.appBuild,
        WARN_AFTER_BUNDLE_GZIP_SIZE,
        WARN_AFTER_CHUNK_GZIP_SIZE
      );
      console.log();
    },
    (err) => {
      const tscCompileOnError = process.env.TSC_COMPILE_ON_ERROR === 'true';
      if (tscCompileOnError) {
        warn(
          'Compiled with the following type errors (you may want to check these before deploying your app):\n'
        );

        printBuildError(err);
      } else {
        error('Failed to compile.\n');
        printBuildError(err);
        process.exit(1);
      }
    }
  )
  .catch((err) => {
    error(err.message || 'Undefined error', err);
    process.exit(1);
  });

// Create the production build and print the deployment instructions.
function build(previousFileSizes) {
  info('Creating an optimized production build...');

  const compiler = webpack(config);

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages;
      if (err) {
        if (!err.message) {
          error('Unknown error', err);
          return reject(err);
        }

        let errMessage = err.message;

        // Add additional information for postcss errors
        if (Object.prototype.hasOwnProperty.call(err, 'postcssNode')) {
          errMessage +=
            '\nCompileError: Begins at CSS selector ' +
            err['postcssNode'].selector;
        }

        messages = formatWebpackMessages({
          errors: [errMessage],
          warnings: [],
        });
      } else {
        messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );
      }
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        warn(
          '\nTreating warnings as errors because process.env.CI = true.\n' +
            'Most CI servers set it automatically.\n'
        );

        return reject(new Error(messages.warnings.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      };

      if (writeStatsJson) {
        return bfj
          .write(paths.appBuild + '/bundle-stats.json', stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch((error) => reject(new Error(error)));
      }

      return resolve(resolveArgs);
    });
  });
}

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuild, {
    dereference: true,
    filter: (file) => file !== paths.appHtml,
  });
}

function getFilesTotalSize(files) {
  let result = 0;
  if (files.sizes) {
    for (const el of Object.keys(files.sizes)) {
      result += files.sizes[el];
    }
  }
  return result;
}
