import { type ArkGridCoreType, ArkGridCoreTypeTypes } from '../models/arkGridCores';
import { type AppLocale, type ArkGridAttr, ArkGridAttrTypes, type LocalizationName } from './enums';

export const LConfirm: LocalizationName = {
  ko_kr: '확인',
  en_us: 'Confirm',
  zh_cn: '确认',
};
export const LCancel: LocalizationName = {
  ko_kr: '취소',
  en_us: 'Cancel',
  zh_cn: '取消',
};
export const LOrder: LocalizationName = {
  ko_kr: '질서',
  en_us: 'Order',
  zh_cn: '秩序',
};
export const LChaos: LocalizationName = {
  ko_kr: '혼돈',
  en_us: 'Chaos',
  zh_cn: '混沌',
};
export const LDealeer: LocalizationName = {
  ko_kr: '딜러',
  en_us: 'DPS',
  zh_cn: '输出',
};
export const LSupporter: LocalizationName = {
  ko_kr: '서포터',
  en_us: 'Support',
  zh_cn: '辅助',
};

export const LErrorUnknown: LocalizationName = {
  ko_kr: '알 수 없는 에러가 발생하였습니다.',
  en_us: 'An unknown error occurred.',
  zh_cn: '发生了未知错误。',
};
export const LErrorAlreadyRecording: LocalizationName = {
  ko_kr: '이미 녹화 중입니다.',
  en_us: 'Recording is already in progress.',
  zh_cn: '已在录制中。',
};
export const LErrorScreenPermissionDenied: LocalizationName = {
  ko_kr: '화면 공유를 거부하였습니다.',
  en_us: 'Screen sharing was denied.',
  zh_cn: '屏幕共享已被拒绝。',
};
export const LErrorWorkerInitFailed: LocalizationName = {
  ko_kr: '분석 엔진을 준비하는데 실패하였습니다.',
  en_us: 'Failed to prepare the analysis engine.',
  zh_cn: '准备分析引擎失败。',
};

export function formatCoreType(
  attr: ArkGridAttr,
  ctype: ArkGridCoreType,
  locale: AppLocale,
  noSuffix?: boolean
) {
  // 秩序之星
  //  {attr}的{ctype}
  //
  if (locale === 'ko_kr') {
    return `${attr}의 ${ctype}`;
  } else if (locale === 'zh_cn') {
    if (noSuffix) {
      return `${ArkGridAttrTypes[attr].name[locale]}${ArkGridCoreTypeTypes[ctype].name[locale]}`;
    } else {
      return `${ArkGridAttrTypes[attr].name[locale]}${ArkGridCoreTypeTypes[ctype].name[locale]}核心`;
    }
  } else {
    if (noSuffix) {
      return `${ArkGridAttrTypes[attr].name[locale]} ${ArkGridCoreTypeTypes[ctype].name[locale]}`;
    } else {
      return `${ArkGridAttrTypes[attr].name[locale]} ${ArkGridCoreTypeTypes[ctype].name[locale]} Core`;
    }

    // return `${ArkGridAttrTypes[attr].name[locale]} of the ${ArkGridCoreTypeTypes[ctype].name[locale]}`;
    // maxroll 格式
  }
}
