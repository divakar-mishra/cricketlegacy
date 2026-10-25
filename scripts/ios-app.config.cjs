/* iOS native configuration. Simulator placeholders never masquerade as store IDs. */
const IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const isRealAppId = value => /^ca-app-pub-\d{16}~\d{10}$/.test(value || '') && !value.startsWith('ca-app-pub-3940256099942544');

module.exports = ({ config }, env = process.env) => {
  const simulator = env.CRICKET_IOS_SIMULATOR === 'true';
  const appId = env.ADMOB_IOS_APP_ID;
  if (!simulator && !isRealAppId(appId)) {
    throw new Error('Set ADMOB_IOS_APP_ID from your iOS AdMob app before building for distribution. Use CRICKET_IOS_SIMULATOR=true only for simulator QA.');
  }
  return {
    ...config,
    platforms: ['android', 'ios'],
    name: simulator ? 'Cricket Simulator' : 'Cricket',
    ios: {
      ...config.ios,
      ...(simulator ? {} : { appleTeamId: '25PTZT5DNC' }),
      bundleIdentifier: simulator ? 'com.coverdrive.cricket.simulator' : config.ios.bundleIdentifier,
      infoPlist: {
        ...config.ios.infoPlist,
        UIFileSharingEnabled: false,
        // Firebase is deliberately excluded from this initial iOS port. These
        // consent defaults also remain restrictive if enabled in a later port.
        FirebaseAnalyticsCollectionEnabled: false,
        FirebaseCrashlyticsCollectionEnabled: false,
        GADDelayAppMeasurementInit: true,
      },
    },
    plugins: config.plugins.filter(plugin => !(Array.isArray(plugin) ? plugin[0] : plugin).startsWith('@react-native-firebase/'))
      .map(plugin => Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads'
        ? [plugin[0], { ...plugin[1], iosAppId: simulator ? IOS_TEST_APP_ID : appId }] : plugin),
  };
};
