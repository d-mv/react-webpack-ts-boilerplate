'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const paths = require('./paths');
const postcssNormalize = require('postcss-normalize');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getClientEnvironment = require('./env');
const { DefinePlugin } = require('webpack');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const { log } = require('./logger');
const { OptimizeHook } = require('./hooks');

const reactRefreshOverlayEntry = require.resolve(
  'react-dev-utils/refreshOverlayInterop'
);

const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));

const isProduction = process.env.NODE_ENV === 'production';
const shouldUseSourceMap = Boolean(process.env.GENERATE_SOURCEMAP);
const shouldInlineRuntimeChunk = Boolean(process.env.INLINE_RUNTIME_CHUNK);
const withServiceWorker = Boolean(process.env.SERVICE_WORKER);

// Get the path to the uncompiled service worker (if it exists).
const swSrc = paths.swSrc;

// Variable used for enabling profiling in Production
// passed into alias object. Uses a flag if passed into the build command
const isEnvProductionProfile = process.argv.includes('--profile');

log('Settings:', {
  mode: process.env.NODE_ENV,
  shouldUseSourceMap,
  shouldInlineRuntimeChunk,
  withServiceWorker,
  isEnvProductionProfile,
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
    // isDev && require.resolve('style-loader'),
    isProduction && {
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
          sourceMap: isProduction ? shouldUseSourceMap : false,
        },
      },
    },
  ].filter(Boolean);
  if (preProcessor) {
    loaders.push(
      {
        loader: require.resolve('resolve-url-loader'),
        options: {
          sourceMap: isProduction ? shouldUseSourceMap : false,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      sourceMap: isProduction ? shouldUseSourceMap : false,
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
      sourceMap: isProduction ? shouldUseSourceMap : false,
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
        sourceMap: isProduction ? shouldUseSourceMap : false,
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
        sourceMap: isProduction ? shouldUseSourceMap : false,
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
  new ESLintPlugin({ extensions: ['js', 'jsx', 'ts', 'tsx'] }),
  new HtmlWebpackPlugin({
    inject: true,
    template: paths.appHtml,
    minify: {
      removeComments: true,
      collapseWhitespace: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
    },
  }),
  // Makes some environment variables available in index.html.
  // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
  // <link rel="icon" href="%PUBLIC_URL%/favicon.ico">
  // It will be an empty string unless you specify "homepage"
  // in `package.json`, in which case it will be the pathname of that URL.
  new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
  // This gives some necessary context to module not found errors, such as
  // the requesting resource.
  new ModuleNotFoundPlugin(paths.appPath),
  // Makes some environment variables available to the JS code, for example:
  // if (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
  // It is absolutely essential that NODE_ENV is set to production
  // during a production build.
  // Otherwise React will be compiled in the very slow development mode.
  new DefinePlugin(env.stringified),
  // Inlines the webpack runtime script. This script is too small to warrant
  // a network request.
  // https://github.com/facebook/create-react-app/issues/5358
  shouldInlineRuntimeChunk &&
    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime-.+[.]js/]),
  new MiniCssExtractPlugin({
    // Options similar to the same options in webpackOptions.output
    // both options are optional
    filename: 'static/css/[name].[contenthash:8].css',
    chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
  }),
  new WebpackManifestPlugin({
    fileName: 'asset-manifest.json',
    publicPath: paths.publicUrlOrPath,
    generate: (seed, files, entrypoints) => {
      const manifestFiles = files.reduce((manifest, file) => {
        manifest[file.name || ''] = file.path;
        return manifest;
      }, seed);
      const entrypointFiles = entrypoints.main.filter(
        (fileName) => !fileName.endsWith('.map')
      );

      return {
        files: manifestFiles,
        entrypoints: entrypointFiles,
      };
    },
  }),
  // Generate a service worker script that will precache, and keep up to date,
  // the HTML & assets that are part of the webpack build.
  withServiceWorker &&
    new InjectManifest({
      swSrc,
      swDest: 'sw.js',
      dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
      exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
      // Bump up the default maximum size (2mb) that's precached,
      // to make lazy-loading failure scenarios less likely.
      // See https://github.com/cra-template/pwa/issues/13#issuecomment-722667270
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    }),
  new ForkTsCheckerWebpackPlugin({ async: true }),
  new OptimizeHook(),
].filter(Boolean);

const config = {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    filename: 'static/js/[name].[contenthash:8].js',
    path: paths.appBuild,
    chunkFilename: 'static/js/[name].[contenthash:8].chunk.js',
    publicPath: paths.publicUrlOrPath,
    devtoolModuleFilenameTemplate: (info) =>
      path
        .relative(paths.appSrc, info.absoluteResourcePath)
        .replace(/\\/g, '/'),
    globalObject: 'this',
  },
  optimization: {
    minimize: true,
    minimizer: [
      // This is only used in production mode
      new TerserPlugin({
        terserOptions: {
          parse: {
            // We want terser to parse ecma 8 code. However, we don't want it
            // to apply any minification steps that turns valid ecma 5 code
            // into invalid ecma 5 code. This is why the 'compress' and 'output'
            // sections only apply transformations that are ecma 5 safe
            // https://github.com/facebook/create-react-app/pull/4234
            ecma: 2017,
          },
          compress: {
            ecma: 5,
            // Disabled because of an issue with Uglify breaking seemingly valid code:
            // https://github.com/facebook/create-react-app/issues/2376
            // Pending further investigation:
            // https://github.com/mishoo/UglifyJS2/issues/2011
            comparisons: false,
            // Disabled because of an issue with Terser breaking valid code:
            // https://github.com/facebook/create-react-app/issues/5250
            // Pending further investigation:
            // https://github.com/terser-js/terser/issues/120
            inline: 2,
          },
          mangle: { safari10: true },
          // Added for profiling in devtools
          keep_classnames: isEnvProductionProfile,
          keep_fnames: isEnvProductionProfile,
          output: {
            ecma: 5,
            comments: false,
            // Turned on because emoji and regex is not minified properly using default
            // https://github.com/facebook/create-react-app/issues/2488
            ascii_only: true,
          },
        },
        parallel: process.env.CI ? false : true,
      }),
      new OptimizeCSSAssetsPlugin({
        cssProcessorOptions: {
          parser: safePostCssParser,
          map: shouldUseSourceMap
            ? {
                // `inline: false` forces the sourcemap to be output into a
                // separate file
                inline: false,
                // `annotation: true` appends the sourceMappingURL to the end of
                // the css file, helping the browser find the sourcemap
                annotation: true,
              }
            : false,
        },
        cssProcessorPluginOptions: {
          preset: ['default', { minifyFontValues: { removeQuotes: false } }],
        },
      }),
    ],
    // Automatically split vendor and commons
    // https://twitter.com/wSokra/status/969633336732905474
    // https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366
    splitChunks: {
      chunks: 'all',
      minSize: 10000,
      maxSize: 100000,
      minRemainingSize: 0,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
    // Keep the runtime chunk separated to enable long term caching
    // https://twitter.com/wSokra/status/969679223278505985
    // https://github.com/facebook/create-react-app/issues/5358
    runtimeChunk: { name: (entrypoint) => `runtime-${entrypoint.name}` },
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
      // @ts-ignore
      ...rules,
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: { src: path.resolve(__dirname, '../src') },
    plugins: [
      new ModuleScopePlugin(paths.appSrc, [
        paths.appPackageJson,
        reactRefreshOverlayEntry,
      ]),
    ],
  },
  plugins,
};

module.exports = config;
