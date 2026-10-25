#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
build_label="${CRICKET_IOS_BUILD_LABEL:-$(date -u +%Y-%m-%dT%H-%M-%SZ)}"
if [[ ! "$build_label" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo 'CRICKET_IOS_BUILD_LABEL must contain only letters, digits, underscores or hyphens.' >&2
  exit 1
fi
build_log="output/ios-simulator/evidence/ios-build-${build_label}.log"
if [ -e "$build_log" ]; then
  echo "Refusing to overwrite earlier build evidence: $build_log" >&2
  exit 1
fi
mkdir -p output/ios-simulator/evidence
node scripts/prepareIosSimulator.cjs
export EXPO_NO_DOTENV=1 NODE_ENV=production CRICKET_IOS_SIMULATOR=true
export EXPO_PUBLIC_QA_TOOLS=false EXPO_PUBLIC_SUPABASE_ENABLED=false
export EXPO_PUBLIC_SUPABASE_URL='' EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='' EXPO_PUBLIC_SUPABASE_ANON_KEY=''
export EXPO_PUBLIC_REVENUECAT_IOS_KEY='' EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=''
export EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT=ca-app-pub-3940256099942544/1712485313
export EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT=ca-app-pub-3940256099942544/4411468910
export EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT=ca-app-pub-3940256099942544/2934735716
export EXPO_PUBLIC_PRIVACY_POLICY_URL=https://sunlight-publisher-site.pages.dev/privacy/
export EXPO_PUBLIC_TERMS_URL=https://sunlight-publisher-site.pages.dev/terms/
export EXPO_PUBLIC_SUPPORT_URL=https://sunlight-publisher-site.pages.dev/support/
export EXPO_PUBLIC_ACCOUNT_DELETION_URL=https://sunlight-publisher-site.pages.dev/delete-account/
export NODE_BINARY="$(command -v node)"
cd output/ios-simulator/workspace
if [ ! -d ios/CricketSimulator.xcworkspace ]; then
  echo 'Run the documented iOS prebuild and CocoaPods setup first; this helper reuses that workspace.' >&2
  exit 1
fi
xcodebuild -workspace ios/CricketSimulator.xcworkspace -scheme CricketSimulator \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../derived-data CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- \
  EXPO_USE_PRECOMPILED_MODULES=0 build > "../../../$build_log" 2>&1
echo 'Built standalone simulator app: output/ios-simulator/derived-data/Build/Products/Release-iphonesimulator/CricketSimulator.app'
echo "Build evidence: $build_log"
