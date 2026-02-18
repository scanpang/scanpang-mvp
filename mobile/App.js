/**
 * ScanPang - 앱 엔트리 포인트
 * - NavigationContainer + Stack Navigator 설정
 * - HomeScreen, ScanScreen 라우트 등록
 */

// react-native-gesture-handler는 반드시 최상단에서 import
import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar, View, Text, ScrollView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// 화면 컴포넌트
import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';

// 테마 상수
import { COLORS } from './src/constants/theme';

// Stack Navigator 생성
const Stack = createStackNavigator();

/**
 * ErrorBoundary - 런타임 에러 발생 시 에러 내용을 화면에 표시
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
          <Text style={errorStyles.title}>앱 에러 발생</Text>
          <ScrollView style={errorStyles.scroll}>
            <Text style={errorStyles.message}>
              {this.state.error?.toString()}
            </Text>
            <Text style={errorStyles.stack}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E27', padding: 24, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '700', color: '#FF5252', marginBottom: 16 },
  scroll: { flex: 1 },
  message: { fontSize: 14, color: '#FFFFFF', marginBottom: 12 },
  stack: { fontSize: 11, color: '#9E9E9E', lineHeight: 18 },
});

/**
 * 네비게이션 다크 테마 설정
 * - React Navigation의 기본 테마를 ScanPang 다크 테마에 맞춤
 */
const navigationTheme = {
  dark: true,
  colors: {
    primary: COLORS.blue,
    background: COLORS.background,
    card: COLORS.background,
    text: COLORS.textPrimary,
    border: COLORS.border,
    notification: COLORS.orange,
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
          translucent={false}
        />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            cardStyle: {
              backgroundColor: COLORS.background,
            },
            gestureEnabled: true,
            cardStyleInterpolator: ({ current: { progress } }) => ({
              cardStyle: {
                opacity: progress,
              },
            }),
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'ScanPang' }}
          />
          <Stack.Screen
            name="Scan"
            component={ScanScreen}
            options={{ title: '스캔', gestureEnabled: true }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
