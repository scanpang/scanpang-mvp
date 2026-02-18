/**
 * HomeScreen - 모드 선택 화면
 * - 섹션별 stagger 입장 애니메이션 (120ms 간격)
 * - 모드 카드 press scale 애니메이션 (0.96)
 * - 이모지 → 스타일드 텍스트 아이콘
 * - 스탯 카운트업 애니메이션
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Animated,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, CARD_STYLE, SHADOW, ANIMATION } from '../constants/theme';
import { DUMMY_POINTS } from '../constants/dummyData';

/**
 * 카운트업 애니메이션 숫자 컴포넌트
 */
class AnimatedStatNumber extends React.Component {
  constructor(props) {
    super(props);
    this.animValue = new Animated.Value(0);
    this.state = { display: '0' };
  }

  componentDidMount() {
    this._listenerId = this.animValue.addListener(({ value }) => {
      this.setState({ display: Math.round(value).toLocaleString() });
    });

    Animated.timing(this.animValue, {
      toValue: this.props.value,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }

  componentWillUnmount() {
    this.animValue.removeListener(this._listenerId);
  }

  render() {
    return (
      <Text style={this.props.style}>{this.state.display}</Text>
    );
  }
}

/**
 * Press scale 래퍼 컴포넌트
 */
const PressableCard = ({ children, onPress, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }) => {
  // stagger 입장 애니메이션
  const headerAnim = useRef(new Animated.Value(0)).current;
  const welcomeAnim = useRef(new Animated.Value(0)).current;
  const modeAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const staggerDelay = ANIMATION.stagger.slow;
    const animations = [headerAnim, welcomeAnim, modeAnim, statsAnim];

    animations.forEach((anim, index) => {
      setTimeout(() => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }).start();
      }, index * staggerDelay);
    });
  }, []);

  const createStaggerStyle = (anim) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    }],
  });

  // 스캔 모드 선택 후 ScanScreen으로 이동
  const handleModeSelect = (mode) => {
    navigation.navigate('Scan', { mode });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* 상단 헤더 */}
      <Animated.View style={[styles.header, createStaggerStyle(headerAnim)]}>
        <Text style={styles.logo}>ScanPang</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsIcon}>P</Text>
          <Text style={styles.pointsText}>{DUMMY_POINTS.totalPoints.toLocaleString()}</Text>
        </View>
      </Animated.View>

      {/* 환영 메시지 */}
      <Animated.View style={[styles.welcomeSection, createStaggerStyle(welcomeAnim)]}>
        <Text style={styles.welcomeTitle}>건물을 스캔하세요</Text>
        <Text style={styles.welcomeSubtitle}>
          카메라를 건물에 비추면{'\n'}내부 정보를 확인할 수 있습니다
        </Text>
      </Animated.View>

      {/* 모드 선택 카드 */}
      <Animated.View style={[styles.modeSection, createStaggerStyle(modeAnim)]}>
        {/* 일반 모드 카드 */}
        <PressableCard
          style={styles.modeCard}
          onPress={() => handleModeSelect('normal')}
        >
          <View style={[styles.modeIconContainer, { backgroundColor: COLORS.blueTint }]}>
            <Text style={[styles.modeIcon, { color: COLORS.blue }]}>SCAN</Text>
          </View>
          <Text style={styles.modeTitle}>일반 모드</Text>
          <Text style={styles.modeDescription}>
            건물을 스캔하여 기본 정보를{'\n'}확인합니다
          </Text>
          <View style={[styles.modeTag, { backgroundColor: COLORS.blueTint }]}>
            <Text style={[styles.modeTagText, { color: COLORS.blue }]}>기본</Text>
          </View>
        </PressableCard>

        {/* 투시 모드 카드 */}
        <PressableCard
          style={styles.modeCard}
          onPress={() => handleModeSelect('xray')}
        >
          <View style={[styles.modeIconContainer, { backgroundColor: COLORS.orangeTint }]}>
            <Text style={[styles.modeIcon, { color: COLORS.orange }]}>XRAY</Text>
          </View>
          <Text style={styles.modeTitle}>투시 모드</Text>
          <Text style={styles.modeDescription}>
            건물 내부 층별 상세 정보를{'\n'}AR로 확인합니다
          </Text>
          <View style={[styles.modeTag, { backgroundColor: COLORS.orangeTint }]}>
            <Text style={[styles.modeTagText, { color: COLORS.orange }]}>프리미엄</Text>
          </View>
        </PressableCard>
      </Animated.View>

      {/* 오늘의 통계 (카운트업 애니메이션) */}
      <Animated.View style={[styles.statsSection, createStaggerStyle(statsAnim)]}>
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <AnimatedStatNumber value={DUMMY_POINTS.scanCount} style={styles.statsValue} />
              <Text style={styles.statsLabel}>오늘 스캔</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <AnimatedStatNumber value={DUMMY_POINTS.todayEarned} style={styles.statsValue} />
              <Text style={styles.statsLabel}>획득 포인트</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <AnimatedStatNumber value={DUMMY_POINTS.dailyLimit - DUMMY_POINTS.todayEarned} style={styles.statsValue} />
              <Text style={styles.statsLabel}>남은 한도</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // 헤더 영역
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orangeTint,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 20,
  },
  pointsIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.orange,
    marginRight: SPACING.xs,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.orange,
  },
  // 환영 메시지
  welcomeSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  welcomeTitle: {
    ...TYPOGRAPHY.h1,
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  // 모드 선택 카드
  modeSection: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  modeCard: {
    flex: 1,
    ...CARD_STYLE,
    padding: SPACING.lg,
    ...SHADOW.medium,
  },
  modeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modeIcon: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modeTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.xs,
  },
  modeDescription: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  modeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  modeTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // 오늘의 통계
  statsSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    marginTop: 'auto',
    paddingBottom: SPACING.xxl,
  },
  statsCard: {
    ...CARD_STYLE,
    padding: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  statsLabel: {
    ...TYPOGRAPHY.caption,
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
});

export default HomeScreen;
