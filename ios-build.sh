#!/bin/bash
# iOS 빌드 스크립트 — EAS로 로컬 Xcode 빌드 실행
# 실행: npx eas build --platform ios --local

set -e

cd "$(dirname "$0")" || exit 1

echo "🍎 [eolmalka] iOS 빌드 시작..."
echo "작업 폴더: $(pwd)"

# npm 의존성 설치 (필요 시)
if [ ! -d "node_modules" ]; then
    echo "📦 npm 의존성 설치 중..."
    npm install --legacy-peer-deps
fi

# EAS 빌드 실행 (로컬 Xcode 사용)
echo "🔨 Xcode 빌드 실행 중... (5~15분 소요)"
npx eas build --platform ios --local

# 빌드 완료 후 .ipa 파일 확인
echo "✅ 빌드 완료"
echo "생성된 .ipa 파일:"
find . -name "*.ipa" -type f -exec ls -lh {} \; 2>/dev/null || echo "(아직 생성 중 또는 빌드 경로 확인 필요)"
