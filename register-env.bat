@echo off
cd /d C:\Users\Jay-server\Desktop\projects\eolmalka

echo 환경변수 등록 중...

npx eas-cli env:create --environment production --name EXPO_PUBLIC_OPINET_API_KEY --value F260603657 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://jxvjynujqecwebavmkyx.supabase.co --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dmp5bnVqcWVjd2ViYXZta3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1Njc3NzAsImV4cCI6MjA5NTE0Mzc3MH0.1iHFfuZteR6zePczFXC4_ehKaq_kUuGWNfvokr-i9Fs --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_DATA_GO_KR_KEY --value 6hVBUUPD85OPw88ofBgPN4GDc7azgePuT5noJvMIsjuqgWDZ3HZ1FFU29pm1a8Bty2jFWrnHFz1M+A+b5XnpOg== --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_TRAVELPAYOUTS_TOKEN --value 0a7477e5ca52781c6254c0963f359fa8 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_BANNER_ANDROID --value ca-app-pub-3035772295627652/1049925619 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID --value ca-app-pub-3035772295627652/7879743607 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID --value ca-app-pub-3035772295627652/5986557520 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_APPOPEN_ANDROID --value ca-app-pub-3035772295627652/8844655154 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_BANNER_IOS --value ca-app-pub-3035772295627652/4993040050 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS --value ca-app-pub-3035772295627652/1629499793 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_REWARDED_IOS --value ca-app-pub-3035772295627652/4187910609 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_APPOPEN_IOS --value ca-app-pub-3035772295627652/2363996967 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_NATIVE_IOS --value ca-app-pub-3035772295627652/6486770887 --visibility sensitive --force
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_NATIVE_ANDROID --value ca-app-pub-3035772295627652/9683779866 --visibility sensitive --force

echo.
echo 완료. 확인:
npx eas-cli env:list --environment production

pause
