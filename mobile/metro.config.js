const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// axios Node.js 번들 → browser 번들로 강제 리디렉션
// axios v1.13+는 dist/node/axios.cjs에서 crypto, http 등 Node 내장 모듈을 참조하여
// React Native(Metro)에서 빌드 실패 발생
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // axios의 Node.js 번들을 browser 번들로 대체
  if (moduleName === 'axios' || moduleName === './dist/node/axios.cjs') {
    const browserEntry = path.resolve(
      __dirname,
      'node_modules',
      'axios',
      'dist',
      'browser',
      'axios.cjs'
    );
    return { type: 'sourceFile', filePath: browserEntry };
  }

  // 기본 resolver 사용
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
