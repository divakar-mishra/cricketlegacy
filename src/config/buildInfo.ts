import { Platform } from 'react-native';
import { SAVE_SCHEMA_VERSION } from '../domain/types';
import { GENERATED_BUILD_INFO } from './buildInfo.generated';

export const BUILD_INFO = {
  ...GENERATED_BUILD_INFO,
  platform: Platform.OS,
  saveSchemaVersion: String(SAVE_SCHEMA_VERSION),
};
