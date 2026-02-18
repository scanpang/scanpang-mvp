/**
 * FacilityChips - 편의시설 칩 목록 (가로 스크롤)
 * - 각 칩: 아이콘 + 시설명 + 위치/상태
 * - 둥근 모서리, 반투명 배경
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

/**
 * 편의시설 타입별 아이콘 매핑 (유니코드 이모지)
 */
const FACILITY_ICONS = {
  'ATM': '🏧',
  '주차장': '🅿️',
  '편의점': '🏪',
  '카페': '☕',
  '회의실': '🏢',
  '구내식당': '🍽️',
  '피트니스': '💪',
  '은행': '🏦',
  '영화관': '🎬',
  '수족관': '🐠',
  '서점': '📚',
  '푸드코트': '🍜',
  '전망대': '🔭',
  '호텔': '🏨',
  '쇼핑몰': '🛍️',
  '오피스': '🏢',
  '레지던스': '🏠',
  '식품관': '🥗',
  'VIP라운지': '👑',
  '문화센터': '🎭',
  '와이파이': '📶',
};

/**
 * 편의시설명에서 아이콘 반환
 * @param {string} name - 시설명
 * @returns {string} 아이콘 문자
 */
const getFacilityIcon = (name) => {
  // 정확한 매칭 우선
  if (FACILITY_ICONS[name]) return FACILITY_ICONS[name];

  // 부분 매칭 (시설명에 키워드가 포함된 경우)
  for (const [key, icon] of Object.entries(FACILITY_ICONS)) {
    if (name.includes(key)) return icon;
  }

  // 기본 아이콘
  return '📍';
};

/**
 * 편의시설 데이터를 구조화된 형태로 파싱
 * - 문자열: "ATM 1F로비" → { name: "ATM", detail: "1F로비" }
 * - 객체: { name, detail, icon } 그대로 사용
 */
const parseFacility = (facility) => {
  if (typeof facility === 'string') {
    // 공백으로 분리하여 이름과 상세 정보 추출
    const parts = facility.split(' ');
    return {
      name: parts[0],
      detail: parts.slice(1).join(' ') || null,
    };
  }
  // 객체인 경우 그대로 반환
  return facility;
};

const FacilityChips = ({ facilities = [] }) => {
  if (!facilities || facilities.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {facilities.map((facility, index) => {
        const parsed = parseFacility(facility);
        const icon = parsed.icon || getFacilityIcon(parsed.name);

        return (
          <View key={index} style={styles.chip}>
            {/* 아이콘 */}
            <Text style={styles.chipIcon}>{icon}</Text>

            {/* 시설명 */}
            <Text style={styles.chipName}>{parsed.name}</Text>

            {/* 위치/상태 (있는 경우만) */}
            {parsed.detail && (
              <Text style={styles.chipDetail}>{parsed.detail}</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    marginBottom: SPACING.md,
    maxHeight: 36,
  },
  contentContainer: {
    gap: SPACING.sm,
    paddingHorizontal: 1,
  },

  // 개별 칩
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },

  // 아이콘
  chipIcon: {
    fontSize: 12,
  },

  // 시설명
  chipName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // 위치/상태 정보
  chipDetail: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
});

export default FacilityChips;
