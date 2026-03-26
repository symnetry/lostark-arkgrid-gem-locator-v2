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

export function formatCoreType(
  attr: ArkGridAttr,
  ctype: ArkGridCoreType,
  locale: AppLocale,
  noSuffix?: boolean
) {
  // 질서의 별
  //  {attr}의 {ctype}
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
    // maxroll 표기
  }
}
