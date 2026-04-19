// Vercel Serverless Function 엔트리
// Express 앱을 그대로 export하면 Vercel이 각 요청을 app(req, res)로 처리
module.exports = require('../src/app');
