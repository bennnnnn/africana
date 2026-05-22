import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { UI_TOAST } from '@/constants/copy';
import { chatScreenStyles as s } from '@/components/chat/ChatScreenStyles';

export type ChatComposerVariant = 'active' | 'outgoing-off' | 'blocked' | 'peer-off' | 'quota-exceeded';

type Props = {
  variant: ChatComposerVariant;
  text: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  inputRef: React.RefObject<TextInput | null>;
  inputFocused: boolean;
  onInputFocus: () => void;
  onInputBlur: () => void;
  composerBottomPad: number;
  disabledBarBottomPad: number;
  quotaRemaining?: number | null;
  quotaCap?: number;
};

export function ChatComposerArea({
  variant,
  text,
  onChangeText,
  onSend,
  inputRef,
  inputFocused,
  onInputFocus,
  onInputBlur,
  composerBottomPad,
  disabledBarBottomPad,
  quotaRemaining,
  quotaCap,
}: Props) {
  if (variant === 'outgoing-off') {
    return (
      <View style={[s.disabledBar, { paddingBottom: disabledBarBottomPad }]}>
        <Text
          style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}
        >
          Your messages are turned off. Open Settings → Privacy and turn on Receive messages to
          send.
        </Text>
      </View>
    );
  }
  if (variant === 'blocked') {
    return (
      <View style={[s.disabledBar, { paddingBottom: disabledBarBottomPad }]}>
        <Text
          style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}
        >
          {UI_TOAST.openChatBlocked}
        </Text>
      </View>
    );
  }
  if (variant === 'peer-off') {
    return (
      <View style={[s.disabledBar, { paddingBottom: disabledBarBottomPad }]}>
        <Text
          style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}
        >
          This person has turned off receiving messages in their settings.
        </Text>
      </View>
    );
  }
  if (variant === 'quota-exceeded') {
    return (
      <View style={[s.disabledBar, { paddingBottom: disabledBarBottomPad }]}>
        <Text
          style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}
        >
          You&apos;ve used all {quotaCap ?? 10} free messages today. Upgrade to Africana Pro for
          unlimited.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Quota banner — shown when close to the daily cap */}
      {quotaRemaining != null && quotaRemaining <= 3 && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: COLORS.savanna,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 11, color: COLORS.earth, textAlign: 'center' }}>
            {quotaRemaining > 0
              ? `${quotaRemaining} free message${quotaRemaining === 1 ? '' : 's'} left today`
              : 'No free messages left today'}
          </Text>
        </View>
      )}
      <View style={[s.inputRow, { paddingBottom: composerBottomPad }]}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={onChangeText}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={1000}
          style={[s.input, inputFocused && s.inputFocused]}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onSubmitEditing={onSend}
          submitBehavior="submit"
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={!text.trim()}
          style={[s.sendBtn, { backgroundColor: text.trim() ? COLORS.primary : COLORS.border }]}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
