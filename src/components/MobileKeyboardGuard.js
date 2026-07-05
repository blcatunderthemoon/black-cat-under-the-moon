import { useEffect } from 'react';
import { initMobileKeyboard } from '../lib/mobile-keyboard.js';

export default function MobileKeyboardGuard() {
  useEffect(() => initMobileKeyboard(), []);
  return null;
}
