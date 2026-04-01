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
import { COLORS } from '@/constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  isPassword = false,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: error ? COLORS.error : isFocused ? COLORS.primary : COLORS.border,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          minHeight: 50,
        }}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? COLORS.primary : COLORS.textSecondary}
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              fontSize: 15,
              color: COLORS.text,
              paddingVertical: 12,
            },
            props.style,
          ]}
          placeholderTextColor={COLORS.textMuted}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={{ fontSize: 12, color: COLORS.error, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}
