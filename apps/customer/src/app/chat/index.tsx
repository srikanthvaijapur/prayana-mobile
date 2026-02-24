import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { makeChatAPICall } from '@prayana/shared-services';
import Toast from 'react-native-toast-message';

// ============================================================
// TYPES
// ============================================================
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============================================================
// CONSTANTS
// ============================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_MESSAGE_WIDTH = SCREEN_WIDTH * 0.78;

const QUICK_SUGGESTIONS = [
  { text: 'Plan a trip to...', icon: 'airplane-outline' as const },
  { text: 'Find activities in...', icon: 'compass-outline' as const },
  { text: "What's the weather in...", icon: 'partly-sunny-outline' as const },
  { text: 'Best time to visit...', icon: 'calendar-outline' as const },
  { text: 'Budget tips for...', icon: 'wallet-outline' as const },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hello! I'm your Prayana AI travel assistant. I can help you plan trips, find activities, check weather, and more. What would you like to explore today?",
  timestamp: new Date(),
};

// ============================================================
// GENERATE UNIQUE ID
// ============================================================
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================
// FORMAT TIMESTAMP
// ============================================================
function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes < 10 ? `0${minutes}` : minutes;
  return `${h}:${m} ${ampm}`;
}

// ============================================================
// TYPING INDICATOR COMPONENT
// ============================================================
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = animate(dot1, 0);
    const anim2 = animate(dot2, 200);
    const anim3 = animate(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const translateY = (dot: Animated.Value) =>
    dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -6],
    });

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          {[dot1, dot2, dot3].map((dot, index) => (
            <Animated.View
              key={index}
              style={[
                styles.typingDot,
                { transform: [{ translateY: translateY(dot) }] },
              ]}
            />
          ))}
        </View>
        <Text style={styles.typingText}>AI is thinking...</Text>
      </View>
    </View>
  );
}

// ============================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.messageBubbleWrapper,
        isUser ? styles.userMessageWrapper : styles.assistantMessageWrapper,
      ]}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Ionicons name="sparkles" size={16} color={colors.primary[500]} />
        </View>
      )}

      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText,
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.messageTime,
            isUser ? styles.userMessageTime : styles.assistantMessageTime,
          ]}
        >
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// MAIN CHAT SCREEN
// ============================================================
export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // --- State ---
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // --- Refs ---
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // ============================================================
  // SCROLL TO BOTTOM
  // ============================================================
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  // ============================================================
  // SEND MESSAGE
  // ============================================================
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      // Hide suggestions after first message
      setShowSuggestions(false);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [userMessage, ...prev]);
      setInputText('');
      setIsTyping(true);
      Keyboard.dismiss();
      scrollToBottom();

      try {
        const response = await makeChatAPICall('/chat/message', {
          method: 'POST',
          body: {
            message: trimmed,
            context: { type: 'general' },
          },
          timeout: 60000,
        });

        // Extract AI response text
        const aiText =
          response?.data?.response ||
          response?.data?.message ||
          response?.response ||
          response?.message ||
          response?.data?.content ||
          response?.content ||
          (typeof response?.data === 'string' ? response.data : null) ||
          (typeof response === 'string' ? response : null) ||
          'I apologize, but I was unable to process your request. Please try again.';

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: aiText,
          timestamp: new Date(),
        };

        setMessages((prev) => [assistantMessage, ...prev]);
      } catch (err: any) {
        console.warn('[Chat] AI response failed:', err.message);

        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content:
            'I apologize, but I encountered an issue processing your request. Please check your internet connection and try again.',
          timestamp: new Date(),
        };

        setMessages((prev) => [errorMessage, ...prev]);

        Toast.show({
          type: 'error',
          text1: 'Connection error',
          text2: 'Could not reach the AI assistant.',
        });
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [isTyping, scrollToBottom]
  );

  // ============================================================
  // HANDLE SEND
  // ============================================================
  const handleSend = useCallback(() => {
    sendMessage(inputText);
  }, [inputText, sendMessage]);

  // ============================================================
  // HANDLE SUGGESTION TAP
  // ============================================================
  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      setInputText(suggestion);
      // Focus input so user can complete the suggestion
      inputRef.current?.focus();
    },
    []
  );

  // ============================================================
  // HANDLE CLOSE
  // ============================================================
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // ============================================================
  // CLEAR CHAT
  // ============================================================
  const handleClearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setShowSuggestions(true);
    setInputText('');
  }, []);

  // ============================================================
  // RENDER MESSAGE
  // ============================================================
  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // ============================================================
  // LIST FOOTER (appears at top since inverted)
  // ============================================================
  const ListFooterComponent = useMemo(() => {
    if (!showSuggestions) return null;

    return (
      <View style={styles.suggestionsSection}>
        <Text style={styles.suggestionsTitle}>Quick suggestions</Text>
        <View style={styles.suggestionsGrid}>
          {QUICK_SUGGESTIONS.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.suggestionChip, shadow.sm]}
              onPress={() => handleSuggestionPress(suggestion.text)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={suggestion.icon}
                size={16}
                color={colors.primary[500]}
              />
              <Text style={styles.suggestionChipText} numberOfLines={1}>
                {suggestion.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [showSuggestions, handleSuggestionPress]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ====== HEADER ====== */}
      <View style={[styles.header, shadow.sm]}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.headerButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerAvatarContainer}>
            <LinearGradient
              colors={[colors.primary[400], colors.primary[600]]}
              style={styles.headerAvatar}
            >
              <Ionicons name="sparkles" size={16} color="#ffffff" />
            </LinearGradient>
            <View style={styles.onlineIndicator} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Travel Assistant</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? 'Typing...' : 'Online'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleClearChat}
          style={styles.headerButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ====== MESSAGE LIST ====== */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          ListFooterComponent={ListFooterComponent}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        {/* ====== INPUT BAR ====== */}
        <View style={[styles.inputBar, shadow.lg]}>
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask me anything about travel..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={2000}
              returnKeyType="default"
              blurOnSubmit={false}
              editable={!isTyping}
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.7}
            style={[
              styles.sendButton,
              inputText.trim() && !isTyping
                ? styles.sendButtonActive
                : styles.sendButtonDisabled,
            ]}
          >
            {isTyping ? (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={
                  inputText.trim() ? '#ffffff' : colors.textTertiary
                }
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    gap: spacing.md,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // --- Keyboard Avoid ---
  keyboardAvoid: {
    flex: 1,
  },

  // --- Message List ---
  messageList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },

  // --- Message Bubble ---
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: MAX_MESSAGE_WIDTH,
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  assistantMessageWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  messageBubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    maxWidth: MAX_MESSAGE_WIDTH - 40,
  },
  userBubble: {
    backgroundColor: colors.primary[500],
    borderBottomRightRadius: borderRadius.sm,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#ffffff',
  },
  assistantMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 10,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  assistantMessageTime: {
    color: colors.textTertiary,
  },

  // --- Typing Indicator ---
  typingContainer: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    marginLeft: 36,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary[400],
  },
  typingText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // --- Suggestions ---
  suggestionsSection: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  suggestionsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  suggestionChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },

  // --- Input Bar ---
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    maxHeight: 120,
  },
  textInput: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
    paddingVertical: 0,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary[500],
  },
  sendButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
