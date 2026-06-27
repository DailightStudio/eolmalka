#!/bin/bash
# eolmalka Android 빌드 스크립트

set -e

echo "🔨 eolmalka Android 빌드 시작"
echo "📱 버전: $(jq -r '.version' package.json)"

# 1. 의존성 설치
echo "📦 의존성 설치 중..."
npm ci --legacy-peer-deps

# 2. Expo prebuild (native 폴더 생성)
echo "🏗️ Native 폴더 생성 중..."
npx expo prebuild --clean --platform android

# 3. Gradle 빌드 (debug 또는 release)
BUILD_TYPE=${1:-release}
echo "🔨 Gradle $BUILD_TYPE 빌드 중..."

cd android
if [ "$BUILD_TYPE" == "debug" ]; then
  ./gradlew assembleDebug
else
  ./gradlew assembleRelease
fi

BUILD_DIR="app/build/outputs/apk/$BUILD_TYPE"
APK_FILE=$(ls $BUILD_DIR/*.apk 2>/dev/null | head -1)

if [ -n "$APK_FILE" ]; then
  echo "✅ 빌드 완료: $APK_FILE"
  echo "📍 파일 크기: $(du -h "$APK_FILE" | cut -f1)"
else
  echo "❌ APK 파일을 찾을 수 없습니다"
  exit 1
fi

echo "✨ Android 빌드 완료!"
