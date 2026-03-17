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
    },
  },
  달: {
    name: {
      ko_kr: '달',
      en_us: 'Moon',
    },
  },
  별: {
    name: {
      ko_kr: '별',
      en_us: 'Star',
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
  딜러
  0: 현란, 불타
  1: 안정,재빠,흡수,부수
  2: 그 외

  서폿
  0: 신념, 낙인, 무기
  1: 흐마, 불굴, 강흔, 치흔
  2: 그 외
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
  // 무기 정보가 주어졌다면 유물 - 고대 추가 계수 부여하지 않음
}
function cutoffCoeff(core: ArkGridCore) {
  // 코어 영웅, 전설 등급이면 계수 조정
  if (core.grade === '영웅') {
    // 영웅 등급: 10P 옵션까지만 존재
    core.coeffs.p14 = core.coeffs.p10;
    core.coeffs.p17 = core.coeffs.p10;
    core.coeffs.p18 = core.coeffs.p10;
    core.coeffs.p19 = core.coeffs.p10;
    core.coeffs.p20 = core.coeffs.p10;
  } else if (core.grade === '전설') {
    // 전설 등급 : 14P 옵션까지만 존재
    core.coeffs.p17 = core.coeffs.p14;
    core.coeffs.p18 = core.coeffs.p14;
    core.coeffs.p19 = core.coeffs.p14;
    core.coeffs.p20 = core.coeffs.p14;
  }
}
function adjustCoeff(core: ArkGridCore, isSupporter: boolean) {
  // 고대 코어 추가 계수 부여

  // getDefaultCoreCoeff에서 이미 처리를 하는 경우 생략
  if (
    !isSupporter &&
    core.grade == '고대' &&
    core.attr == '혼돈' &&
    core.type == '별' &&
    core.tier == 1
  )
    // 딜러 - 고대 혼돈의 별 무기의 경우 고대 적용x
    return;

  if (
    isSupporter &&
    core.grade == '고대' &&
    core.attr == '혼돈' &&
    core.type == '별' &&
    core.tier == 0
  )
    // 서폿 - 고대 혼돈의 별 무기의 경우 고대 적용x
    return;

  if (core.grade === '고대' && core.coeffs.p17) {
    /*
      고대 등급 17-20P 옵션 추가 계수
      딜러:  +100
      서폿
        - 질서의 해, 달: 120
        - 질서의 별: 90
        - 혼돈의 해, 달
          - 1티어: 180
          - 2티어: 120
    */
    let additionalCoeff = 100; // 딜러 100
    if (isSupporter) {
      switch (core.attr) {
        case '질서':
          switch (core.type) {
            case '해':
            case '달':
              additionalCoeff = 120; // 폿 질서 해달  +120
              break;
            case '별':
              additionalCoeff = 90; // 폿 질서 별 +90
              break;
            default:
              throw Error('additionalCoeff is not set');
          }
          break;
        case '혼돈':
          switch (core.type) {
            case '해': // 폿 혼돈 1티어 해달 +180
            case '달': // 폿 혼돈 2티어 해달 +120
              additionalCoeff = core.tier == 0 ? 180 : 120;
              break;
            case '별':
              additionalCoeff = 100; // 무기 +100 맞나?
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
  // 현재 무공과 추가 무공 정보가 주어졌을 때, 전투력 계수
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
  // 무기가 주어지지 않는다면 세르카 25강, 깨달음 30레벨, 귀걸이 상 2개 기준으로 수행
  if (!weapon) weapon = { fixed: 241367, percent: 9 };

  const attr = core.attr,
    type = core.type,
    tier = core.tier;

  if (!isSupporter) {
    // 딜러
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
          // 현란한 공격, 불타는 일격
          return {
            p10: 50,
            p14: 100,
            p17: 250,
            p18: 267,
            p19: 283,
            p20: 300,
          };
        } else if (tier == 1) {
          // 안정적인 공격, 재빠른 공격, 흡수의 일격, 부수는 일격
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
          // 공격
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
    // 서폿
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
        // 혼돈의 해, 혼돈의 달
        if (tier == 0) {
          // 혼돈의 해, 달
          // 1티어: 신념의 강화, 낙인의 흔적
          return {
            p10: 60,
            p14: 120,
            p17: 360,
            p18: 378,
            p19: 396,
            p20: 420,
          };
        } else if (tier == 1) {
          // 2티어
          if (type == '해') {
            // 해 - 흐르는 마나, 불굴의 강화
            return {
              p10: 0,
              p14: 48,
              p17: 132,
              p18: 148,
              p19: 164,
              p20: 180,
            };
          } else if (type == '달') {
            // 달 - 강철의 흔적, 치명적인 흔적
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
        // 혼돈의 별
        if (tier == 0) {
          // 무기 TODO 무공
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
        } // TODO 생명
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
