// Android keeps its existing static configuration. iOS is an explicit build target.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PLATFORM !== 'ios' && process.env.CRICKET_TARGET_PLATFORM !== 'ios') return config;
  return require('./scripts/ios-app.config.cjs')({ config });
};
