'use strict';

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const paths = require('./paths');
const postcssNormalize = require('postcss-normalize');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getClientEnvironment = require('./env');
const { log } = require('./logger');

const webpackDevClientEntry = require.resolve(
  'react-dev-utils/webpackHotDevClient'
);

const reactRefreshOverlayEntry = require.resolve(
  'react-dev-utils/refreshOverlayInterop'
);

// We will provide `paths.publicUrlOrPath` to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
// Get environment variables to inject into our app.
const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));

const isDev = process.env.NODE_ENV === 'development';
const shouldUseSourceMap = Boolean(process.env.GENERATE_SOURCEMAP);
const shouldUseReactRefresh = env.raw.FAST_REFRESH;

log('Settings:', {
  mode: process.env.NODE_ENV,
  shouldUseSourceMap,
  shouldUseReactRefresh,
  ...paths,
  env: env.raw,
});

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// common function to get style loaders
const getStyleLoaders = (cssOptions, preProcessor = '') => {
  const loaders = [
    isDev && require.resolve('style-loader'),
    !isDev && {
      loader: MiniCssExtractPlugin.loader,
      // css is located in `static/css`, use '../../' to locate index.html folder
      // in production `paths.publicUrlOrPath` can be a relative path
      options: paths.publicUrlOrPath.startsWith('.')
        ? { publicPath: '../../' }
        : {},
    },
    {
      loader: require.resolve('css-loader'),
      options: cssOptions,
    },
    {
      // Options for PostCSS as we reference these options twice
      // Adds vendor prefixing based on your specified browser support in
      // package.json
      loader: require.resolve('postcss-loader'),
      options: {
        postcssOptions: {
          // Necessary for external CSS imports to work
          // https://github.com/facebook/create-react-app/issues/2677
          ident: 'postcss',
          plugins: [
            require('postcss-flexbugs-fixes'),
            require('postcss-preset-env')({
              autoprefixer: {
                flexbox: 'no-2009',
              },
              stage: 3,
            }),
            // Adds PostCSS Normalize as the reset css with default options,
            // so that it honors browserslist config in package.json
            // which in turn let's users customize the target behavior as per their needs.
            postcssNormalize(),
          ],
          sourceMap: !isDev ? shouldUseSourceMap : isDev,
        },
      },
    },
  ].filter(Boolean);
  if (preProcessor) {
    loaders.push(
      {
        loader: require.resolve('resolve-url-loader'),
        options: {
          sourceMap: !isDev ? shouldUseSourceMap : isDev,
          root: paths.appSrc,
        },
      },
      {
        loader: require.resolve(preProcessor),
        options: {
          sourceMap: true,
        },
      }
    );
  }
  return loaders;
};

const rules = [
  { test: [/\.avif$/], type: 'asset/inline' },
  { test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/], type: 'asset/inline' },
  // "postcss" loader applies autoprefixer to our CSS.
  // "css" loader resolves paths in CSS and adds assets as dependencies.
  // "style" loader turns CSS into JS modules that inject <style> tags.
  // In production, we use MiniCSSExtractPlugin to extract that CSS
  // to a file, but in development "style" loader enables hot editing
  // of CSS.
  // By default we support CSS Modules with the extension .module.css
  {
    test: cssRegex,
    exclude: cssModuleRegex,
    use: getStyleLoaders({
      importLoaders: 1,
      sourceMap: !isDev ? shouldUseSourceMap : isDev,
    }),
    // Don't consider CSS imports dead code even if the
    // containing package claims to have no side effects.
    // Remove this when webpack adds a warning or an error for this.
    // See https://github.com/webpack/webpack/issues/6571
    sideEffects: true,
  },
  // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
  // using the extension .module.css
  {
    test: cssModuleRegex,
    use: getStyleLoaders({
      importLoaders: 1,
      sourceMap: !isDev ? shouldUseSourceMap : isDev,
      modules: {
        getLocalIdent: getCSSModuleLocalIdent,
      },
    }),
  },
  // Opt-in support for SASS (using .scss or .sass extensions).
  // By default we support SASS Modules with the
  // extensions .module.scss or .module.sass
  {
    test: sassRegex,
    exclude: sassModuleRegex,
    use: getStyleLoaders(
      {
        importLoaders: 3,
        sourceMap: !isDev ? shouldUseSourceMap : isDev,
      },
      'sass-loader'
    ),
    // Don't consider CSS imports dead code even if the
    // containing package claims to have no side effects.
    // Remove this when webpack adds a warning or an error for this.
    // See https://github.com/webpack/webpack/issues/6571
    sideEffects: true,
  },
  // Adds support for CSS Modules, but using SASS
  // using the extension .module.scss or .module.sass
  {
    test: sassModuleRegex,
    use: getStyleLoaders(
      {
        importLoaders: 3,
        sourceMap: !isDev ? shouldUseSourceMap : isDev,
        modules: {
          getLocalIdent: getCSSModuleLocalIdent,
        },
      },
      'sass-loader'
    ),
  },
  // fallback
  {
    type: 'asset/resource',
    exclude: [
      /\.(js|mjs|jsx|ts|tsx)$/,
      /\.html$/,
      /\.json$/,
      /\.scss$/,
      /\.css$/,
    ],
  },
];
// };

const plugins = [
  new HtmlWebpackPlugin({ template: paths.appHtml }),
  new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
  new ModuleNotFoundPlugin(paths.appPath),
  new webpack.DefinePlugin(env.stringified),
  // Watcher doesn't work well if you mistype casing in a path so we use
  // a plugin that prints an error when you attempt to do this.
  // See https://github.com/facebook/create-react-app/issues/240
  new CaseSensitivePathsPlugin(),
  // If you require a missing module and then `npm install` it, you still have
  // to restart the development server for webpack to discover it. This plugin
  // makes the discovery automatic so you don't have to restart.
  // See https://github.com/facebook/create-react-app/issues/186
  new WatchMissingNodeModulesPlugin(paths.appNodeModules),
  // Experimental hot reloading for React .
  // https://github.com/facebook/react/tree/master/packages/react-refresh
  shouldUseReactRefresh &&
    new ReactRefreshWebpackPlugin({
      overlay: {
        entry: webpackDevClientEntry,
        // The expected exports are slightly different from what the overlay exports,
        // so an interop is included here to enable feedback on module-level errors.
        module: reactRefreshOverlayEntry,
        // Since we ship a custom dev client and overlay integration,
        // the bundled socket handling logic can be eliminated.
        sockIntegration: false,
      },
    }),

  new MiniCssExtractPlugin(),
  new ForkTsCheckerWebpackPlugin({ async: false }),
].filter(Boolean);

const config = {
  mode: 'development',
  entry: './src/index.tsx',
  output: {
    filename: 'static/js/[name].js',
    // Add /* filename */ comments to generated require()s in the output.
    pathinfo: true,
    chunkFilename: 'static/js/[name].chunk.js',
    // webpack uses `publicPath` to determine where the app is being served from.
    // It requires a trailing slash, or the file assets will get an incorrect path.
    // We inferred the "public path" (such as / or /my-project) from homepage.
    publicPath: paths.publicUrlOrPath,
    // Point sourcemap entries to original disk location (format as URL on Windows)
    devtoolModuleFilenameTemplate: (info) =>
      path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'),
    // this defaults to 'window', but by setting it to 'this' then
    // module chunks which are built will work in web workers as well.
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/i,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript',
            ],
          },
        },
      },
      ...rules,
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: { src: path.resolve(__dirname, '../src') },
    plugins: [
      // Prevents users from importing files from outside of src/ (or node_modules/).
      // This often causes confusion because we only process files within src/ with babel.
      // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
      // please link the files into your node_modules/ and let module-resolution kick in.
      // Make sure your source files are compiled, as they will not be processed in any way.
      new ModuleScopePlugin(paths.appSrc, [
        paths.appPackageJson,
        reactRefreshOverlayEntry,
      ]),
    ],
  },
  plugins,
  devtool: 'inline-source-map',
  devServer: {
    contentBase: path.join(__dirname, 'build'),
    historyApiFallback: true,
    port: process.env.PORT || 5678,
    open: true,
    hot: true,
  },
};
module.exports = config;
