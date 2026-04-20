import React, { useState, useRef, useCallback } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { invokeWithAuth, throwFromInvoke } from '@/lib/invoke'
import { useChatStore, type ChatMessage } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'

const QUICK_PROMPTS = [
  'Explique-moi les bases de la thermodynamique',
  'Crée un circuit d\'apprentissage pour mon cours',
  'Génère un quiz sur mon dernier circuit',
  'Résume mon parcours en cours',
]

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleAI,
        msg.type === 'error' && styles.bubbleError,
      ]}>
        {msg.attachment && (
          <View style={styles.attachment}>
            <Ionicons
              name={msg.type === 'pdf_upload' ? 'document-outline' : 'image-outline'}
              size={16}
              color={colors.text.secondary}
            />
            <Text style={styles.attachmentName} numberOfLines={1}>{msg.attachment.name}</Text>
          </View>
        )}
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
          {msg.text}
        </Text>
        {msg.action && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              if (msg.action?.function === 'generate-circuit') router.push('/(tabs)/upload')
              else if (msg.action?.circuit_id) router.push(`/circuit/${msg.action.circuit_id}`)
            }}
          >
            <Text style={styles.actionBtnText}>{msg.action.label}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accent.primary} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>A</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
        <Text style={styles.typingText}>APSIA réfléchit...</Text>
        <ActivityIndicator size="small" color={colors.accent.primary} style={{ marginLeft: spacing.xs }} />
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { messages, isTyping, addMessage, setTyping } = useChatStore()
  const [inputText, setInputText] = useState('')
  const listRef = useRef<FlatList>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  const sendMessage = useCallback(async (text: string, attachment?: ChatMessage['attachment'], type: ChatMessage['type'] = 'text') => {
    if (!text.trim() && !attachment) return

    const userMsg = addMessage({
      role: 'user',
      type: attachment ? (type === 'pdf_upload' ? 'pdf_upload' : 'image_upload') : 'text',
      text: text || (attachment ? `[Fichier: ${attachment.name}]` : ''),
      attachment,
    })
    setInputText('')
    setTyping(true)
    scrollToBottom()

    const history = messages
      .filter((m) => m.type === 'text' || m.type === 'circuit_card' || m.type === 'quiz_card' || m.type === 'summary_card')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text }))

    const CLIENT_TIMEOUT_MS = 35_000

    try {
      const invokePromise = invokeWithAuth('chat-with-ai', {
        message: text || (attachment ? `J'ai partagé le fichier : ${attachment.name}` : ''),
        history,
      })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Désolé, je n\'ai pas pu répondre. Réessaie.')), CLIENT_TIMEOUT_MS),
      )

      const { data, error } = await Promise.race([invokePromise, timeoutPromise])
      if (error) await throwFromInvoke(error, data)

      const reply = data?.reply
      addMessage({
        role: 'assistant',
        type: reply?.type ?? 'text',
        text: reply?.text ?? 'Je n\'ai pas pu générer une réponse.',
        action: reply?.action ?? null,
      })
    } catch (e) {
      addMessage({
        role: 'assistant',
        type: 'error',
        text: (e as Error).message,
      })
    } finally {
      setTyping(false)
      scrollToBottom()
    }
  }, [messages, addMessage, setTyping, scrollToBottom])

  const pickPDF = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    await sendMessage('', { name: asset.name, uri: asset.uri, mimeType: 'application/pdf' }, 'pdf_upload')
  }, [sendMessage])

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const name = asset.fileName ?? `image_${Date.now()}.jpg`
    await sendMessage('', { name, uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' }, 'image_upload')
  }, [sendMessage])

  const firstName = user?.full_name?.split(' ')[0] ?? ''

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>A</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>APSIA</Text>
            <Text style={styles.headerSub}>Assistant pédagogique</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        style={styles.messageListWrapper}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyGreeting}>Bonjour{firstName ? `, ${firstName}` : ''} 👋</Text>
            <Text style={styles.emptySubtitle}>Comment puis-je vous aider aujourd'hui ?</Text>
            <View style={styles.quickPromptsGrid}>
              {QUICK_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  style={styles.quickPrompt}
                  onPress={() => sendMessage(prompt)}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={isTyping ? <TypingIndicator /> : null}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable style={styles.attachBtn} onPress={pickPDF}>
          <Ionicons name="document-attach-outline" size={22} color={colors.text.secondary} />
        </Pressable>
        <Pressable style={styles.attachBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={22} color={colors.text.secondary} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Posez votre question..."
          placeholderTextColor={colors.text.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <Pressable
          style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isTyping}
        >
          <Ionicons name="send" size={18} color={colors.text.primary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '700',
  },
  headerTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  headerSub: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  messageListWrapper: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAI: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleUser: {
    backgroundColor: colors.accent.primary,
    borderBottomRightRadius: borderRadius.xs,
  },
  bubbleAI: {
    backgroundColor: colors.background.card,
    borderBottomLeftRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  bubbleError: {
    borderColor: colors.accent.error,
  },
  bubbleText: {
    ...textStyles.body,
  },
  bubbleTextUser: {
    color: colors.text.primary,
  },
  bubbleTextAI: {
    color: colors.text.secondary,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  attachmentName: {
    ...textStyles.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.xs,
  },
  actionBtnText: {
    ...textStyles.caption,
    color: colors.accent.primary,
    fontWeight: '600',
    flex: 1,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    ...textStyles.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  emptyGreeting: {
    ...textStyles.h2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  quickPromptsGrid: {
    width: '100%',
    gap: spacing.sm,
  },
  quickPrompt: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  quickPromptText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.secondary,
    marginBottom: 64,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...textStyles.body,
    color: colors.text.primary,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
})
