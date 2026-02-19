/**
 * FlywheelDashboardScreen - 자동 DB 구축 파이프라인 대시보드
 *
 * 표시 항목:
 * - 총 소싱 건수, 검증률, 커버리지
 * - 소스별 분포 (Gemini Vision / User Report / Public API)
 * - 최근 24시간 활동
 * - 검증 대기 목록 미리보기
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
import { getFlywheelStats, getFlywheelPending } from '../services/api';

// 통계 카드
const StatCard = ({ label, value, subValue, color = Colors.primaryBlue }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subValue != null && <Text style={styles.statSub}>{subValue}</Text>}
  </View>
);

// 소스별 분포 바
const SourceBar = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.sourceRow}>
      <View style={[styles.sourceDot, { backgroundColor: color }]} />
      <Text style={styles.sourceLabel}>{label}</Text>
      <View style={styles.sourceBarOuter}>
        <View style={[styles.sourceBarInner, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.sourceCount}>{count}</Text>
      <Text style={styles.sourcePct}>{pct}%</Text>
    </View>
  );
};

// 대기 항목
const PendingItem = ({ item }) => (
  <View style={styles.pendingItem}>
    <View style={styles.pendingLeft}>
      <Text style={styles.pendingBuilding} numberOfLines={1}>{item.buildingName || `건물 #${item.buildingId}`}</Text>
      <Text style={styles.pendingSource}>{item.sourceType === 'gemini_vision' ? 'Gemini' : item.sourceType === 'user_report' ? '유저' : 'API'}</Text>
    </View>
    <View style={styles.pendingRight}>
      <Text style={styles.pendingConfidence}>
        {item.confidence ? `${Math.round(item.confidence * 100)}%` : '-'}
      </Text>
    </View>
  </View>
);

const FlywheelDashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        getFlywheelStats(),
        getFlywheelPending(5, 0),
      ]);
      setStats(statsRes?.data || statsRes);
      setPending(pendingRes?.data?.items || []);
    } catch {
      // 에러 무시
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.centerView}>
        <ActivityIndicator size="large" color={Colors.primaryBlue} />
        <Text style={styles.loadingText}>대시보드 로딩 중...</Text>
      </View>
    );
  }

  const s = stats || {};
  const total = s.totalSourced || 0;
  const breakdown = s.sourceBreakdown || {};

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
          <Text style={styles.headerName}>Flywheel Dashboard</Text>
          <Text style={styles.headerSub}>자동 DB 구축 현황</Text>
        </View>
      </View>

      {/* 핵심 통계 */}
      <View style={styles.statsGrid}>
        <StatCard label="총 소싱" value={total} color={Colors.primaryBlue} />
        <StatCard label="검증률" value={`${s.verificationRate || 0}%`} color={Colors.successGreen} />
        <StatCard label="커버리지" value={`${s.buildingsCovered || 0}개`} subValue="건물" color={Colors.accentAmber} />
        <StatCard label="24h 활동" value={s.last24hSourcing || 0} color="#8B5CF6" />
      </View>

      {/* 검증 현황 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>검증 현황</Text>
        <View style={styles.verificationRow}>
          <View style={styles.verificationItem}>
            <Text style={[styles.verificationValue, { color: Colors.successGreen }]}>{s.verifiedCount || 0}</Text>
            <Text style={styles.verificationLabel}>검증 완료</Text>
          </View>
          <View style={styles.verificationDivider} />
          <View style={styles.verificationItem}>
            <Text style={[styles.verificationValue, { color: Colors.accentAmber }]}>{s.pendingCount || 0}</Text>
            <Text style={styles.verificationLabel}>대기 중</Text>
          </View>
          <View style={styles.verificationDivider} />
          <View style={styles.verificationItem}>
            <Text style={[styles.verificationValue, { color: Colors.primaryBlue }]}>{s.totalProfiles || 0}</Text>
            <Text style={styles.verificationLabel}>프로필</Text>
          </View>
        </View>
      </View>

      {/* 소스별 분포 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>소스별 분포</Text>
        <Text style={styles.sectionSub}>데이터가 어디서 수집되었는지</Text>
        <SourceBar label="Gemini Vision" count={breakdown.geminiVision || 0} total={total} color={Colors.primaryBlue} />
        <SourceBar label="유저 리포트" count={breakdown.userReport || 0} total={total} color={Colors.accentAmber} />
        <SourceBar label="Public API" count={breakdown.publicApi || 0} total={total} color={Colors.successGreen} />
      </View>

      {/* 평균 신뢰도 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>데이터 품질</Text>
        <View style={styles.qualityRow}>
          <View style={styles.qualityCircle}>
            <Text style={styles.qualityValue}>{Math.round((s.avgConfidence || 0) * 100)}</Text>
            <Text style={styles.qualityUnit}>%</Text>
          </View>
          <View style={styles.qualityInfo}>
            <Text style={styles.qualityLabel}>평균 신뢰도</Text>
            <Text style={styles.qualityDesc}>
              {(s.avgConfidence || 0) >= 0.8 ? '높은 품질의 데이터가 수집되고 있습니다.' :
               (s.avgConfidence || 0) >= 0.5 ? '양호한 수준입니다. Gemini 분석으로 품질을 높일 수 있습니다.' :
               '더 많은 데이터 수집이 필요합니다.'}
            </Text>
          </View>
        </View>
      </View>

      {/* 검증 대기 목록 미리보기 */}
      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>검증 대기 항목</Text>
          {pending.map((item, i) => (
            <PendingItem key={item.id || i} item={item} />
          ))}
        </View>
      )}

      {/* 인사이트 */}
      <View style={styles.insightSection}>
        <Text style={styles.insightTitle}>Flywheel 인사이트</Text>
        <Text style={styles.insightText}>
          {total === 0
            ? '아직 소싱된 데이터가 없습니다. 건물을 스캔하면 자동으로 Gemini Vision이 분석하여 DB를 강화합니다.'
            : total < 10
            ? `${total}건의 데이터가 수집되었습니다. 더 많은 스캔으로 플라이휠을 가속할 수 있습니다.`
            : `${total}건 소싱, ${s.buildingsCovered || 0}개 건물 커버. Gemini Vision이 ${breakdown.geminiVision || 0}건을 자동 분석했습니다.`}
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
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  statSub: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  // 섹션
  section: { backgroundColor: '#FFF', marginTop: SPACING.sm, marginHorizontal: SPACING.md, borderRadius: 16, padding: SPACING.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: SPACING.xs },
  sectionSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: SPACING.md },

  // 검증 현황
  verificationRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  verificationItem: { flex: 1, alignItems: 'center' },
  verificationValue: { fontSize: 22, fontWeight: '800' },
  verificationLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  verificationDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },

  // 소스별 분포
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, gap: SPACING.sm },
  sourceDot: { width: 10, height: 10, borderRadius: 5 },
  sourceLabel: { fontSize: 13, color: Colors.textPrimary, width: 90 },
  sourceBarOuter: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  sourceBarInner: { height: '100%', borderRadius: 4 },
  sourceCount: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, width: 30, textAlign: 'right' },
  sourcePct: { fontSize: 11, color: Colors.textSecondary, width: 30, textAlign: 'right' },

  // 데이터 품질
  qualityRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.lg },
  qualityCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: Colors.primaryBlue, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  qualityValue: { fontSize: 22, fontWeight: '800', color: Colors.primaryBlue },
  qualityUnit: { fontSize: 12, fontWeight: '600', color: Colors.primaryBlue, marginTop: 4 },
  qualityInfo: { flex: 1 },
  qualityLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  qualityDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // 대기 목록
  pendingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pendingLeft: { flex: 1 },
  pendingBuilding: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  pendingSource: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pendingRight: { alignItems: 'flex-end' },
  pendingConfidence: { fontSize: 14, fontWeight: '700', color: Colors.accentAmber },

  // 인사이트
  insightSection: { backgroundColor: '#EFF6FF', marginTop: SPACING.sm, marginHorizontal: SPACING.md, borderRadius: 16, padding: SPACING.lg, borderWidth: 1, borderColor: '#BFDBFE' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryBlue, marginBottom: SPACING.xs },
  insightText: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },
});

export default FlywheelDashboardScreen;
