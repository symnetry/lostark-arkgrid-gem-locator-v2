const fs = require('fs');
const path = require('path');
const Spritesmith = require('spritesmith');

const templateFolders = [
  { folder: './opencv-templates/en_us', lang: 'en_us' },
  { folder: './opencv-templates/ko_kr', lang: 'ko_kr' },
  { folder: './opencv-templates/ru_ru', lang: 'ru_ru' },
  { folder: './opencv-templates/ru_cn', lang: 'ru_cn' },
  { folder: './opencv-templates/zh_cn', lang: 'zh_cn' },
];

const publicDir = './public';
const tsOutputDir = './src/lib/opencv-template-coords';
const currentTimestamp = Date.now();

// TS output 폴더가 없으면 생성
if (!fs.existsSync(tsOutputDir)) fs.mkdirSync(tsOutputDir, { recursive: true });

// ✅ 기존 public 폴더에 있는 opencv_template_*.png 삭제
fs.readdirSync(publicDir)
  .filter((f) => f.startsWith('opencv_template_') && f.endsWith('.png'))
  .forEach((f) => {
    const filePath = path.join(publicDir, f);
    fs.unlinkSync(filePath);
    console.log(`Deleted old sprite: ${filePath}`);
  });

templateFolders.forEach(({ folder, lang }) => {
  const files = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith('.png'))
    .map((f) => path.join(folder, f));

  if (files.length === 0) {
    console.warn(`No PNG files found in ${folder}, skipping...`);
    return;
  }

  Spritesmith.run({ src: files, padding: 2 }, (err, result) => {
    if (err) {
      console.error(`Error generating sprite for ${lang}:`, err);
      return;
    }

    // 스프라이트 이미지 저장
    const fileNameWithTimestamp = `opencv_template_${lang}_${currentTimestamp}.png`;
    const spritePath = path.join(publicDir, fileNameWithTimestamp);
    fs.writeFileSync(spritePath, result.image);
    console.log(`Saved sprite: ${spritePath}`);

    // TS 파일 생성
    const tsPath = path.join(tsOutputDir, `${lang}.ts`);
    const tsContentLines = ['// THIS FILE IS AUTO-GENERATED. DO NOT MODIFY ITSELF'];

    // ko_kr을 변수명으로 쓰기 위해 koKr, KoKr로 변경
    const [localeLang, localeRegion] = lang.split('_');
    const prefix = localeLang + localeRegion.charAt(0).toUpperCase() + localeRegion.slice(1);
    const upperPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);

    tsContentLines.push(`export const ${prefix}Coords = {`);

    Object.entries(result.coordinates).forEach(([filePath, rect]) => {
      const fileName = path.basename(filePath);
      tsContentLines.push(
        `  '${fileName}': { x: ${rect.x}, y: ${rect.y}, w: ${rect.width}, h: ${rect.height} },`
      );
    });

    tsContentLines.push('} as const;\n');

    // TemplateName 타입 추가
    tsContentLines.push(`export type ${upperPrefix}TemplateName = keyof typeof ${prefix}Coords;\n`);
    tsContentLines.push(`export const ${prefix}FileName = '${fileNameWithTimestamp}';\n`);

    fs.writeFileSync(tsPath, tsContentLines.join('\n'));
    console.log(`Saved TS coords with type: ${tsPath}`);
  });
});
