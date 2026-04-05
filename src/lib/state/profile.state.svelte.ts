import { persistedState } from 'svelte-persisted-state';

import {
  type ArkGridAttr,
  ArkGridAttrs,
  DEFAULT_PROFILE_NAME,
  LostArkGrades,
} from '../constants/enums';
import {
  type ArkGridCore,
  type ArkGridCoreType,
  ArkGridCoreTypes,
  createCore,
} from '../models/arkGridCores';
import { type ArkGridGem, determineGemGrade } from '../models/arkGridGems';
import type { GemSetPackTuple } from '../solver/models';
import { addNewProfile, appConfig, getProfile, initArkGridCores } from './appConfig.state.svelte';

export let currentProfileName = persistedState<string>('currentProfileName', DEFAULT_PROFILE_NAME);
export interface AllGems {
  orderGems: ArkGridGem[];
  chaosGems: ArkGridGem[];
}
export type WeaponInfo = {
  fixed: number;
  percent: number;
};
export interface CharacterProfile {
  characterName: string;
  gems: AllGems;
  cores: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;
  isSupporter: boolean;
  weapon?: WeaponInfo;
  solveInfo: SolveInfo;
}

// 结果

// 准备物品
export type SolveBefore = {
  coreGoalPoint: number[]; // not used
};

// 优化结果
export type SolveAnswerScoreSet = {
  score: number;
  bestScore: number;
  perfectScore: number;
};
export type SolveAnswer = {
  assignedGems: ArkGridGem[][];
  gemSetPackTuple: GemSetPackTuple;
};
export type AdditionalGemResult = Record<
  ArkGridAttr,
  Record<
    string, // 如10,17,17这样将corePointTuple转为字符串
    {
      corePointTuple: [number, number, number];
      gems: ArkGridGem[];
      score: number;
    }
  >
>;
export type NeedLauncherGem = Record<ArkGridAttr, boolean>;
export type SolveAfter = {
  solveAnswer?: SolveAnswer;
  scoreSet?: SolveAnswerScoreSet;
  answerCores?: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;
  additionalGemResult?: AdditionalGemResult;
  needLauncherGem?: NeedLauncherGem;
};
export type SolveInfo = {
  before: SolveBefore;
  after?: SolveAfter;
};
export function updateSolveAnswer(solveAnswer: SolveAnswer) {
  // 设置当前profile的solve after中的solve answer
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      solveAnswer: solveAnswer,
    };
  } else {
    profile.solveInfo.after.solveAnswer = solveAnswer;
  }
}

export function updateScoreSet(scoreSet: SolveAnswerScoreSet) {
  // 设置当前profile的solve after中的score set
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      scoreSet: scoreSet,
    };
  } else {
    profile.solveInfo.after.scoreSet = scoreSet;
  }
}

export function updateAnswerCores(
  cores: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>
) {
  // 设置当前profile的solve after中的answer core
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      answerCores: cores,
    };
  } else {
    profile.solveInfo.after.answerCores = cores;
  }
}

export function updateAdditionalGemResult(additionalGemResult: AdditionalGemResult) {
  // 设置当前profile的solve after中的additionalGemResult
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      additionalGemResult: additionalGemResult,
    };
  } else {
    profile.solveInfo.after.additionalGemResult = additionalGemResult;
  }
}

export function updateNeedLauncherGem(needLauncherGem: NeedLauncherGem) {
  // 设置当前profile的solve after中的needLauncherGem
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      needLauncherGem: needLauncherGem,
    };
  } else {
    profile.solveInfo.after.needLauncherGem = needLauncherGem;
  }
}

export function initNewProfile(name: string): CharacterProfile {
  return {
    characterName: name,
    gems: {
      orderGems: [],
      chaosGems: [],
    },
    cores: initArkGridCores(),
    isSupporter: false,
    solveInfo: {
      before: {
        coreGoalPoint: [0, 0, 0, 0, 0, 0],
      },
    },
  };
}

export function migrateProfile(profile: Partial<CharacterProfile>) {
  // 添加更新中新增的required字段

  // 1. profile.isSupporter
  if (profile.isSupporter === undefined) {
    // console.log("isSupporter未定义，添加！")
    profile.isSupporter = false;
  }
  // 2. profile.solveInfo
  if (profile.solveInfo === undefined) {
    // console.log(profile, "添加solveInfo！")
    profile.solveInfo = {
      before: { coreGoalPoint: [0, 0, 0, 0, 0, 0] },
    };
  }

  // 3. core.goalPoint
  for (const attr of Object.values(ArkGridAttrs)) {
    for (const ctype of Object.values(ArkGridCoreTypes)) {
      if (profile.cores) {
        // 虽然应该有...
        const core = profile.cores[attr][ctype];
        if (core && core.goalPoint === undefined) {
          // console.log(core, "添加goalpoint！")
          core.goalPoint = 0;
        }
      }
    }
  }
}

export function getCurrentProfile() {
  // 必须返回当前profile。
  // 找到profile则返回
  const profile = getProfile(currentProfileName.current);
  if (profile) return profile;
  else {
    // 找到默认profile则更换并返回
    const defaultProfile = getProfile(DEFAULT_PROFILE_NAME);
    setCurrentProfileName(DEFAULT_PROFILE_NAME);
    if (defaultProfile) return defaultProfile;

    // 没有默认profile则创建后返回
    const newDefaultProfile = initNewProfile(DEFAULT_PROFILE_NAME);
    if (!addNewProfile(newDefaultProfile)) {
      throw Error('默认profile创建失败！');
    }
    return newDefaultProfile;
  }
}

export function setCurrentProfileName(name: string) {
  currentProfileName.current = name;
}

export function deleteProfile(name: string) {
  if (name === DEFAULT_PROFILE_NAME) return;
  const profiles = appConfig.current.characterProfiles;
  const index = profiles.findIndex((p) => p.characterName === name);

  if (index === -1) return;
  if (currentProfileName.current === name) {
    setCurrentProfileName(profiles[index - 1].characterName);
  }
  profiles.splice(index, 1);
  // 删除的profile是当前选中的profile则初始化
}

export function updateProfileCharacterName(name: string) {
  // 修改当前profile的名字。
  const existProfile = appConfig.current.characterProfiles.findIndex(
    (p) => p.characterName === name
  );
  if (existProfile != -1) return false;
  const profile = getCurrentProfile();
  profile.characterName = name;
}

export function addGem(gem: ArkGridGem) {
  const gems = getCurrentProfile().gems;
  const targetGems = gem.gemAttr == '질서' ? gems.orderGems : gems.chaosGems;
  gem.grade = determineGemGrade(gem.req, gem.point, gem.option1, gem.option2, gem.name);
  // 验证gem（稳定但有选项等）
  targetGems.push(gem);
}

export function clearGems(gemAttr?: ArkGridAttr) {
  const gems = getCurrentProfile().gems;
  switch (gemAttr) {
    case '질서':
      gems.orderGems.length = 0;
      break;
    case '혼돈':
      gems.chaosGems.length = 0;
      break;
    default:
      gems.orderGems.length = 0;
      gems.chaosGems.length = 0;
  }
}

export function deleteGem(gem: ArkGridGem) {
  const gems = getCurrentProfile().gems;
  const targetGems = gem.gemAttr === '질서' ? gems.orderGems : gems.chaosGems;

  // 배열에서 gem 제거
  const index = targetGems.indexOf(gem);
  if (index !== -1) {
    targetGems.splice(index, 1);
  }
}
export function unassignGems() {
  const gems = getCurrentProfile().gems;
  gems.orderGems.forEach((g) => {
    delete g.assign;
  });
  gems.chaosGems.forEach((g) => {
    delete g.assign;
  });
}

export function getCore(attr: ArkGridAttr, ctype: ArkGridCoreType) {
  const cores = getCurrentProfile().cores;
  return cores[attr][ctype];
}
export function addCore(attr: ArkGridAttr, ctype: ArkGridCoreType, isSupporter: boolean) {
  const profile = getCurrentProfile();
  const cores = profile.cores;
  cores[attr][ctype] = createCore(attr, ctype, '영웅', isSupporter, profile.weapon);
}
export function resetCore(attr: ArkGridAttr, ctype: ArkGridCoreType) {
  const cores = getCurrentProfile().cores;
  cores[attr][ctype] = null;
}
export function clearCores() {
  const cores = getCurrentProfile().cores;
  for (const attr of Object.values(ArkGridAttrs)) {
    for (const ctype of Object.values(ArkGridCoreTypes)) {
      cores[attr][ctype] = null;
    }
  }
}
export function updateCore(attr: ArkGridAttr, ctype: ArkGridCoreType, core: ArkGridCore) {
  const cores = getCurrentProfile().cores;
  cores[attr][ctype] = JSON.parse(JSON.stringify(core));
}

export function updateIsSupporter(v: boolean) {
  const profile = getCurrentProfile();
  profile.isSupporter = v;
}

export function updateWeapon(fixed: number, percent: number) {
  const profile = getCurrentProfile();
  profile.weapon = {
    fixed,
    percent,
  };
}

export const roleImages = import.meta.glob<string>('/src/assets/role/*.webp', {
  eager: true,
  import: 'default',
});
export const imgRoleCombat = roleImages['/src/assets/role/combat.webp'];
export const imgRoleSupporter = roleImages['/src/assets/role/supporter.webp'];
