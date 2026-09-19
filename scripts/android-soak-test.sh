#!/usr/bin/env bash
set -euo pipefail

package_name="${ANDROID_PACKAGE_NAME:-com.coverdrive.cricket}"
duration_seconds="${SOAK_DURATION_SECONDS:-2700}"
sample_seconds="${SOAK_SAMPLE_SECONDS:-300}"
timestamp="$(date +%Y%m%d-%H%M%S)"
output_dir="${SOAK_OUTPUT_DIR:-artifacts/android-soak-${timestamp}}"
device_serial="${ANDROID_SERIAL:-}"
adb_command=(adb)

if [[ -n "$device_serial" ]]; then
  adb_command+=(-s "$device_serial")
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb was not found. Install Android platform-tools and try again."
  exit 1
fi

if ! "${adb_command[@]}" get-state >/dev/null 2>&1; then
  echo "No authorized Android device or emulator is connected."
  exit 1
fi

if ! "${adb_command[@]}" shell pm path "$package_name" >/dev/null 2>&1; then
  echo "$package_name is not installed on the connected device."
  exit 1
fi

mkdir -p "$output_dir"
"${adb_command[@]}" shell dumpsys package "$package_name" >"$output_dir/package.txt"
"${adb_command[@]}" shell dumpsys gfxinfo "$package_name" reset >/dev/null
"${adb_command[@]}" logcat -c

echo "Soak capture started for ${duration_seconds}s; sampling every ${sample_seconds}s."
echo "Use the app normally: Player Career, Manager Career, Transfers, matches, modals, save, background and resume."
echo "Results: $output_dir"

started_at="$(date +%s)"
sample=0
while true; do
  now="$(date +%s)"
  elapsed="$((now - started_at))"
  if (( elapsed > duration_seconds )); then
    break
  fi

  sample="$((sample + 1))"
  label="$(printf '%02d-%04ds' "$sample" "$elapsed")"
  "${adb_command[@]}" shell dumpsys meminfo "$package_name" >"$output_dir/mem-${label}.txt"
  "${adb_command[@]}" shell dumpsys gfxinfo "$package_name" >"$output_dir/gfx-${label}.txt"
  "${adb_command[@]}" shell dumpsys activity activities >"$output_dir/activity-${label}.txt"
  echo "Captured sample ${sample} at ${elapsed}s"

  remaining="$((duration_seconds - elapsed))"
  if (( remaining <= 0 )); then
    break
  fi
  if (( remaining < sample_seconds )); then
    sleep "$remaining"
  else
    sleep "$sample_seconds"
  fi
done

"${adb_command[@]}" logcat -d -v threadtime >"$output_dir/logcat.txt"
"${adb_command[@]}" shell dumpsys dropbox --print data_app_crash >"$output_dir/app-crashes.txt" || true
"${adb_command[@]}" shell dumpsys dropbox --print data_app_anr >"$output_dir/app-anrs.txt" || true

echo "Soak capture complete: $output_dir"
echo "Review monotonic memory growth, janky-frame percentage, app-crashes.txt, app-anrs.txt, and any observed missed taps."
