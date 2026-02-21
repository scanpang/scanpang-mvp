/**
 * ScanPang - 앱 엔트리 포인트 (리디자인)
 * - Home → ScanCamera 통합 플로우
 * - 화이트 홈 + 다크 카메라 테마
 */

// react-native-gesture-handler는 반드시 최상단에서 import
import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar, View, Text, ScrollView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 화면 컴포넌트
import HomeScreen from './src/screens/HomeScreen';
import ScanCameraScreen from './src/screens/ScanCameraScreen';
import BehaviorReportScreen from './src/screens/BehaviorReportScreen';
import FlywheelDashboardScreen from './src/screens/FlywheelDashboardScreen';
import NearbyBuildingsScreen from './src/screens/NearbyBuildingsScreen';

import { Colors } from './src/constants/theme';

const Stack = createStackNavigator();

/**
 * ErrorBoundary - 런타임 에러 시 사용자 친화적 메시지
 */
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>오류가 발생했습니다</Text>
          <Text style={errorStyles.message}>앱을 다시 시작해주세요.</Text>
          <ScrollView style={errorStyles.scroll}>
            <Text style={errorStyles.stack}>
              {this.state.error?.toString()}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 24, paddingTop: 60, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  message: { fontSize: 15, color: Colors.textSecondary, marginBottom: 24 },
  scroll: { maxHeight: 200 },
  stack: { fontSize: 11, color: Colors.textTertiary, lineHeight: 18 },
});

/**
 * 네비게이션 라이트 테마
 */
const navigationTheme = {
  dark: false,
  colors: {
    primary: Colors.primaryBlue,
    background: Colors.bgWhite,
    card: Colors.bgWhite,
    text: Colors.textPrimary,
    border: Colors.borderLight,
    notification: Colors.accentAmber,
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'ScanPang' }}
          />
          <Stack.Screen
            name="ScanCamera"
            component={ScanCameraScreen}
            options={{
              title: '스캔',
              gestureEnabled: true,
              cardStyleInterpolator: ({ current: { progress } }) => ({
                cardStyle: { opacity: progress },
              }),
            }}
          />
          <Stack.Screen
            name="BehaviorReport"
            component={BehaviorReportScreen}
            options={{
              title: '행동 리포트',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="NearbyBuildings"
            component={NearbyBuildingsScreen}
            options={{
              title: '주변 건물',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="FlywheelDashboard"
            component={FlywheelDashboardScreen}
            options={{
              title: 'Flywheel',
              gestureEnabled: true,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
