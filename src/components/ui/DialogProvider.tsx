import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type DialogTone = 'default' | 'success' | 'danger';
type DialogActionStyle = 'default' | 'primary' | 'secondary' | 'destructive';

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

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog]   = useState<DialogConfig | null>(null);
  const [toast, setToast]     = useState<ToastConfig | null>(null);
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.94)).current;
  const toastAnim  = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissDialog = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 160, useNativeDriver: true }),
    ]).start(() => setDialog(null));
  }, [fadeAnim, scaleAnim]);

  const showDialog = useCallback((config: DialogConfig) => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.94);
    setDialog({ actions: [{ label: 'OK' }], ...config });
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const showToast = useCallback((config: ToastConfig) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastAnim.setValue(0);
    setToast(config);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true })
        .start(() => setToast(null));
    }, config.durationMs ?? 2000);
  }, [toastAnim]);

  const value = useMemo(() => ({ showDialog, showToast, dismissDialog }), [dismissDialog, showDialog, showToast]);

  const actions = dialog?.actions ?? [];
  const useInlineActions = actions.length <= 2;

  return (
    <DialogContext.Provider value={value}>
      {/* Wrapper fills screen so absolute children position correctly */}
      <View style={{ flex: 1 }}>
        {children}

        {/* ── Dialog — no Modal, keyboard never dismisses ── */}
        {dialog && (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={dismissDialog} />
            </Animated.View>

            <Animated.View style={[styles.cardWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
              <View style={styles.card}>
                {dialog.icon ? (
                  <View style={styles.iconWrap}>
                    <Ionicons name={dialog.icon} size={20} color="#111111" />
                  </View>
                ) : null}
                <Text style={styles.title}>{dialog.title}</Text>
                {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}

                <View style={[styles.btnRow, useInlineActions && styles.btnRowInline]}>
                  {actions.map((action) => (
                    <TouchableOpacity
                      key={`${action.label}-${action.style ?? 'default'}`}
                      style={[
                        styles.btn,
                        useInlineActions && styles.btnInline,
                        action.label.toLowerCase() === 'cancel' && styles.btnCancel,
                        action.style === 'destructive' && styles.btnDestructive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => { dismissDialog(); setTimeout(() => void action.onPress?.(), 200); }}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          action.style === 'destructive' && styles.btnTextDestructive,
                        ]}
                      >
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {/* ── Toast ── */}
        {toast && (
          <Animated.View
            pointerEvents="none"
            style={[styles.toast, {
              opacity: toastAnim,
              transform: [{ scale: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            }]}
          >
            {toast.icon && <Ionicons name={toast.icon} size={14} color="#fff" />}
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
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9998,
  },
  cardWrap: {
    position: 'absolute',
    top: '18%',
    left: 24,
    right: 24,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  btnRowInline: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  btnInline: {
    minWidth: 0,
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnDestructive: {
    backgroundColor: '#111111',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  btnTextDestructive: {
    color: '#FFFFFF',
  },
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#111',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    zIndex: 9999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
