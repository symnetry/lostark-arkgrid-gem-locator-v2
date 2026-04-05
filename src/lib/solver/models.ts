export class Core {
  constructor(
    public energy: number,
    public point: number,
    public coeff: number[]
  ) {}
}

export class Gem {
  constructor(
    public index: bigint,
    public req: number,
    public point: number,
    public att: number,
    public skill: number,
    public boss: number
  ) {}
}

export function buildScoreMap(coeff: number, maxLevel: number) {
  const result: [number, number][] = [];
  for (let v = 0; v <= maxLevel; v++) {
    let minScore = 100;
    let maxScore = 0;

    // ✅ #6: 预先计算上限以减少循环开销
    const limit = maxLevel - v;
    for (let base = 0; base <= limit; base++) {
      const coeffAfter = Math.floor(((base + v) * coeff) / 120) + 10000;
      const coeffBefore = Math.floor((base * coeff) / 120) + 10000;

      const upgradeValue = coeffAfter / coeffBefore;
      if (upgradeValue > maxScore) {
        maxScore = upgradeValue;
      }
      if (upgradeValue < minScore) {
        minScore = upgradeValue;
      }
    }
    result[v] = [minScore, maxScore];
  }
  return result;
}

export class GemSet {
  // 核心装备护石的状态
  att: number;
  skill: number;
  boss: number;
  point: number;
  bitmask: bigint;
  coreCoeff: number;
  core: Core;
  maxScore: number;
  minScore: number;
  constructor(gems: Gem[], core: Core) {
    this.att = 0;
    this.skill = 0;
    this.boss = 0;
    this.point = 0;

    this.bitmask = 0n;
    for (const gem of gems) {
      this.bitmask |= 1n << gem.index;
      this.att += gem.att;
      this.skill += gem.skill;
      this.boss += gem.boss;
      this.point += gem.point;
    }
    this.coreCoeff = core.coeff[this.point];
    if (this.coreCoeff == undefined) {
      throw Error('Core coeffient is incorrect.');
    }
    this.core = core;
    this.minScore = -1;
    this.maxScore = -1;
  }
  setScoreRange(scoreMaps: [number, number][][]) {
    // 如果知道所有系统能获得的最大攻击力、追加伤害、Boss伤害，
    // 就能限定该GemSet能获得的战斗力范围。
    const coreScore = (this.coreCoeff + 10000) / 10000;

    // 전투력 증가 최대치
    this.maxScore =
      coreScore *
      scoreMaps[0][this.att][1] *
      scoreMaps[1][this.skill][1] *
      scoreMaps[2][this.boss][1];

    // 전투력 증가 최소치
    this.minScore =
      coreScore *
      scoreMaps[0][this.att][0] *
      scoreMaps[1][this.skill][0] *
      scoreMaps[2][this.boss][0];

    if (this.maxScore < this.minScore) {
      console.log(this);
      throw Error(`${this.maxScore}小于${this.minScore}。`);
    }
  }
}
export class GemSetPack {
  // 分配给秩序或混沌3个核心的3个GemSet
  att: number;
  skill: number;
  boss: number;
  coreScore: number;
  minScore: number;
  maxScore: number;
  constructor(
    public gs1: GemSet | null,
    public gs2: GemSet | null,
    public gs3: GemSet | null,
    scoreMaps: [number, number][][]
  ) {
    this.att = (gs1?.att ?? 0) + (gs2?.att ?? 0) + (gs3?.att ?? 0);
    this.skill = (gs1?.skill ?? 0) + (gs2?.skill ?? 0) + (gs3?.skill ?? 0);
    this.boss = (gs1?.boss ?? 0) + (gs2?.boss ?? 0) + (gs3?.boss ?? 0);

    this.coreScore =
      ((((((gs1?.coreCoeff ?? 0) + 10000) / 10000) * ((gs2?.coreCoeff ?? 0) + 10000)) / 10000) *
        ((gs3?.coreCoeff ?? 0) + 10000)) /
      10000;

    // 전투력 증가 최대치
    this.maxScore =
      this.coreScore *
      scoreMaps[0][this.att][1] *
      scoreMaps[1][this.skill][1] *
      scoreMaps[2][this.boss][1];

    // 전투력 증가 최소치
    this.minScore =
      this.coreScore *
      scoreMaps[0][this.att][0] *
      scoreMaps[1][this.skill][0] *
      scoreMaps[2][this.boss][0];

    // if (this.maxScore < this.minScore) {
    //   console.log(this);
    //   throw Error(`${this.maxScore}小于${this.minScore}。`);
    // }
  }
}

export const gemOptionLevelCoeffs = [400, 700, 1000]; // 攻击力, 追加伤害, Boss伤害
export const gemOptionLevelCoeffsSupporter = [600, 1050, 1500]; // 追加伤害强化, 烙印力, 友军攻击强化

export class GemSetPackTuple {
  // 两个GemSetPack，即一个完整的方舟棋盘
  att: number;
  skill: number;
  boss: number;
  score: number;
  constructor(
    public gsp1: GemSetPack | null,
    public gsp2: GemSetPack | null,
    public isSupporter: boolean
  ) {
    this.att = (gsp1?.att ?? 0) + (gsp2?.att ?? 0);
    this.skill = (gsp1?.skill ?? 0) + (gsp2?.skill ?? 0);
    this.boss = (gsp1?.boss ?? 0) + (gsp2?.boss ?? 0);
    const coeffs = isSupporter ? gemOptionLevelCoeffsSupporter : gemOptionLevelCoeffs;
    this.score =
      ((((((gsp1?.coreScore ?? 1) *
        (gsp2?.coreScore ?? 1) *
        (Math.floor((this.att * coeffs[0]) / 120) + 10000)) /
        10000) *
        (Math.floor((this.skill * coeffs[1]) / 120) + 10000)) /
        10000) *
        (Math.floor((this.boss * coeffs[2]) / 120) + 10000)) /
      10000;
  }
}
