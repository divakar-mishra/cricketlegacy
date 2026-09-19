import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { SAVE_SCHEMA_VERSION } from '../domain/types';
import { GENERATED_BUILD_INFO } from './buildInfo.generated';

export const BUILD_INFO = {
  ...GENERATED_BUILD_INFO,
  appVersion: Application.nativeApplicationVersion ?? GENERATED_BUILD_INFO.appVersion,
  nativeBuildVersion:
    Application.nativeBuildVersion ??
    (Platform.OS === 'android'
      ? GENERATED_BUILD_INFO.androidVersionCode
      : GENERATED_BUILD_INFO.iosBuildNumber),
  platform: Platform.OS,
  saveSchemaVersion: String(SAVE_SCHEMA_VERSION),
};
