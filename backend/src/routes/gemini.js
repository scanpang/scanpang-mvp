/**
 * Gemini Proxy API
 * - 카메라 프레임 분석 (Vision)
 * - Live 세션 관리 (채팅형 대화)
 * - SSE 스트림 응답
 * - 분석 결과 → 플라이휠 자동 소싱
 */
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');

// Gemini 클라이언트 초기화
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * POST /api/gemini/analyze-frame
 * 카메라 프레임(base64) → 건물 외관 분석 → 구조화된 결과 반환
 * 동시에 flywheel에 자동 소싱
 */
router.post('/analyze-frame', async (req, res, next) => {
  try {
    if (!genAI) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API가 설정되지 않았습니다. GEMINI_API_KEY를 확인해주세요.',
      });
    }

    const { imageBase64, mimeType, buildingId, buildingName, lat, lng, heading, sessionId } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64는 필수입니다.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are ScanPang's building analysis AI. Analyze this building photo and extract structured information.

${buildingName ? `The building is likely: ${buildingName}` : 'Identify the building in the image.'}
${lat && lng ? `Location: ${lat}, ${lng}` : ''}

Return a JSON object with these fields:
{
  "buildingIdentified": true/false,
  "confidence": 0.0-1.0,
  "buildingType": "commercial/residential/mixed/office/retail/etc",
  "floors": estimated number of floors,
  "features": ["feature1", "feature2", ...],
  "signage": ["sign text 1", "sign text 2", ...],
  "condition": "excellent/good/fair/poor",
  "style": "modern/traditional/industrial/etc",
  "neonSigns": true/false,
  "openStatus": "open/closed/unknown",
  "description": "Brief description in Korean",
  "tenants": ["tenant name 1", ...] if visible from signage
}

Only return valid JSON, no markdown or explanation.`;

    // 25초 타임아웃 적용
    const analyzePromise = model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      },
    ]);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Vision analysis timeout (25s)')), 25000)
    );

    const result = await Promise.race([analyzePromise, timeoutPromise]);
    const responseText = result.response.text();

    // JSON 파싱 시도
    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText, confidence: 0.3 };
    } catch {
      analysis = { raw: responseText, confidence: 0.3, parseError: true };
    }

    // Flywheel 자동 소싱 (buildingId가 있을 때, OSM 건물은 스킵)
    const isOsmBuilding = buildingId && String(buildingId).startsWith('osm_');
    if (buildingId && !isOsmBuilding && analysis.confidence >= 0.5) {
      db.query(`
        INSERT INTO sourced_info (building_id, source_type, raw_data, extracted_info, confidence, session_id, verified, verified_by)
        VALUES ($1, 'gemini_vision', $2, $3, $4, $5, $6, $7)
      `, [
        buildingId,
        JSON.stringify({ prompt: 'analyze-frame', responseText }),
        JSON.stringify(analysis),
        analysis.confidence,
        sessionId || null,
        analysis.confidence >= 0.8,
        analysis.confidence >= 0.8 ? 'auto' : null,
      ]).then(() => {
        console.log(`[Gemini→Flywheel] 소싱 성공: building ${buildingId}, confidence ${analysis.confidence}`);
      }).catch(err => console.warn('[Gemini→Flywheel] 소싱 실패:', err.message));
    }

    res.json({
      success: true,
      data: {
        analysis,
        buildingId: buildingId || null,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Gemini API 에러 처리
    if (err.message?.includes('API_KEY') || err.message?.includes('quota')) {
      return res.status(429).json({ success: false, error: 'Gemini API 할당량 초과 또는 키 오류' });
    }
    next(err);
  }
});


module.exports = router;
