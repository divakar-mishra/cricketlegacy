/* An isolated simulator configuration, not the Android or App Store config.
 * Copy the source into output/ios-simulator/workspace before loading this.
 * Firebase is Android-only in the current telemetry facade and has no iOS
 * service file yet. Exclude its iOS native packages in the staged package.json.
 */
const GOOGLE_IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = ({ config }) => ({
  ...config,
  name: 'Cricket Simulator',
  platforms: ['ios'],
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.coverdrive.cricket.simulator',
    infoPlist: {
      ...config.ios?.infoPlist,
      UIFileSharingEnabled: false,
    },
  },
  plugins: (config.plugins ?? [])
    .filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return !name.startsWith('@react-native-firebase/');
    })
    .map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== 'react-native-google-mobile-ads') return plugin;
      return [plugin[0], { ...plugin[1], iosAppId: GOOGLE_IOS_TEST_APP_ID }];
    }),
});
