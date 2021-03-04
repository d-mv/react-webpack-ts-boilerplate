const { Compilation } = require('webpack');

class OptimizeHook {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('OptimizeHooks', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'OptimizeHooks',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS, // see below for more stages
        },
        (assets) => {}
      );
    });
  }
}

module.exports = { OptimizeHook };
