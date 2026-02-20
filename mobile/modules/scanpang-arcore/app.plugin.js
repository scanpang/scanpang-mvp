// ARCore Geospatial Config Plugin
// AndroidManifest에 ARCore 메타데이터 + API 키 추가
const { withAndroidManifest } = require('expo/config-plugins');

const withARCore = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // ARCore meta-data (optional: 폴백 지원)
    const hasARCoreMeta = application['meta-data'].some(
      (m) => m.$?.['android:name'] === 'com.google.ar.core'
    );
    if (!hasARCoreMeta) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.ar.core',
          'android:value': 'optional',
        },
      });
    }

    // Google Geospatial API 키
    const hasGeoKey = application['meta-data'].some(
      (m) => m.$?.['android:name'] === 'com.google.android.geo.API_KEY'
    );
    if (!hasGeoKey) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': 'AIzaSyCU4jTboGsuPzzSGE-BH-HbPorYLNoVGNE',
        },
      });
    }

    // AR 카메라 기능 (optional)
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }
    const hasARFeature = manifest['uses-feature'].some(
      (f) => f.$?.['android:name'] === 'android.hardware.camera.ar'
    );
    if (!hasARFeature) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.camera.ar',
          'android:required': 'false',
        },
      });
    }

    // OpenGL ES 3.0 (ARCore 요구)
    const hasGLES = manifest['uses-feature'].some(
      (f) => f.$?.['android:glEsVersion'] === '0x00030000'
    );
    if (!hasGLES) {
      manifest['uses-feature'].push({
        $: {
          'android:glEsVersion': '0x00030000',
          'android:required': 'false',
        },
      });
    }

    return config;
  });
};

module.exports = withARCore;
