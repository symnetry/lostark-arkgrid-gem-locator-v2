import { undistort } from '@techstark/opencv-js';
import { persistedState } from 'svelte-persisted-state';

import { type ArkGridAttr, ArkGridAttrs, DEFAULT_PROFILE_NAME } from '../constants/enums';
import { type ArkGridCore, type ArkGridCoreType, ArkGridCoreTypes } from '../models/arkGridCores';
import { apiClient } from '../openapi';
import { type CharacterProfile, initNewProfile, migrateProfile } from './profile.state.svelte';

export interface OpenApiConfig {
  jwt?: string;
}
interface UIConfig {
  showGemRecognitionPanel: boolean;
  showGemRecognitionGuide: boolean;
  showCoreCoeff: boolean;
  debugMode: boolean;
  darkMode: boolean;
  deferredScreenSharingInit: boolean;
}
const defaultUIConfig: UIConfig = {
  showGemRecognitionPanel: true,
  showGemRecognitionGuide: true,
  showCoreCoeff: false,
  debugMode: false,
  darkMode: false,
  deferredScreenSharingInit: false,
};

interface AppConfig {
  characterProfiles: CharacterProfile[];
  openApiConfig: OpenApiConfig;
  uiConfig: UIConfig;
}

// serializer object for svelte-persisted-state
export const bigIntSerializer = {
  // bigInt 转换为string后在末尾添加n进行序列化
  stringify: (value: any) => {
    return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() + 'n' : v));
  },

  // 如果是以n结尾的字符串整数，则转换为BigInt
  parse: (text: string) => {
    return JSON.parse(text, (_, v) => {
      if (typeof v === 'string' && /^\d+n$/.test(v)) {
        return BigInt(v.slice(0, -1));
      }
      return v;
    });
  },
};
export function migrateAppConfig(appConfig: Partial<AppConfig>) {
  // uiConfig.darkMode 추가
  if (appConfig.uiConfig && appConfig.uiConfig.darkMode === undefined) {
    appConfig.uiConfig.darkMode = false;
  }
  // appLocale 제거
  if ('appLocale' in appConfig) {
    delete appConfig.appLocale;
  }
  // deferredScreenSharingInit
  if (appConfig.uiConfig && appConfig.uiConfig.deferredScreenSharingInit === undefined) {
    appConfig.uiConfig.deferredScreenSharingInit = false;
  }
}

export const appConfig = persistedState<AppConfig>(
  'appConfig',
  {
    characterProfiles: [initNewProfile(DEFAULT_PROFILE_NAME)],
    openApiConfig: {},
    uiConfig: defaultUIConfig,
  },
  {
    serializer: bigIntSerializer,
    beforeRead: (value) => {
      migrateAppConfig(value);
      // localStore中的内容可能不是app期望的格式
      for (const profile of value.characterProfiles) {
        migrateProfile(profile);
      }
      return value;
    },
  }
);

export function initArkGridCores(): Record<
  ArkGridAttr,
  Record<ArkGridCoreType, ArkGridCore | null>
> {
  const cores = {} as Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;

  for (const attr of Object.values(ArkGridAttrs)) {
    cores[attr] = {} as Record<ArkGridCoreType, ArkGridCore | null>;
    for (const type of Object.values(ArkGridCoreTypes)) {
      cores[attr][type] = null; // 核心尚未存在的状态
    }
  }

  return cores;
}
export function getProfile(name: string) {
  // 从当前appConfig中查询给定名称的profile。
  return appConfig.current.characterProfiles.find((p) => p.characterName === name);
}
export function addNewProfile(profile: CharacterProfile) {
  // 将新的CharacterProfile注册到appConfig。
  // 注册成功返回true，失败返回false。
  const name = profile.characterName;
  if (name.length == 0 || name.length > 16) return false;
  const existProfile = appConfig.current.characterProfiles.findIndex(
    (p) => p.characterName === name
  );
  if (existProfile != -1) return false;
  appConfig.current.characterProfiles.push(profile);
  return true;
}
export function toggleUI(optionName: keyof UIConfig) {
  appConfig.current.uiConfig[optionName] = !appConfig.current.uiConfig[optionName];
}

export function updateOpenApiJWT(jwtInput: string) {
  if (jwtInput.length > 0) {
    const jwtTrimed = jwtInput.trim();
    appConfig.current.openApiConfig.jwt = jwtTrimed;
    apiClient.setSecurityData({
      jwt: jwtTrimed,
    });
  }
}

export function toggleDarkMode() {
  appConfig.current.uiConfig.darkMode = !appConfig.current.uiConfig.darkMode;
}
export function enableDarkMode() {
  appConfig.current.uiConfig.darkMode = true;
}
export function toggleDeferredScreenSharingInit() {
  appConfig.current.uiConfig.deferredScreenSharingInit =
    !appConfig.current.uiConfig.deferredScreenSharingInit;
}
