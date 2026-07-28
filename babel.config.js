module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 57) automatically includes the react-native-worklets
    // Babel plugin required by Reanimated 4. Do NOT add a reanimated/worklets
    // plugin manually here — doing so double-processes worklets and breaks every
    // useAnimatedStyle in the app (buttons render blank / animations throw).
    presets: ['babel-preset-expo'],
  };
};
