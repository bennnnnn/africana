import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { UI_LABELS } from '@/constants/copy';

/**
 * Action button styles for the app dialog:
 *   primary     — green CTA ("Continue", "Go Pro"). Affirmative success action.
 *   alert       — red CTA. Use when the dialog reports a limit, error, or
 *                 warning state ("OK", "Got it"). Universal red for "this is
 *                 not a happy path" — green would feel wrong here.
 *   destructive — dark/black background for destructive intent ("Delete forever").
 *   secondary   — neutral outline ("Maybe later", "Cancel").
 *   cancel      — same as secondary; explicit dismiss intent.
 *   default     — fallback.
 */
export type DialogActionStyle =
  | 'default'
  | 'primary'
  | 'alert'
  | 'secondary'
  | 'destructive'
  | 'cancel';

export type DialogAction = {
  label: string;
  style?: DialogActionStyle;
  onPress?: () => void | Promise<void>;
};

export type DialogConfig = {
  title: string;
  message?: string;
  /** Ionicons name, e.g. `alert-circle-outline` */
  icon?: string;
  /** Optional body below `message` (e.g. toggles). */
  content?: ReactNode;
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
  const merged: DialogConfig = { actions: [{ label: UI_LABELS.ok, style: 'primary' }], ...config };
  if (showDialogImpl) {
    showDialogImpl(merged);
    return;
  }
  const actions = merged.actions ?? [{ label: UI_LABELS.ok }];
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
