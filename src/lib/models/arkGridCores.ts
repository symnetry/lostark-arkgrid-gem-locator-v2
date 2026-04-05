import { type ArkGridAttr, type LocalizationName, type LostArkGrade } from '../constants/enums';
import type { WeaponInfo } from '../state/profile.state.svelte';

export type ArkGridCoreTypeType = {
  name: LocalizationName;
};
export const ArkGridCoreTypeTypes = {
  해: {
    name: {
      ko_kr: '해',
      en_us: 'Sun',
      zh_cn: '日',
    },
  },
  달: {
    name: {
      ko_kr: '달',
      en_us: 'Moon',
      zh_cn: '月',
    },
  },
  별: {
    name: {
      ko_kr: '별',
      en_us: 'Star',
      zh_cn: '星',
    },
  },
} as const satisfies Record<string, ArkGridCoreTypeType>;
export type ArkGridCoreType = keyof typeof ArkGridCoreTypeTypes;
export const ArkGridCoreTypes = Object.keys(ArkGridCoreTypeTypes) as ArkGridCoreType[];

export const ArkGridCoreNameTierMap: Record<string, number> = {
  '현란한 공격': 0,
  '안정적인 공격': 1,
  '재빠른 공격': 1,
  '불타는 일격': 0,
  '흡수의 일격': 1,
  '부수는 일격': 1,
  공격: 0,
  무기: 1, // 폿은 0
  '신념의 강화': 0,
  '흐르는 마나': 1,
  '불굴의 강화': 1,
  '낙인의 흔적': 0,
  '강철의 흔적': 1,
  '치명적인 흔적': 1,
  생명: 1,
};

export type ArkGridCoreCoeffs = {
  p10: number;
  p14: number;
  p17: number;
  p18: number;
  p19: number;
  p20: number;
};

export interface ArkGridCore {
  attr: ArkGridAttr;
  type: ArkGridCoreType;
  grade: LostArkGrade;
  coeffs: ArkGridCoreCoeffs;
  tier: number;
  goalPoint: number;
  /*
  输出
  0: 绚烂、燃烧
  1: 稳定、迅捷、吸收、粉碎
  2: 其他

  辅助
  0: 信念、烙印、武器
  1: 流动的魔力、不屈的强化、钢铁的痕迹、致命的痕迹
  2: 其他
  */
}

export function resetCoreCoeff(
  core: ArkGridCore,
  isSupporter: boolean,
  weapon: WeaponInfo | undefined
) {
  core.coeffs = getDefaultCoreCoeff(core, isSupporter, weapon);
  cutoffCoeff(core);
  adjustCoeff(core, isSupporter);
  // 若给定武器信息，则不附加遗物-古代额外系数
}
function cutoffCoeff(core: ArkGridCore) {
  // 核心英雄、传说等级时调整系数
  if (core.grade === '영웅') {
    // 英雄等级：仅存在到10P选项
    core.coeffs.p14 = core.coeffs.p10;
    core.coeffs.p17 = core.coeffs.p10;
    core.coeffs.p18 = core.coeffs.p10;
    core.coeffs.p19 = core.coeffs.p10;
    core.coeffs.p20 = core.coeffs.p10;
  } else if (core.grade === '전설') {
    // 传说等级：仅存在到14P选项
    core.coeffs.p17 = core.coeffs.p14;
    core.coeffs.p18 = core.coeffs.p14;
    core.coeffs.p19 = core.coeffs.p14;
    core.coeffs.p20 = core.coeffs.p14;
  }
}
function adjustCoeff(core: ArkGridCore, isSupporter: boolean) {
  // 古代核心附加额外系数

  // getDefaultCoreCoeff中已经处理过的情况跳过
  if (
    !isSupporter &&
    core.grade == '고대' &&
    core.attr == '혼돈' &&
    core.type == '별' &&
    core.tier == 1
  )
    // 输出 - 古代混沌之星武器的情况不适用古代加成
    return;

  if (
    isSupporter &&
    core.grade == '고대' &&
    core.attr == '혼돈' &&
    core.type == '별' &&
    core.tier == 0
  )
    // 辅助 - 古代混沌之星武器的情况不适用古代加成
    return;

  if (core.grade === '고대' && core.coeffs.p17) {
    /*
      古代等级 17-20P选项额外系数
      输出: +100
      辅助
        - 秩序之日、月: 120
        - 秩序之星: 90
        - 混沌之日、月
          - 1阶: 180
          - 2阶: 120
    */
    let additionalCoeff = 100; // 输出 100
    if (isSupporter) {
      switch (core.attr) {
        case '질서':
          switch (core.type) {
            case '해':
            case '달':
              additionalCoeff = 120; // 辅助秩序日月 +120
              break;
            case '별':
              additionalCoeff = 90; // 辅助秩序之星 +90
              break;
            default:
              throw Error('additionalCoeff is not set');
          }
          break;
        case '혼돈':
          switch (core.type) {
            case '해': // 辅助混沌1阶日月 +180
            case '달': // 辅助混沌2阶日月 +120
              additionalCoeff = core.tier == 0 ? 180 : 120;
              break;
            case '별':
              additionalCoeff = 100; // 武器 +100 对吗?
              break;
            default:
              throw Error('additionalCoeff is not set');
          }
      }
    }
    core.coeffs.p17 += additionalCoeff;
    core.coeffs.p18 += additionalCoeff;
    core.coeffs.p19 += additionalCoeff;
    core.coeffs.p20 += additionalCoeff;
  }
}

function getWeaponCoeff(base: WeaponInfo, income: WeaponInfo) {
  // 给定当前武功和追加武功信息时，战斗力系数
  const v1 = base.fixed * ((base.percent + 100) / 100);
  const v2 = (base.fixed + income.fixed) * ((base.percent + income.percent + 100) / 100);
  const diff = Math.sqrt(v2 / v1);
  return Math.floor((diff - 1) * 10000);
}

export function getDefaultCoreCoeff(
  core: ArkGridCore,
  isSupporter = false,
  weapon: WeaponInfo | undefined
): ArkGridCoreCoeffs {
  // 若未给定武器，则按切尔卡25强、觉悟30级、耳环上2个为基准
  if (!weapon) weapon = { fixed: 241367, percent: 9 };

  const attr = core.attr,
    type = core.type,
    tier = core.tier;

  if (!isSupporter) {
    // 输出
    if (attr == '질서') {
      if (type == '해' || type == '달') {
        // 질서의 해, 달
        return {
          p10: 150,
          p14: 400,
          p17: 750,
          p18: 767,
          p19: 783,
          p20: 800,
        };
      } else if (type == '별') {
        // 질서의 별
        return {
          p10: 100,
          p14: 250,
          p17: 450,
          p18: 467,
          p19: 483,
          p20: 500,
        };
      }
    } else if (attr == '혼돈') {
      if (type == '해' || type == '달') {
        // 혼돈의 해, 달
        if (tier == 0) {
          // 绚烂的攻击、燃烧的一击
          return {
            p10: 50,
            p14: 100,
            p17: 250,
            p18: 267,
            p19: 283,
            p20: 300,
          };
        } else if (tier == 1) {
          // 稳定的攻击、迅捷的攻击、吸收的一击、粉碎的一击
          return {
            p10: 0,
            p14: 50,
            p17: 150,
            p18: 167,
            p19: 183,
            p20: 200,
          };
        }
      } else if (type == '별') {
        // 혼돈의 별
        if (tier == 0) {
          // 攻击
          return {
            p10: 50,
            p14: 100,
            p17: 250,
            p18: 267,
            p19: 283,
            p20: 300,
          };
        }
        if (tier == 1) {
          // 무기
          return {
            p10: getWeaponCoeff(weapon, { fixed: 1300, percent: 0 }), // 무공 +1300
            p14: getWeaponCoeff(weapon, { fixed: 1300, percent: 0.75 }), // 무공 +0.75%
            p17: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: core.grade === '고대' ? 3 : 2.25,
            }), // 무공 +1.5/2.25%, 무공+2600/3900
            p18: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: (core.grade === '고대' ? 3 : 2.25) + 0.23,
            }), // 무공 +0.23%
            p19: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: (core.grade === '고대' ? 3 : 2.25) + 0.23 * 2,
            }), // 무공 +0.23%
            p20: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: (core.grade === '고대' ? 3 : 2.25) + 0.23 * 3,
            }), // 무공 +0.23%
          };
        }
      }
    }
  } else {
    // 辅助
    if (attr === '질서') {
      if (type == '해' || type == '달') {
        // 질서의 해, 달
        return {
          p10: 120,
          p14: 120,
          p17: 780,
          p18: 798,
          p19: 810,
          p20: 822,
        };
      } else if (type == '별') {
        // 질서의 별
        return {
          p10: 0,
          p14: 60,
          p17: 210,
          p18: 220,
          p19: 230,
          p20: 240,
        };
      }
    } else if (attr === '혼돈') {
      if (type == '해' || type == '달') {
        // 混沌之日、混沌之月
        if (tier == 0) {
          // 混沌之日、月
          // 1阶: 信念的强化、烙印的痕迹
          return {
            p10: 60,
            p14: 120,
            p17: 360,
            p18: 378,
            p19: 396,
            p20: 420,
          };
        } else if (tier == 1) {
          // 2阶
          if (type == '해') {
            // 日 - 流动的魔力、不屈的强化
            return {
              p10: 0,
              p14: 48,
              p17: 132,
              p18: 148,
              p19: 164,
              p20: 180,
            };
          } else if (type == '달') {
            // 月 - 钢铁的痕迹、致命的痕迹
            return {
              p10: 60,
              p14: 60,
              p17: 180,
              p18: 180,
              p19: 180,
              p20: 180,
            };
          }
        }
      } else if (type == '별') {
        // 混沌之星
        if (tier == 0) {
          // 武器 TODO 武功
          return {
            p10: getWeaponCoeff(weapon, { fixed: 1300, percent: 0 }), // 무공 +1300
            p14: getWeaponCoeff(weapon, { fixed: 1300, percent: 0.75 }), // 무공 +0.75%
            p17: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: core.grade === '고대' ? 3 : 2.25,
            }), // 무공 +1.5/2.25%, 무공+2600/3900
            p18: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: (core.grade === '고대' ? 3 : 2.25) + 0.23,
            }), // 무공 +0.23%
            p19: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: (core.grade === '고대' ? 3 : 2.25) + 0.23 * 2,
            }), // 무공 +0.23%
            p20: getWeaponCoeff(weapon, {
              fixed: core.grade === '고대' ? 5200 : 3900,
              percent: (core.grade === '고대' ? 3 : 2.25) + 0.23 * 3,
            }), // 무공 +0.23%
          };
        } // TODO 生命
      }
    }
  }
  return {
    p10: 0,
    p14: 0,
    p17: 0,
    p18: 0,
    p19: 0,
    p20: 0,
  };
}

export function getDefaultCoreEnergy(core: ArkGridCore | undefined | null): number {
  if (!core) return 0;
  switch (core.grade) {
    case '영웅':
      return 9;
    case '전설':
      return 12;
    case '유물':
      return 15;
    case '고대':
      return 17;
    default:
      return 0;
  }
}
export function getDefaultCoreGoalPoint(core: ArkGridCore | undefined | null): number {
  if (!core) return 0;
  switch (core.grade) {
    case '영웅':
      return 10;
    case '전설':
      return 14;
    case '유물':
      return 17;
    case '고대':
      return 17;
    default:
      return 0;
  }
}
export function getMaxCorePoint(core: ArkGridCore | undefined | null): number {
  if (!core) return 0;
  switch (core.grade) {
    case '영웅':
      return 10;
    case '전설':
      return 14;
    case '유물':
      return 20;
    case '고대':
      return 20;
    default:
      return 0;
  }
}

export function createCore(
  attr: ArkGridAttr,
  type: ArkGridCoreType,
  grade: LostArkGrade,
  isSupporter: boolean,
  weapon: WeaponInfo | undefined,
  tier?: number
): ArkGridCore {
  const core: ArkGridCore = {
    attr,
    type,
    grade,
    coeffs: {
      p10: 0,
      p14: 0,
      p17: 0,
      p18: 0,
      p19: 0,
      p20: 0,
    },
    tier: tier ? tier : 0,
    goalPoint: 0,
  };
  resetCoreCoeff(core, isSupporter, weapon);
  return core;
}

export const coreImages = import.meta.glob<string>('/src/assets/cores/*.png', {
  eager: true,
  import: 'default',
});

export function getCoreImage(attr: ArkGridAttr, ctype: ArkGridCoreType) {
  const attrMap = {
    ['질서']: 'order',
    ['혼돈']: 'chaos',
  };
  const typeMap = {
    해: 'sun',
    달: 'moon',
    별: 'star',
  };
  const key = `/src/assets/cores/${attrMap[attr]}_${typeMap[ctype]}.png`;
  return coreImages[key];
}
