import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Keyboard height for auto-scroll and composer padding. Actual composer lift
 * uses KeyboardAvoidingView from react-native-keyboard-controller.
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    };
    const onHide = () => setKeyboardHeight(0);
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return keyboardHeight;
}
