import { Alert } from 'react-native';

export type DialogActionStyle = 'default' | 'primary' | 'secondary' | 'destructive' | 'cancel';

export type DialogAction = {
  label: string;
  style?: DialogActionStyle;
  onPress?: () => void | Promise<void>;
};

export type DialogConfig = {
  title: string;
  message?: string;
  tone?: 'default' | 'success' | 'danger';
  /** Ionicons name, e.g. `alert-circle-outline` */
  icon?: string;
  actions?: DialogAction[];
};

let showDialogImpl: ((config: DialogConfig) => void) | null = null;

export function registerAppDialog(fn: ((config: DialogConfig) => void) | null) {
  showDialogImpl = fn;
}

/**
 * Shows the app-wide dialog (see-through overlay + card). Falls back to `Alert.alert` if the
 * provider is not mounted (e.g. tests).
 */
export function appDialog(config: DialogConfig) {
  const merged: DialogConfig = { actions: [{ label: 'OK', style: 'primary' }], ...config };
  if (showDialogImpl) {
    showDialogImpl(merged);
    return;
  }
  const actions = merged.actions ?? [{ label: 'OK' }];
  Alert.alert(
    merged.title,
    merged.message ?? '',
    actions.map((a) => ({
      text: a.label,
      style: a.style === 'destructive' ? 'destructive' : 'default',
      onPress: () => {
        void a.onPress?.();
      },
    })),
    { cancelable: true },
  );
}
