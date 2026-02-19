/**
 * BehaviorReportScreen - 건물별 행동 데이터 리포트
 *
 * 표시 항목:
 * - Summary: 총 이벤트, 세션 수, 평균 시선시간, 전환율
 * - 시간대별 관심도 분포 (24시간 바 차트)
 * - 일별 트렌드 (7일)
 * - 인터랙션 breakdown (gaze, pin_click, card_open, entered)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Colors, SPACING } from '../constants/theme';
import { getBehaviorReport } from '../services/api';

// 간단한 바 차트 컴포넌트
const BarChart = ({ data, maxValue, labelKey, valueKey, color = Colors.primaryBlue }) => {
  const max = maxValue || Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <View style={styles.chartContainer}>
      {data.map((item, i) => (
        <View key={i} style={styles.chartBarWrapper}>
          <View style={styles.chartBarOuter}>
            <View style={[styles.chartBarInner, {
              height: `${Math.max((item[valueKey] / max) * 100, 2)}%`,
              backgroundColor: color,
            }]} />
          </View>
          <Text style={styles.chartLabel}>{item[labelKey]}</Text>
        </View>
      ))}
    </View>
  );
};

// 통계 카드
const StatCard = ({ icon, label, value, subValue, color = Colors.primaryBlue }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.statIcon, { color }]}>{icon}</Text>
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subValue && <Text style={styles.statSub}>{subValue}</Text>}
  </View>
);

// 인터랙션 행
const InteractionRow = ({ label, count, total, icon, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.interactionRow}>
      <Text style={styles.interactionIcon}>{icon}</Text>
      <Text style={styles.interactionLabel}>{label}</Text>
      <View style={styles.interactionBarOuter}>
        <View style={[styles.interactionBarInner, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.interactionCount}>{count}</Text>
    </View>
  );
};

const BehaviorReportScreen = ({ route, navigation }) => {
  const { buildingId, buildingName } = route?.params || {};
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!buildingId) return;
    try {
      setError(null);
      const res = await getBehaviorReport(buildingId);
      const data = res?.data || res;
      setReport(data);
    } catch (err) {
      setError('리포트를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildingId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <View style={styles.centerView}>
        <ActivityIndicator size="large" color={Colors.primaryBlue} />
        <Text style={styles.loadingText}>리포트 로딩 중...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centerView}>
        <Text style={styles.errorIcon}>📊</Text>
        <Text style={styles.errorText}>{error || '데이터가 없습니다.'}</Text>
        <Text style={styles.errorSub}>이 건물의 스캔 데이터가 아직 수집되지 않았습니다.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = report.summary || {};
  const hourly = report.hourlyDistribution || [];
  const daily = report.dailyTrend || [];

  // 시간대별 데이터를 24시간으로 패딩
  const fullHourly = Array.from({ length: 24 }, (_, h) => {
    const found = hourly.find(d => d.hour === h);
    return { hour: h < 10 ? `0${h}` : `${h}`, count: found?.count || 0 };
  });
  // 주요 시간대만 표시 (6시~23시)
  const visibleHourly = fullHourly.filter(d => {
    const h = parseInt(d.hour);
    return h >= 6 && h <= 23;
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryBlue} />}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerName} numberOfLines={1}>{buildingName || `건물 #${buildingId}`}</Text>
          <Text style={styles.headerSub}>행동 분석 리포트</Text>
        </View>
      </View>

      {/* Summary 카드 */}
      <View style={styles.statsGrid}>
        <StatCard icon="👁" label="총 관심" value={s.gazeCount || 0} subValue="gaze events" color={Colors.primaryBlue} />
        <StatCard icon="⏱" label="평균 시선" value={`${((s.avgGazeDurationMs || 0) / 1000).toFixed(1)}s`} color={Colors.accentAmber} />
        <StatCard icon="👆" label="탭" value={s.pinClicks || 0} subValue="pin clicks" color="#8B5CF6" />
        <StatCard icon="🚶" label="전환율" value={`${s.conversionRate || 0}%`} subValue="gaze→entry" color={Colors.successGreen} />
      </View>

      {/* 세션 요약 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>세션 요약</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{s.uniqueSessions || 0}</Text>
            <Text style={styles.summaryLabel}>유니크 세션</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{s.totalEvents || 0}</Text>
            <Text style={styles.summaryLabel}>총 이벤트</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{s.cardOpens || 0}</Text>
            <Text style={styles.summaryLabel}>카드 열람</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{s.entries || 0}</Text>
            <Text style={styles.summaryLabel}>입장</Text>
          </View>
        </View>
      </View>

      {/* 인터랙션 분해 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>인터랙션 분석</Text>
        <InteractionRow label="시선 (Gaze)" count={s.gazeCount || 0} total={s.totalEvents || 1} icon="👁" color={Colors.primaryBlue} />
        <InteractionRow label="핀 탭" count={s.pinClicks || 0} total={s.totalEvents || 1} icon="👆" color="#8B5CF6" />
        <InteractionRow label="카드 열람" count={s.cardOpens || 0} total={s.totalEvents || 1} icon="📋" color={Colors.accentAmber} />
        <InteractionRow label="입장" count={s.entries || 0} total={s.totalEvents || 1} icon="🚶" color={Colors.successGreen} />
        <InteractionRow label="통과" count={s.passBys || 0} total={s.totalEvents || 1} icon="➡️" color="#6B7280" />
      </View>

      {/* 시간대별 관심도 */}
      {visibleHourly.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시간대별 관심도</Text>
          <Text style={styles.sectionSub}>어떤 시간대에 가장 많은 관심을 받는지</Text>
          <BarChart data={visibleHourly} labelKey="hour" valueKey="count" color={Colors.primaryBlue} />
        </View>
      )}

      {/* 일별 트렌드 */}
      {daily.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 7일 트렌드</Text>
          <BarChart
            data={daily.map(d => ({ ...d, label: d.date?.slice(5) || '' }))}
            labelKey="label"
            valueKey="events"
            color={Colors.successGreen}
          />
        </View>
      )}

      {/* ScanPang 인사이트 */}
      <View style={styles.insightSection}>
        <Text style={styles.insightTitle}>ScanPang 인사이트</Text>
        <Text style={styles.insightText}>
          {s.conversionRate >= 10
            ? `이 건물은 전환율 ${s.conversionRate}%로 높은 진입율을 보입니다. 주요 관심 시간대에 프로모션을 집중하면 효과적입니다.`
            : s.gazeCount >= 5
            ? `시선 ${s.gazeCount}회 중 ${s.entries || 0}회 입장으로 전환율 개선 여지가 있습니다. 외관 개선이나 입구 가시성 향상을 고려해보세요.`
            : '아직 충분한 데이터가 수집되지 않았습니다. 더 많은 스캔이 필요합니다.'}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.md, color: Colors.textSecondary, fontSize: 14 },
  errorIcon: { fontSize: 48, marginBottom: SPACING.md },
  errorText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: SPACING.xs },
  errorSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: SPACING.xl },
  retryBtn: { backgroundColor: Colors.primaryBlue, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },

  // 헤더
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  backBtnText: { fontSize: 24, color: Colors.textPrimary, marginTop: -2 },
  headerTitle: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // 통계 그리드
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.md, gap: SPACING.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', borderRadius: 16, padding: SPACING.md, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statSub: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  // 섹션
  section: { backgroundColor: '#FFF', marginTop: SPACING.sm, marginHorizontal: SPACING.md, borderRadius: 16, padding: SPACING.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: SPACING.xs },
  sectionSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: SPACING.md },

  // 세션 요약
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },

  // 인터랙션
  interactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, gap: SPACING.sm },
  interactionIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  interactionLabel: { fontSize: 13, color: Colors.textPrimary, width: 72 },
  interactionBarOuter: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  interactionBarInner: { height: '100%', borderRadius: 4 },
  interactionCount: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, width: 36, textAlign: 'right' },

  // 바 차트
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2, marginTop: SPACING.sm },
  chartBarWrapper: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartBarOuter: { width: '80%', flex: 1, justifyContent: 'flex-end' },
  chartBarInner: { width: '100%', borderRadius: 3, minHeight: 2 },
  chartLabel: { fontSize: 9, color: Colors.textTertiary, marginTop: 4 },

  // 인사이트
  insightSection: { backgroundColor: '#EFF6FF', marginTop: SPACING.sm, marginHorizontal: SPACING.md, borderRadius: 16, padding: SPACING.lg, borderWidth: 1, borderColor: '#BFDBFE' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryBlue, marginBottom: SPACING.xs },
  insightText: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },
});

export default BehaviorReportScreen;
