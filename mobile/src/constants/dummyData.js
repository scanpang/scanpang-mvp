/**
 * ScanPang 더미 데이터 (v2 — 최소화)
 * - 실제 API 데이터로 전환 완료
 * - 포인트 시스템 / 라이브 피드만 유지 (UI 테스트용)
 */

// 포인트 시스템 더미 데이터
export const DUMMY_POINTS = {
  totalPoints: 1200,
  pointsPerScan: 50,
  dailyLimit: 500,
  todayEarned: 250,
  scanCount: 5,
};

// 실시간 피드 더미 데이터 (건물별)
export const DUMMY_LIVE_FEEDS = [
  {
    id: 'feed_001',
    buildingId: 'bld_001',
    type: 'event',
    title: '1층 스타벅스 신메뉴 출시',
    description: '시즌 한정 딸기 라떼가 출시되었습니다. 오늘부터 주문 가능!',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isLive: true,
  },
  {
    id: 'feed_002',
    buildingId: 'bld_001',
    type: 'alert',
    title: '엘리베이터 점검 안내',
    description: '2번 엘리베이터가 오후 2시~4시 점검 예정입니다.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isLive: false,
  },
];

/**
 * 특정 건물의 라이브 피드를 필터링하는 헬퍼 함수
 * @param {string} buildingId - 건물 ID
 * @returns {Array} 해당 건물의 라이브 피드 목록
 */
export const getLiveFeedsByBuilding = (buildingId) => {
  return DUMMY_LIVE_FEEDS.filter((feed) => feed.buildingId === buildingId);
};

export default {
  DUMMY_POINTS,
  DUMMY_LIVE_FEEDS,
  getLiveFeedsByBuilding,
};
