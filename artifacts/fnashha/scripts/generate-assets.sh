#!/usr/bin/env bash
# ============================================================
# Fnashha — App Icon & Splash Screen Generator
# Requires: ImageMagick 7+
# Source:   the repository's 4000×4000 high-resolution logo
# Run from: anywhere
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="${ICON_SOURCE:-$WEB_ROOT/../../attached_assets/SAVE_20260702_184820_1784947084133.jpg}"
ANDROID="$WEB_ROOT/android/app/src/main/res"
IOS="$WEB_ROOT/ios/App/App/Assets.xcassets"
PWA="$WEB_ROOT/public/assets"
EXPO_ROOT="$WEB_ROOT/../fnashha-expo"
FLUTTER_ROOT="$WEB_ROOT/../../mobile"
TMP="$(mktemp -d /tmp/fnashha_assets.XXXXXX)"

cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

if [[ ! -f "$SRC" ]]; then
  echo "Icon source not found: $SRC" >&2
  exit 1
fi

magick_cmd() {
  if command -v magick >/dev/null 2>&1; then
    magick "$@"
  else
    convert "$@"
  fi
}

resize_direct() {
  local size="$1"
  local destination="$2"
  magick_cmd "$SRC" -filter Lanczos -resize "${size}x${size}" "$destination"
}

resize_on_canvas() {
  local width="$1"
  local height="$2"
  local logo_size="$3"
  local destination="$4"
  magick_cmd -size "${width}x${height}" xc:"#FFC000" \
    \( "$SRC" -filter Lanczos -resize "${logo_size}x${logo_size}" \) \
    -gravity center -composite -extent "${width}x${height}" "$destination"
}

resize_adaptive_foreground() {
  local size="$1"
  local destination="$2"
  local logo_size=$((size * 62 / 100))
  magick_cmd -size "${size}x${size}" xc:none \
    \( "$SRC" -filter Lanczos -resize "${logo_size}x${logo_size}" \) \
    -gravity center -composite "$destination"
}

echo "Creating assets directly from: $SRC"
resize_direct 1024 "$TMP/icon_master.png"

echo "Android square icons"
declare -A MIPMAP_SIZES=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  resize_direct "${MIPMAP_SIZES[$density]}" \
    "$ANDROID/mipmap-$density/ic_launcher.png"
  resize_direct "${MIPMAP_SIZES[$density]}" \
    "$ANDROID/mipmap-$density/ic_launcher_round.png"
done

echo "Android adaptive foreground icons"
declare -A FG_SIZES=([mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432)
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  resize_adaptive_foreground "${FG_SIZES[$density]}" \
    "$ANDROID/mipmap-$density/ic_launcher_foreground.png"
done

echo "Android notification icons"
magick_cmd "$TMP/icon_master.png" -resize 96x96 \
  -colorspace Gray -negate -threshold 40% -negate -alpha on \
  \( +clone -alpha extract -negate \) -compose CopyOpacity -composite \
  -channel RGB -evaluate set 65535 +channel \
  "$TMP/ic_notification_96.png"
declare -A NOTIF_SIZES=([mdpi]=24 [hdpi]=36 [xhdpi]=48 [xxhdpi]=72 [xxxhdpi]=96)
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  magick_cmd "$TMP/ic_notification_96.png" -resize "${NOTIF_SIZES[$density]}x${NOTIF_SIZES[$density]}" \
    "$ANDROID/drawable-$density/ic_notification.png"
done

cat > "$ANDROID/values/ic_launcher_background.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Adaptive icon background matching the uploaded source logo. -->
    <color name="ic_launcher_background">#FFC000</color>
</resources>
EOF

echo "Capacitor iOS icon and splash"
resize_direct 1024 "$IOS/AppIcon.appiconset/AppIcon-512@2x.png"
resize_on_canvas 2732 2732 900 "$TMP/splash_master.png"
for suffix in "" "-1" "-2"; do
  cp "$TMP/splash_master.png" \
    "$IOS/Splash.imageset/splash-2732x2732${suffix}.png"
done

echo "Capacitor Android splash"
resize_on_canvas 480 320 168 "$ANDROID/drawable/splash.png"
declare -A PORT_SPLASH=([mdpi]="480x800" [hdpi]="720x1280" [xhdpi]="1080x1920" [xxhdpi]="1080x1920" [xxxhdpi]="1440x2560")
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  dims="${PORT_SPLASH[$density]}"
  w="${dims%x*}"
  h="${dims#*x}"
  resize_on_canvas "$w" "$h" "$((w * 35 / 100))" \
    "$ANDROID/drawable-port-$density/splash.png"
done
declare -A LAND_SPLASH=([mdpi]="800x480" [hdpi]="1280x720" [xhdpi]="1920x1080" [xxhdpi]="1920x1080" [xxxhdpi]="2560x1440")
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  dims="${LAND_SPLASH[$density]}"
  w="${dims%x*}"
  h="${dims#*x}"
  resize_on_canvas "$w" "$h" "$((h * 50 / 100))" \
    "$ANDROID/drawable-land-$density/splash.png"
done

echo "Web PWA icons and favicon"
for size in 48 72 96 128 144 152 167 180 192 256 384 512; do
  resize_direct "$size" "$PWA/icon-$size.png"
done
resize_direct 512 "$PWA/app-icon-master.png"
resize_direct 512 "$PWA/play-store-icon.png"
resize_direct 192 "$PWA/logo.png"
resize_direct 32 "$PWA/favicon.png"
magick_cmd "$SRC" -filter Lanczos -resize 64x64 \
  -define icon:auto-resize=16,32,48,64 "$WEB_ROOT/public/favicon.ico"

echo "Expo icon, runtime logo, and splash source"
resize_direct 1024 "$EXPO_ROOT/assets/images/icon.png"
resize_direct 1024 "$EXPO_ROOT/assets/images/icon_2.png"
resize_direct 1024 "$EXPO_ROOT/assets/images/logo.png"
resize_adaptive_foreground 1024 "$EXPO_ROOT/assets/images/adaptive-icon.png"

echo "Flutter Android icons"
declare -A FLUTTER_ICON_SIZES=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  resize_direct "${FLUTTER_ICON_SIZES[$density]}" \
    "$FLUTTER_ROOT/android/app/src/main/res/mipmap-$density/ic_launcher.png"
  resize_direct "${FLUTTER_ICON_SIZES[$density]}" \
    "$FLUTTER_ROOT/android/app/src/main/res/mipmap-$density/ic_launcher_round.png"
done
declare -A FLUTTER_FOREGROUND_SIZES=([mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432)
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  resize_adaptive_foreground "${FLUTTER_FOREGROUND_SIZES[$density]}" \
    "$FLUTTER_ROOT/android/app/src/main/res/mipmap-$density/ic_launcher_foreground.png"
done

echo "Flutter iOS icons"
declare -A FLUTTER_IOS_SIZES=(
  ["Icon-App-20x20@1x.png"]=20 ["Icon-App-20x20@2x.png"]=40 ["Icon-App-20x20@3x.png"]=60
  ["Icon-App-29x29@1x.png"]=29 ["Icon-App-29x29@2x.png"]=58 ["Icon-App-29x29@3x.png"]=87
  ["Icon-App-40x40@1x.png"]=40 ["Icon-App-40x40@2x.png"]=80 ["Icon-App-40x40@3x.png"]=120
  ["Icon-App-60x60@2x.png"]=120 ["Icon-App-60x60@3x.png"]=180
  ["Icon-App-76x76@1x.png"]=76 ["Icon-App-76x76@2x.png"]=152
  ["Icon-App-83.5x83.5@2x.png"]=167 ["Icon-App-1024x1024@1x.png"]=1024
)
for filename in "${!FLUTTER_IOS_SIZES[@]}"; do
  resize_direct "${FLUTTER_IOS_SIZES[$filename]}" \
    "$FLUTTER_ROOT/ios/Runner/Assets.xcassets/AppIcon.appiconset/$filename"
done

echo "Flutter iOS launch logo"
for filename in LaunchImage.png LaunchImage@2x.png LaunchImage@3x.png; do
  resize_direct 1024 "$FLUTTER_ROOT/ios/Runner/Assets.xcassets/LaunchImage.imageset/$filename"
done

echo "All icon assets generated."