import { persistedState } from 'svelte-persisted-state';

import {
  DEFAULT_GEM_RECOGNITION_LOCALE,
  type AppLocale,
  type GemRecognitionLocale,
} from '../constants/enums';

export const appLocale = persistedState<AppLocale>('appLocale', 'ko_kr');
export const gemRecognitionLocale = persistedState<GemRecognitionLocale>(
  'gemRecognitionLocale',
  DEFAULT_GEM_RECOGNITION_LOCALE
);

export function toggleLocale() {
  if (appLocale.current == 'ko_kr') {
    appLocale.current = 'en_us';
  } else if (appLocale.current == 'en_us') {
    appLocale.current = 'zh_cn';
  } else {
    appLocale.current = 'ko_kr';
  }
}
export function setLocale(locale: AppLocale) {
  appLocale.current = locale;
}
export function setGemRecognitionLocale(locale: GemRecognitionLocale) {
  gemRecognitionLocale.current = locale;
}
