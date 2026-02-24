// CameraX + YOLO Config Plugin
// AndroidManifest에 Google Maps/Places API 키만 유지
const { withAndroidManifest } = require('expo/config-plugins');

const withARCore = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Google Maps/Places API 키 (기존 호환)
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

    return config;
  });
};

module.exports = withARCore;
