import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

type DialogTone = 'default' | 'success' | 'warning' | 'danger';
type DialogActionStyle = 'primary' | 'secondary' | 'destructive';

type DialogAction = {
  label: string;
  style?: DialogActionStyle;
  onPress?: () => void | Promise<void>;
};

type DialogConfig = {
  title: string;
  message?: string;
  tone?: DialogTone;
  icon?: keyof typeof Ionicons.glyphMap;
  actions?: DialogAction[];
};

type ToastConfig = {
  title: string;
  message?: string;
  tone?: DialogTone;
  icon?: keyof typeof Ionicons.glyphMap;
  durationMs?: number;
};

type DialogContextValue = {
  showDialog: (config: DialogConfig) => void;
  showToast: (config: ToastConfig) => void;
  dismissDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

const DEFAULT_DIALOG_ACTIONS: DialogAction[] = [{ label: 'OK', style: 'primary' }];

function toneMeta(tone: DialogTone, colors: ReturnType<typeof useTheme>['colors']) {
  switch (tone) {
    case 'success':
      return { accent: colors.success, soft: `${colors.success}18`, icon: 'checkmark' as const };
    case 'warning':
      return { accent: colors.warning, soft: `${colors.warning}18`, icon: 'alert' as const };
    case 'danger':
      return { accent: colors.error, soft: `${colors.error}18`, icon: 'close' as const };
    default:
      return { accent: colors.primary, soft: `${colors.primary}18`, icon: 'information' as const };
  }
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const showDialog = useCallback((config: DialogConfig) => {
    setDialog({
      ...config,
      actions: config.actions?.length ? config.actions : DEFAULT_DIALOG_ACTIONS,
    });
  }, []);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  const showToast = useCallback((config: ToastConfig) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(config);
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 85,
      friction: 10,
    }).start();
    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, config.durationMs ?? 2200);
  }, [hideToast, toastAnim]);

  const value = useMemo(() => ({ showDialog, showToast, dismissDialog }), [dismissDialog, showDialog, showToast]);
  const dialogTone = toneMeta(dialog?.tone ?? 'default', colors);
  const toastTone = toneMeta(toast?.tone ?? 'default', colors);

  return (
    <DialogContext.Provider value={value}>
      {children}

      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={dismissDialog}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissDialog} />
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: dialogTone.soft }]}>
              <Ionicons
                name={dialog?.icon ?? dialogTone.icon}
                size={22}
                color={dialogTone.accent}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{dialog?.title}</Text>
            {!!dialog?.message && (
              <Text style={[styles.message, { color: colors.textSecondary }]}>{dialog.message}</Text>
            )}

            <View style={styles.actions}>
              {dialog?.actions?.map((action, index) => {
                const isPrimary = (action.style ?? 'secondary') === 'primary';
                const isDestructive = action.style === 'destructive';
                const accent = isDestructive ? colors.error : colors.primary;
                const backgroundColor = isPrimary ? accent : colors.surface;
                const borderColor = isPrimary ? accent : colors.border;
                const textColor = isPrimary ? '#FFFFFF' : isDestructive ? colors.error : colors.text;

                return (
                  <TouchableOpacity
                    key={`${action.label}-${index}`}
                    activeOpacity={0.9}
                    style={[
                      styles.actionBtn,
                      { backgroundColor, borderColor },
                    ]}
                    onPress={() => {
                      dismissDialog();
                      setTimeout(() => {
                        void action.onPress?.();
                      }, 120);
                    }}
                  >
                    <Text style={[styles.actionText, { color: textColor }]}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {toast && (
        <SafeAreaView pointerEvents="box-none" style={styles.toastRoot}>
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: 'rgba(17, 24, 39, 0.94)',
                borderColor: `${toastTone.accent}55`,
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.toastAccent, { backgroundColor: toastTone.accent }]} />
            <View style={[styles.toastIconWrap, { backgroundColor: toastTone.soft }]}>
              <Ionicons name={toast.icon ?? toastTone.icon} size={18} color={toastTone.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: '#FFFFFF' }]}>{toast.title}</Text>
              {!!toast.message && (
                <Text style={[styles.toastMessage, { color: 'rgba(255,255,255,0.82)' }]}>{toast.message}</Text>
              )}
            </View>
          </Animated.View>
        </SafeAreaView>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  actions: {
    gap: 10,
  },
  actionBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  toastRoot: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '50%',
    marginTop: -44,
  },
  toast: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  toastAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  toastIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
});
