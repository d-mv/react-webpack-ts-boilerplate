'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

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

const webpack = require('webpack');
const chalk = require('react-dev-utils/chalk');
const config = require('../config/webpack.dev.config');
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
} = require('react-dev-utils/WebpackDevServerUtils');
const WebpackDevServer = require('webpack-dev-server');
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
const paths = require('../config/paths');
const createDevServerConfig = require('../config/devServer.config');
const openBrowser = require('react-dev-utils/openBrowser');
const semver = require('semver');
const react = require(require.resolve('react', { paths: [paths.appPath] }));
const clearConsole = require('react-dev-utils/clearConsole');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const getClientEnvironment = require('../config/env');
const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  error('Either fields are missing:', {
    'paths.appHtml': paths.appHtml,
    'paths.appIndexJs': paths.appIndexJs,
  });
  process.exit(1);
}

const tscCompileOnError = Boolean(process.env.TSC_COMPILE_ON_ERROR);
const protocol = Boolean(process.env.HTTPS) ? 'https' : 'http';
const DEFAULT_PORT = parseInt(process.env.PORT || '5678', 10);
const HOST = process.env.HOST || '0.0.0.0';
const isInteractive = process.stdout.isTTY;

if (process.env.HOST) {
  info(
    `Attempting to bind to HOST environment variable: ${chalk.bold(
      process.env.HOST
    )}`
  );
  log(
    `If this was unintentional, check that you haven't mistakenly set it in your shell.`
  );
  log(`Learn more here: https://cra.link/advanced-config`);
  log();
}

info('Dev server settings:', {
  tscCompileOnError,
  protocol,
  DEFAULT_PORT,
  HOST,
  isInteractive,
});

const appName = require(paths.appPackageJson).name;

// We require that you explicitly set browsers and do not fall back to
// browserslist defaults.
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // We attempt to use the default port but if it is busy, we offer the user to
    // run on a different port. `choosePort()` Promise resolves to the next free port.
    return choosePort(HOST, DEFAULT_PORT);
  })
  .then((port) => {
    if (port == null) {
      error('Port not found');
      return;
    }

    const urls = prepareUrls(protocol, HOST, port);

    const devSocket = {
      warnings: (warnings) =>
        devServer.sockWrite(devServer.sockets, 'warnings', warnings),
      errors: (errors) =>
        devServer.sockWrite(devServer.sockets, 'errors', errors),
    };

    const compiler = createCompiler({
      appName,
      config,
      devSocket,
      urls,
      useYarn: false,
      useTypeScript: true,
      tscCompileOnError,
      webpack,
    });

    // Load proxy config
    const proxySetting = require(paths.appPackageJson).proxy;
    const proxyConfig = prepareProxy(
      proxySetting,
      paths.appPublic,
      paths.publicUrlOrPath
    );

    // Setup devServer
    const serverConfig = createDevServerConfig(
      proxyConfig,
      urls.lanUrlForConfig
    );
    const devServer = new WebpackDevServer(compiler, serverConfig);

    // Launch WebpackDevServer.
    devServer.listen(port, HOST, (err) => {
      if (err) return error('Unable to start', err);

      if (isInteractive) clearConsole();

      if (env.raw.FAST_REFRESH && semver.lt(react.version, '16.10.0'))
        warn(
          `Fast Refresh requires React 16.10 or higher. You are using React ${react.version}.`
        );

      info('Starting the development server...\n');
      openBrowser(urls.localUrlForBrowser);
    });

    ['SIGINT', 'SIGTERM'].forEach(function (sig) {
      process.on(sig, function () {
        devServer.close();
        process.exit();
      });
    });

    if (!Boolean(process.env.CI)) {
      // Gracefully exit when stdin ends
      process.stdin.on('end', function () {
        devServer.close();
        process.exit();
      });
    }
  })
  .catch((err) => {
    error(err.message || 'Undefined error', err);

    process.exit(1);
  });
