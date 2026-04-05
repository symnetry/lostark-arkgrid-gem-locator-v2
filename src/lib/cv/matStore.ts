/**
 * 一次性获取精灵图 → 生成 cv.Mat
 */
import {
  type ArkGridAttr,
  type GemRecognitionLocale,
  supportedGemRecognitionLocales,
} from '../constants/enums';
import { type ArkGridGemName, type ArkGridGemOptionName } from '../models/arkGridGems';
import { type EnUsTemplateName, enUsCoords, enUsFileName } from '../opencv-template-coords/en_us';
import { type KoKrTemplateName, koKrCoords, koKrFileName } from '../opencv-template-coords/ko_kr';
import { type RuCnTemplateName, ruCnCoords, ruCnFileName } from '../opencv-template-coords/ru_cn';
import { type RuRuTemplateName, ruRuCoords, ruRuFileName } from '../opencv-template-coords/ru_ru';
import { type ZhCnTemplateName, zhCnCoords, zhCnFileName } from '../opencv-template-coords/zh_cn';
import { type MatchingAtlas, generateMatchingAtlas } from './atlas';
import { getCv } from './cvRuntime';
import type { CvMat } from './types';

export type KeyWillPower = '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type KeyCorePoint = '1' | '2' | '3' | '4' | '5';
export type KeyOptionString = ArkGridGemOptionName;
export type KeyOptionLevel = '1' | '2' | '3' | '4' | '5';
export type KeyGemAttr = ArkGridAttr;
export type KeyGemName = ArkGridGemName;

type TemplateCoordMap = Record<string, { x: number; y: number; w: number; h: number }>;

async function fetchSpriteMat(url: string): Promise<CvMat> {
  // 读取url图片后转换为Mat
  const cv = getCv();
  const img = await createImageBitmap(await fetch(url).then((r) => r.blob()));
  const off = new OffscreenCanvas(img.width, img.height);
  const ctx = off.getContext('2d');
  if (!ctx) throw new Error('Canvas context creation failed');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const mat = cv.matFromImageData(data);
  cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY);
  img.close();
  return mat;
}

type GemTemplates = {
  ko_kr: Record<KoKrTemplateName, CvMat>;
  en_us: Record<EnUsTemplateName, CvMat>;
  ru_ru: Record<RuRuTemplateName, CvMat>;
  ru_cn: Record<RuCnTemplateName, CvMat>;
  zh_cn: Record<ZhCnTemplateName, CvMat>;
};
async function loadLocaleTemplates<TTemplateName extends string>(
  fileName: string,
  coords: Record<TTemplateName, { x: number; y: number; w: number; h: number }>
): Promise<Record<TTemplateName, CvMat>> {
  const cv = getCv();
  const sprite = await fetchSpriteMat(`${import.meta.env.BASE_URL}/${fileName}`);
  const templates = {} as Record<TTemplateName, CvMat>;

  for (const [name, rect] of Object.entries(coords) as [TTemplateName, TemplateCoordMap[string]][]) {
    templates[name] = sprite.roi(new cv.Rect(rect.x, rect.y, rect.w, rect.h));
  }

  sprite.delete();
  return templates;
}

async function loadGemTemplates(): Promise<GemTemplates> {
  return {
    ko_kr: await loadLocaleTemplates(koKrFileName, koKrCoords),
    en_us: await loadLocaleTemplates(enUsFileName, enUsCoords),
    ru_ru: await loadLocaleTemplates(ruRuFileName, ruRuCoords),
    ru_cn: await loadLocaleTemplates(ruCnFileName, ruCnCoords),
    zh_cn: await loadLocaleTemplates(zhCnFileName, zhCnCoords),
  };
}

function generateSingleMatchingAtlas<K extends string>(key: K, mat: CvMat): MatchingAtlas<K> {
  return generateMatchingAtlas({ [key]: mat } as Record<K, CvMat>);
}

export async function loadGemAsset() {
  const gt = await loadGemTemplates();

  const atlasAnchorByLocale = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      acc[locale] = generateSingleMatchingAtlas(locale, gt[locale]['anchor.png']);
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<GemRecognitionLocale>>
  );

  const atlasGemAttr = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        질서: mats['질서.png'],
        혼돈: mats['혼돈.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<ArkGridAttr>>
  );

  const atlasWillPower = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        3: mats['3.png'],
        4: mats['4.png'],
        5: mats['5.png'],
        6: mats['6.png'],
        7: mats['7.png'],
        8: mats['8.png'],
        9: mats['9.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyWillPower>>
  );

  const atlasCorePoint = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        1: mats['1.png'],
        2: mats['2.png'],
        3: mats['3.png'],
        4: mats['4.png'],
        5: mats['5.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyCorePoint>>
  );

  const altasGemImage = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        '질서의 젬 : 안정': mats['안정.png'],
        '질서의 젬 : 견고': mats['견고.png'],
        '질서의 젬 : 불변': mats['불변.png'],
        '혼돈의 젬 : 침식': mats['침식.png'],
        '혼돈의 젬 : 왜곡': mats['왜곡.png'],
        '혼돈의 젬 : 붕괴': mats['붕괴.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyGemName>>
  );

  const atlasOptionName = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        공격력: mats['공격력.png'],
        '추가 피해': mats['추가피해.png'],
        '보스 피해': mats['보스피해.png'],
        낙인력: mats['낙인력.png'],
        '아군 공격 강화': mats['아군공격강화.png'],
        '아군 피해 강화': mats['아군피해강화.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyOptionString>>
  );

  const atlasOptionLevel = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        1: mats['lv1.png'],
        2: mats['lv2.png'],
        3: mats['lv3.png'],
        4: mats['lv4.png'],
        5: mats['lv5.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyOptionLevel>>
  );

  return {
    atlasAnchorByLocale,
    atlasGemAttr,
    altasGemImage,
    atlasWillPower,
    atlasCorePoint,
    atlasOptionName,
    atlasOptionLevel,
  };
}
