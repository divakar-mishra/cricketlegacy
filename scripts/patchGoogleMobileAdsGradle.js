/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');

const gradleFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-google-mobile-ads',
  'android',
  'build.gradle',
);
const androidPlugin = "apply plugin: 'com.android.library'";
const kotlinPlugin = "apply plugin: 'kotlin-android'";

if (!fs.existsSync(gradleFile)) {
  throw new Error(`Google Mobile Ads Gradle file not found: ${gradleFile}`);
}

const source = fs.readFileSync(gradleFile, 'utf8');
if (source.includes(androidPlugin)) {
  console.log('Google Mobile Ads Gradle compatibility patch already applied.');
  process.exit(0);
}
if (!source.includes(kotlinPlugin)) {
  throw new Error('Google Mobile Ads Kotlin plugin marker changed; compatibility patch was not applied.');
}

const eol = source.includes('\r\n') ? '\r\n' : '\n';
fs.writeFileSync(gradleFile, source.replace(kotlinPlugin, `${androidPlugin}${eol}${kotlinPlugin}`));
console.log('Applied Google Mobile Ads Gradle compatibility patch.');
