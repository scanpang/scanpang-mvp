/**
 * GeminiLiveChat - 건물 AI 대화 컴포넌트
 * 바텀시트 내에서 사용, Gemini Live API 연동
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, SPACING } from '../constants/theme';
import { startGeminiLive, sendGeminiMessage } from '../services/api';

const QUICK_QUESTIONS = [
  '이 건물은 뭐하는 곳이야?',
  '영업시간 알려줘',
  '주변에 맛집 있어?',
  '몇 층이야?',
];

const GeminiLiveChat = ({ buildingId, buildingName, buildingInfo, lat, lng }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const scrollRef = useRef(null);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    setInitializing(true);
    try {
      const res = await startGeminiLive({ buildingId, buildingName, buildingInfo, lat, lng });
      const id = res?.data?.sessionId;
      if (id) {
        setSessionId(id);
        return id;
      }
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: 'AI 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' }]);
    } finally {
      setInitializing(false);
    }
    return null;
  }, [sessionId, buildingId, buildingName, buildingInfo, lat, lng]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const sid = await ensureSession();
      if (!sid) { setLoading(false); return; }

      const res = await sendGeminiMessage(sid, text.trim());
      const aiText = res?.data?.response || '응답을 받지 못했습니다.';
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: '응답 실패. 다시 시도해주세요.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
    }
  }, [loading, ensureSession]);

  const handleQuickQuestion = useCallback((q) => {
    sendMessage(q);
  }, [sendMessage]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
        <Text style={styles.headerTitle}>ScanPang AI</Text>
        {sessionId && <View style={styles.connectedDot} />}
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {buildingName ? `${buildingName}에 대해 물어보세요` : 'AI에게 건물 정보를 물어보세요'}
          </Text>
          <View style={styles.quickQuestions}>
            {QUICK_QUESTIONS.map((q, i) => (
              <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => handleQuickQuestion(q)}>
                <Text style={styles.quickBtnText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
        >
          {messages.map((msg, i) => (
            <View key={i} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : msg.role === 'system' ? styles.systemBubble : styles.aiBubble]}>
              {msg.role === 'ai' && <Text style={styles.aiLabel}>AI</Text>}
              <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : msg.role === 'system' ? styles.systemText : styles.aiText]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color={Colors.primaryBlue} />
            </View>
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="질문을 입력하세요..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            editable={!loading && !initializing}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
          >
            <Text style={styles.sendBtnText}>{loading ? '...' : '>'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: SPACING.md },

  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  aiBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryBlue, justifyContent: 'center', alignItems: 'center' },
  aiBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.successGreen },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.md },
  emptyTitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: SPACING.md, textAlign: 'center' },
  quickQuestions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, justifyContent: 'center' },
  quickBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  quickBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  messageList: { maxHeight: 200, marginBottom: SPACING.sm },
  messageBubble: { marginBottom: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 14, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primaryBlue },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)' },
  systemBubble: { alignSelf: 'center', backgroundColor: 'rgba(239,68,68,0.15)' },
  aiLabel: { fontSize: 10, fontWeight: '700', color: Colors.primaryBlue, marginBottom: 2 },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFF' },
  aiText: { color: 'rgba(255,255,255,0.9)' },
  systemText: { color: '#EF4444', fontSize: 12, textAlign: 'center' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryBlue, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

export default GeminiLiveChat;
