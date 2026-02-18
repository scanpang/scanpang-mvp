/**
 * FacilityChips - 편의시설 칩 목록 (가로 스크롤)
 * - 이모지 → 컬러 텍스트 아이콘 (디바이스 간 일관성)
 * - pill 형태 (borderRadius 20)
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
 * 편의시설 타입별 텍스트 아이콘 + 색상 매핑
 */
const FACILITY_ICONS = {
  'ATM':       { icon: 'ATM', color: '#4CAF50' },
  '주차장':    { icon: 'P',   color: '#2196F3' },
  '편의점':    { icon: 'CVS', color: '#FF9800' },
  '카페':      { icon: 'C',   color: '#795548' },
  '회의실':    { icon: 'MT',  color: '#607D8B' },
  '구내식당':  { icon: 'F',   color: '#FF5722' },
  '피트니스':  { icon: 'GYM', color: '#E91E63' },
  '은행':      { icon: 'BK',  color: '#3F51B5' },
  '영화관':    { icon: 'MOV', color: '#9C27B0' },
  '수족관':    { icon: 'AQ',  color: '#00BCD4' },
  '서점':      { icon: 'BK',  color: '#8BC34A' },
  '푸드코트':  { icon: 'FC',  color: '#FF5722' },
  '전망대':    { icon: 'VW',  color: '#03A9F4' },
  '호텔':      { icon: 'H',   color: '#FF9800' },
  '쇼핑몰':    { icon: 'SH',  color: '#E91E63' },
  '오피스':    { icon: 'OF',  color: '#607D8B' },
  '레지던스':  { icon: 'RS',  color: '#795548' },
  '식품관':    { icon: 'GR',  color: '#4CAF50' },
  'VIP라운지': { icon: 'VIP', color: '#FFC107' },
  '문화센터':  { icon: 'CC',  color: '#9C27B0' },
  '와이파이':  { icon: 'WiFi', color: '#2196F3' },
};

/**
 * 편의시설명에서 텍스트 아이콘 + 색상 반환
 */
const getFacilityIcon = (name) => {
  if (FACILITY_ICONS[name]) return FACILITY_ICONS[name];

  for (const [key, config] of Object.entries(FACILITY_ICONS)) {
    if (name.includes(key)) return config;
  }

  return { icon: '#', color: COLORS.textSecondary };
};

/**
 * 편의시설 데이터를 구조화된 형태로 파싱
 */
const parseFacility = (facility) => {
  if (typeof facility === 'string') {
    const parts = facility.split(' ');
    return {
      name: parts[0],
      detail: parts.slice(1).join(' ') || null,
    };
  }
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
        const { icon, color } = getFacilityIcon(parsed.name);

        return (
          <View key={index} style={styles.chip}>
            {/* 텍스트 아이콘 */}
            <Text style={[styles.chipIcon, { color }]}>{icon}</Text>

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

  // 개별 칩 (pill 형태)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },

  // 텍스트 아이콘
  chipIcon: {
    fontSize: 10,
    fontWeight: '800',
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
