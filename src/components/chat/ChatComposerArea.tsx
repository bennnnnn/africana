import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { UI_TOAST } from '@/constants/copy';
import { chatScreenStyles as s } from '@/components/chat/ChatScreenStyles';

export type ChatComposerVariant = 'active' | 'outgoing-off' | 'blocked' | 'peer-off';

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

  return (
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
  );
}
