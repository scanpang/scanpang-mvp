/**
 * Gemini Map Vision 서비스
 * NCP Static Map 이미지 + Gemini Vision AI로 건물명 판독
 *
 * 흐름: identifyBuilding(lat, lng, heading)
 *   → fetchStaticMap(lat, lng)        // NCP Static Map (~250ms)
 *   → analyzeWithGemini(image, heading) // Gemini Flash Lite (~1.5초)
 *   → { buildingName, confidence }
 */
const axios = require('axios');

const NCP_CLIENT_ID = process.env.NCP_CLIENT_ID;
const NCP_CLIENT_SECRET = process.env.NCP_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * NCP Static Map API로 지도 이미지 가져오기
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Buffer|null} PNG 이미지 Buffer
 */
async function fetchStaticMap(lat, lng) {
  if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
    console.warn('[GeminiVision] NCP 키 미설정');
    return null;
  }

  try {
    const res = await axios.get('https://maps.apigw.ntruss.com/map-static/v2/raster', {
      params: {
        center: `${lng},${lat}`,
        level: 18,
        w: 512,
        h: 512,
        scale: 1,
        maptype: 'basic',
        lang: 'ko',
        format: 'png',
      },
      headers: {
        'X-NCP-APIGW-API-KEY-ID': NCP_CLIENT_ID,
        'X-NCP-APIGW-API-KEY': NCP_CLIENT_SECRET,
      },
      responseType: 'arraybuffer',
      timeout: 5000,
    });

    return Buffer.from(res.data);
  } catch (err) {
    console.warn('[GeminiVision] Static Map 실패:', err.message);
    return null;
  }
}

/**
 * Gemini Vision AI로 지도 이미지에서 건물명 판독
 * @param {Buffer} imageBuffer - PNG 이미지 Buffer
 * @param {number} heading - 방위각 (0~360)
 * @returns {{ buildingName: string|null }} 판독 결과
 */
async function analyzeWithGemini(imageBuffer, heading) {
  if (!GEMINI_API_KEY) {
    console.warn('[GeminiVision] Gemini API 키 미설정');
    return { buildingName: null };
  }

  const base64Image = imageBuffer.toString('base64');

  const prompt = `이 네이버 지도 이미지의 정중앙에 사람이 서있습니다.
이 사람이 heading ${heading}° 방향을 바라보고 있습니다.
(0°=북/위, 90°=동/오른쪽, 180°=남/아래, 270°=서/왼쪽)

중심에서 ${heading}° 방향으로 가장 가까운 건물명을 지도에서 읽어주세요.

규칙:
1. 지도에 표시된 텍스트를 정확히 읽을 것
2. 건물명이 여러 개면 heading 방향에서 가장 가까운 하나만
3. 찾을 수 없으면 buildingName을 null로

JSON으로만 응답: {"buildingName": "건물명 또는 null"}`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      },
      { timeout: 10000 }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[GeminiVision] Gemini 응답:', text);

    // JSON 파싱 시도
    try {
      // JSON 블록 추출 (```json ... ``` 감싸기 대응)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          buildingName: parsed.buildingName === 'null' ? null : (parsed.buildingName || null),
        };
      }
    } catch (parseErr) {
      // JSON 파싱 실패 → 정규식으로 한글 건물명 추출 시도
      console.warn('[GeminiVision] JSON 파싱 실패, 정규식 시도:', parseErr.message);
      const koreanMatch = text.match(/["']([가-힣a-zA-Z0-9\s·\-]+)["']/);
      if (koreanMatch) {
        return { buildingName: koreanMatch[1].trim() };
      }
    }

    return { buildingName: null };
  } catch (err) {
    console.warn('[GeminiVision] Gemini 호출 실패:', err.message);
    return { buildingName: null };
  }
}

/**
 * 메인 함수: 좌표 + heading → 건물명 판독
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} heading - 방위각 (0~360)
 * @returns {{ buildingName: string|null }}
 */
async function identifyBuilding(lat, lng, heading) {
  const startTime = Date.now();
  console.log(`[GeminiVision] 요청: lat=${lat}, lng=${lng}, heading=${heading}°`);

  // 1. Static Map 이미지 가져오기
  const imageBuffer = await fetchStaticMap(lat, lng);
  if (!imageBuffer) {
    return { buildingName: null };
  }

  const mapTime = Date.now() - startTime;

  // 2. Gemini Vision으로 건물명 판독
  const result = await analyzeWithGemini(imageBuffer, heading);

  const totalTime = Date.now() - startTime;
  console.log(`[GeminiVision] 완료: ${result.buildingName || 'null'} (map: ${mapTime}ms, total: ${totalTime}ms)`);

  return result;
}

module.exports = {
  identifyBuilding,
  fetchStaticMap,
  analyzeWithGemini,
};
