// APK 크기 최적화 config plugin
// - ABI 필터링 (arm64-v8a만)
// - R8 코드 축소 + 리소스 축소 활성화
// - ProGuard keep 규칙 추가
// - 앱 레벨 의존성 추가 (ARCore Geospatial 필수)
const { withGradleProperties, withDangerousMod, withAppBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withApkOptimization(config) {
  // 1. gradle.properties 수정: ABI 필터링 + R8 활성화
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;

    // ABI를 arm64-v8a만 남김 (x86/x86_64 에뮬레이터용, armeabi-v7a 32비트 제거)
    const archIndex = props.findIndex(
      (p) => p.type === 'property' && p.key === 'reactNativeArchitectures'
    );
    if (archIndex !== -1) {
      props[archIndex].value = 'arm64-v8a';
    }

    // R8 코드 축소 활성화
    upsertGradleProp(props, 'android.enableMinifyInReleaseBuilds', 'true');

    // 리소스 축소 활성화
    upsertGradleProp(props, 'android.enableShrinkResourcesInReleaseBuilds', 'true');

    return config;
  });

  // 2. proguard-rules.pro에 ARCore/Expo/RN keep 규칙 추가
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );

      const extraRules = `
# ARCore + Geospatial 의존성 (Fused Location Provider)
-keep class com.google.ar.** { *; }
-keep class com.google.android.filament.** { *; }
-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.tasks.** { *; }

# Expo Modules
-keep class expo.modules.** { *; }
-keepclassmembers class * { @expo.modules.core.interfaces.ExpoProp *; }

# React Native
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
`;

      if (fs.existsSync(proguardPath)) {
        let content = fs.readFileSync(proguardPath, 'utf8');
        // gms.location 규칙이 없으면 추가
        if (!content.includes('com.google.android.gms.location')) {
          content += extraRules;
          fs.writeFileSync(proguardPath, content);
        }
      }

      return config;
    },
  ]);

  // 3. 앱 레벨 build.gradle에 play-services-location 의존성 추가
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('play-services-location')) {
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    // ARCore Geospatial 필수 의존성 (Fused Location Provider)\n    implementation("com.google.android.gms:play-services-location:21.1.0")`
      );
    }
    return config;
  });

  return config;
}

// gradle.properties에 속성 upsert
function upsertGradleProp(props, key, value) {
  const existing = props.find((p) => p.type === 'property' && p.key === key);
  if (existing) {
    existing.value = value;
  } else {
    props.push({ type: 'property', key, value });
  }
}

module.exports = withApkOptimization;
