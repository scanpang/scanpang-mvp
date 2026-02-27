/**
 * PersonaSelectModal — 페르소나 선택 팝업
 * - 온보딩 모드: HomeScreen 진입 전 1회
 * - 변경 모드: HUD 칩 탭 시 재표시
 * - 2x3 그리드, 컴팩트 다크 테마
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SPACING } from '../constants/theme';
import { PERSONA_LIST, PersonaType, savePersona } from '../data/persona';

const PersonaSelectModal = ({ visible, onSelect, onClose, isOnboarding = false }) => {
  const [selected, setSelected] = useState(null);

  const handleConfirm = async () => {
    const type = selected || PersonaType.EXPLORER;
    await savePersona(type);
    onSelect(type);
    setSelected(null);
  };

  const handleSkip = async () => {
    await savePersona(PersonaType.EXPLORER);
    onSelect(PersonaType.EXPLORER);
    setSelected(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isOnboarding ? undefined : onClose}
    >
      <View style={s.overlay}>
        <View style={s.container}>
          {/* 헤더 */}
          <Text style={s.headerTitle}>🔍 ScanPang</Text>
          <Text style={s.headerSub}>어떤 정보가 가장 궁금하세요?</Text>

          {/* 2x3 그리드 */}
          <View style={s.grid}>
            {PERSONA_LIST.map((p) => {
              const isActive = selected === p.type;
              return (
                <TouchableOpacity
                  key={p.type}
                  style={[s.card, isActive && s.cardActive]}
                  onPress={() => setSelected(p.type)}
                  activeOpacity={0.7}
                >
                  {isActive && <Text style={s.check}>✓</Text>}
                  <Text style={s.cardEmoji}>{p.emoji}</Text>
                  <Text style={s.cardName}>{p.nameKo}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 확인 버튼 */}
          {selected && (
            <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <Text style={s.confirmText}>선택 완료</Text>
            </TouchableOpacity>
          )}

          {/* 나중에 선택 */}
          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={s.skipText}>나중에 선택할게요</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const CARD_GAP = 10;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  container: {
    width: '100%',
    backgroundColor: '#0A0A0F',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // 헤더
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#F1F5F9', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16 },

  // 그리드
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: CARD_GAP,
    width: '100%',
    marginBottom: 14,
  },
  card: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 4,
  },
  cardActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: 'rgba(139,92,246,0.4)',
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#A78BFA',
  },
  cardEmoji: { fontSize: 22 },
  cardName: { fontSize: 10, fontWeight: '700', color: '#F1F5F9' },

  // 확인 버튼
  confirmBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 나중에
  skipBtn: { paddingVertical: 6 },
  skipText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
});

export default PersonaSelectModal;
