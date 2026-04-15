import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '@/constants';
import { registerAppDialog, type DialogConfig, type DialogAction } from '@/lib/app-dialog';

type ToastConfig = {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  durationMs?: number;
};

type DialogContextValue = {
  showDialog: (config: DialogConfig) => void;
  showToast: (config: ToastConfig) => void;
  dismissDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function isCancelLike(action: DialogAction): boolean {
  return (
    action.style === 'cancel' ||
    action.style === 'secondary' ||
    /^cancel$/i.test(action.label.trim())
  );
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissDialog = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 160, useNativeDriver: true }),
    ]).start(() => setDialog(null));
  }, [fadeAnim, scaleAnim]);

  const showDialog = useCallback(
    (config: DialogConfig) => {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.94);
      setDialog({ actions: [{ label: 'OK', style: 'primary' }], ...config });
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();
    },
    [fadeAnim, scaleAnim],
  );

  useEffect(() => {
    registerAppDialog(showDialog);
    return () => {
      registerAppDialog(null);
    };
  }, [showDialog]);

  const showToast = useCallback(
    (config: ToastConfig) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastAnim.setValue(0);
      setToast(config);
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, config.durationMs ?? 2000);
    },
    [toastAnim],
  );

  const value = useMemo(() => ({ showDialog, showToast, dismissDialog }), [dismissDialog, showDialog, showToast]);

  const actions = dialog?.actions ?? [];
  const useInlineActions = actions.length <= 2;
  const allowBackdropDismiss = actions.length <= 1;

  const iconName = dialog?.icon as keyof typeof Ionicons.glyphMap | undefined;

  return (
    <DialogContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}

      <Modal
        visible={!!dialog}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismissDialog}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={allowBackdropDismiss ? dismissDialog : undefined}
            />
          </Animated.View>

          <Animated.View
            pointerEvents="box-none"
            style={[styles.cardWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
          >
            <View style={styles.card}>
              {iconName ? (
                <View style={styles.iconWrap}>
                  <Ionicons name={iconName} size={22} color={COLORS.textStrong} />
                </View>
              ) : null}
              <Text style={styles.title}>{dialog?.title}</Text>
              {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}

              <View style={[styles.btnRow, useInlineActions && styles.btnRowInline]}>
                {actions.map((action, index) => (
                  <TouchableOpacity
                    key={`${index}-${action.label}`}
                    style={[
                      styles.btn,
                      useInlineActions && styles.btnInline,
                      isCancelLike(action) && styles.btnSecondary,
                      action.style === 'primary' && styles.btnPrimary,
                      action.style === 'destructive' && styles.btnDestructive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      dismissDialog();
                      setTimeout(() => void action.onPress?.(), 220);
                    }}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isCancelLike(action) && styles.btnTextSecondary,
                        action.style === 'primary' && styles.btnTextPrimary,
                        action.style === 'destructive' && styles.btnTextOnDark,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

        {toast && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toast,
              {
                opacity: toastAnim,
                transform: [{ scale: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
              },
            ]}
          >
            {toast.icon && <Ionicons name={toast.icon} size={14} color={COLORS.white} />}
            <Text style={styles.toastText}>{toast.message}</Text>
          </Animated.View>
        )}
      </View>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    backgroundColor: 'rgba(17, 17, 17, 0.42)',
  },
  cardWrap: {
    zIndex: 2,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xxl,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  title: {
    fontSize: FONT.lg,
    fontWeight: FONT.extrabold,
    color: COLORS.textStrong,
    marginBottom: 8,
  },
  message: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  btnRowInline: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnInline: {
    minWidth: 0,
  },
  btnSecondary: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  btnDestructive: {
    backgroundColor: COLORS.textStrong,
    borderColor: COLORS.textStrong,
  },
  btnText: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.textStrong,
  },
  btnTextSecondary: {
    color: COLORS.textStrong,
  },
  btnTextPrimary: {
    color: COLORS.white,
  },
  btnTextOnDark: {
    color: COLORS.white,
  },
  toast: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.toastBg,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADIUS.full,
    zIndex: 9999,
  },
  toastText: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: COLORS.white,
  },
});
