import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONT } from '@/constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  validationState?: 'default' | 'error' | 'success';
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  validationState = 'default',
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  isPassword = false,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const accentColor =
    validationState === 'error'   ? COLORS.error   :
    validationState === 'success' ? COLORS.success  :
    isFocused                     ? COLORS.primary  :
    COLORS.border;

  const iconColor =
    validationState === 'error'   ? COLORS.error        :
    validationState === 'success' ? COLORS.success       :
    isFocused                     ? COLORS.primary       :
    COLORS.textSecondary;

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text style={{ fontSize: FONT.sm, fontWeight: FONT.semibold, color: COLORS.text, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: accentColor,
          borderRadius: RADIUS.md,
          backgroundColor: COLORS.inputBg,
          paddingHorizontal: 14,
          minHeight: 50,
        }}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color={iconColor} style={{ marginRight: 10 }} />
        )}
        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => { setIsFocused(true);  props.onFocus?.(e); }}
          onBlur={(e)  => { setIsFocused(false); props.onBlur?.(e);  }}
          style={[{ flex: 1, fontSize: FONT.md, color: COLORS.text, paddingVertical: 12 }, props.style]}
          placeholderTextColor={COLORS.textMuted}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor} />
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={{ fontSize: FONT.xs, color: COLORS.error, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}
