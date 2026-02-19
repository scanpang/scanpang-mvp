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

// 활성 Live 세션 저장소 (메모리 — 프로덕션에서는 Redis 사용)
const liveSessions = new Map();
const sessionTimers = new Map(); // TTL 타이머 관리

// 세션 TTL: 30분, 최대 동시 세션 수
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 100;

// 세션 삭제 헬퍼
function deleteSession(sessionId) {
  liveSessions.delete(sessionId);
  const timer = sessionTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    sessionTimers.delete(sessionId);
  }
}

// 세션 TTL 리셋 헬퍼
function resetSessionTTL(sessionId) {
  const oldTimer = sessionTimers.get(sessionId);
  if (oldTimer) clearTimeout(oldTimer);
  const timer = setTimeout(() => { deleteSession(sessionId); }, SESSION_TTL);
  sessionTimers.set(sessionId, timer);
}

// 주기적 세션 정리 (5분마다 만료 세션 제거)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of liveSessions) {
    if (now - session.createdAt > SESSION_TTL) {
      deleteSession(id);
    }
  }
}, 5 * 60 * 1000);

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

    // Flywheel 자동 소싱 (buildingId가 있을 때)
    if (buildingId && analysis.confidence >= 0.5) {
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
      ]).catch(err => console.warn('[Gemini→Flywheel] 소싱 실패:', err.message));
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

/**
 * POST /api/gemini/live/start
 * Gemini Live 대화 세션 시작
 */
router.post('/live/start', async (req, res, next) => {
  try {
    if (!genAI) {
      return res.status(503).json({ success: false, error: 'Gemini API가 설정되지 않았습니다.' });
    }

    const { buildingId, buildingName, buildingInfo, lat, lng } = req.body;

    const sessionId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 건물 정보 조회
    let buildingContext = '';
    if (buildingId) {
      try {
        const bResult = await db.query(`
          SELECT b.name, b.address, b.category, b.metadata,
                 bp.description, bp.business_hours, bp.live_info
          FROM buildings b
          LEFT JOIN building_profiles bp ON bp.building_id = b.id
          WHERE b.id = $1
          LIMIT 1
        `, [buildingId]);
        if (bResult.rows[0]) {
          const b = bResult.rows[0];
          buildingContext = `Building: ${b.name}, Address: ${b.address || 'N/A'}, Category: ${b.category || 'N/A'}`;
          if (b.description) buildingContext += `, Description: ${b.description}`;
        }
      } catch {}
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const chat = model.startChat({
      history: [],
      generationConfig: { maxOutputTokens: 1024 },
    });

    // 시스템 프롬프트로 컨텍스트 설정
    const systemMessage = `You are ScanPang AI, a helpful building information assistant. You help users learn about buildings they're looking at through their AR camera.

${buildingContext || (buildingName ? `The user is looking at: ${buildingName}` : 'The user is exploring buildings nearby.')}
${buildingInfo ? `Additional info: ${JSON.stringify(buildingInfo)}` : ''}
${lat && lng ? `User location: ${lat}, ${lng}` : ''}

Guidelines:
- Answer in Korean by default
- Be concise and helpful
- Share interesting facts about the building
- If you don't know something, say so honestly
- Focus on practical information (business hours, tenants, nearby attractions)`;

    // 초기 컨텍스트 전송
    await chat.sendMessage(systemMessage);

    // 세션 수 제한: 가장 오래된 세션 정리
    if (liveSessions.size >= MAX_SESSIONS) {
      let oldestId = null, oldestTime = Infinity;
      for (const [id, s] of liveSessions) {
        if (s.createdAt < oldestTime) { oldestTime = s.createdAt; oldestId = id; }
      }
      if (oldestId) deleteSession(oldestId);
    }

    // 세션 저장
    liveSessions.set(sessionId, {
      chat,
      buildingId,
      buildingName: buildingName || null,
      createdAt: Date.now(),
      messageCount: 0,
    });

    // 세션 TTL 설정
    resetSessionTTL(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        buildingId,
        expiresIn: SESSION_TTL / 1000,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gemini/live/audio
 * 텍스트 메시지 전송 (Phase 1: 텍스트, Phase 2: 음성)
 */
router.post('/live/audio', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ success: false, error: 'sessionId와 message는 필수입니다.' });
    }

    const session = liveSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: '세션이 만료되었거나 존재하지 않습니다.' });
    }

    // 세션 사용 시 TTL 리셋
    resetSessionTTL(sessionId);
    session.messageCount++;

    const result = await session.chat.sendMessage(message);
    const responseText = result.response.text();

    // 건물 정보가 포함된 응답이면 flywheel 소싱
    if (session.buildingId && session.messageCount <= 10) {
      const hasInfo = /층|영업|시간|전화|주소|가격|메뉴|입장/.test(message + responseText);
      if (hasInfo) {
        db.query(`
          INSERT INTO sourced_info (building_id, source_type, raw_data, extracted_info, confidence, verified, verified_by)
          VALUES ($1, 'gemini_vision', $2, $3, 0.6, FALSE, NULL)
        `, [
          session.buildingId,
          JSON.stringify({ type: 'live_conversation', question: message, answer: responseText }),
          JSON.stringify({ conversationExtract: true, question: message, answer: responseText }),
        ]).catch(() => {});
      }
    }

    res.json({
      success: true,
      data: {
        response: responseText,
        sessionId,
        messageCount: session.messageCount,
      },
    });
  } catch (err) {
    if (err.message?.includes('quota')) {
      return res.status(429).json({ success: false, error: 'API 할당량 초과' });
    }
    next(err);
  }
});

/**
 * GET /api/gemini/live/stream
 * SSE 스트림으로 실시간 응답 (스트리밍 대화)
 */
router.get('/live/stream', async (req, res, next) => {
  try {
    const { sessionId, message } = req.query;

    if (!sessionId || !message) {
      return res.status(400).json({ success: false, error: 'sessionId와 message는 필수입니다.' });
    }

    const session = liveSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: '세션이 만료되었거나 존재하지 않습니다.' });
    }

    // 세션 사용 시 TTL 리셋
    resetSessionTTL(sessionId);

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    session.messageCount++;

    // 클라이언트 연결 종료 감지
    let clientClosed = false;
    req.on('close', () => { clientClosed = true; });

    const result = await session.chat.sendMessageStream(message);

    let fullResponse = '';

    for await (const chunk of result.stream) {
      if (clientClosed) break;
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    if (!clientClosed) {
      // 완료 이벤트
      res.write(`data: ${JSON.stringify({ type: 'done', fullResponse, messageCount: session.messageCount })}\n\n`);
    }

    // Flywheel 소싱 (정보성 대화인 경우)
    if (session.buildingId && fullResponse.length > 50) {
      db.query(`
        INSERT INTO sourced_info (building_id, source_type, raw_data, confidence, verified)
        VALUES ($1, 'gemini_vision', $2, 0.5, FALSE)
      `, [
        session.buildingId,
        JSON.stringify({ type: 'live_stream', question: message, answer: fullResponse }),
      ]).catch(() => {});
    }

    res.end();
  } catch (err) {
    // SSE 에러 전송
    if (!res.headersSent) {
      return next(err);
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
