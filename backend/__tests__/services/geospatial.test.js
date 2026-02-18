/**
 * Geospatial 서비스 테스트
 * - angleDifference 유틸 함수 테스트 (DB 불필요)
 */
jest.mock('../../src/db');

const { angleDifference } = require('../../src/services/geospatial');

describe('angleDifference', () => {
  it('같은 각도는 차이 0', () => {
    expect(angleDifference(0, 0)).toBe(0);
    expect(angleDifference(180, 180)).toBe(0);
    expect(angleDifference(359, 359)).toBe(0);
  });

  it('정반대 방향은 180', () => {
    expect(angleDifference(0, 180)).toBe(180);
    expect(angleDifference(90, 270)).toBe(180);
  });

  it('순환 경계 처리 (0도와 350도는 10도 차이)', () => {
    expect(angleDifference(0, 350)).toBe(10);
    expect(angleDifference(350, 0)).toBe(10);
  });

  it('90도 차이 계산', () => {
    expect(angleDifference(0, 90)).toBe(90);
    expect(angleDifference(270, 0)).toBe(90);
  });

  it('AR 시야 필터 시나리오 (전방 60도 이내)', () => {
    const heading = 45;
    expect(angleDifference(heading, 30)).toBeLessThanOrEqual(60);
    expect(angleDifference(heading, 60)).toBeLessThanOrEqual(60);
    expect(angleDifference(heading, 105)).toBeLessThanOrEqual(60);
    expect(angleDifference(heading, 106)).toBeGreaterThan(60);
  });
});
