// scripts/generate-openapi.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const SPEC_URL = 'https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories';

const OPENAPI_DIR = path.resolve(__dirname, '../openapi');
const SPEC_PATH = path.join(OPENAPI_DIR, 'lostark-armories.json');
const OUTPUT_DIR = path.resolve(__dirname, '../src/lib/openapi');

async function downloadSpec() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(OPENAPI_DIR)) {
      fs.mkdirSync(OPENAPI_DIR, { recursive: true });
    }

    const file = fs.createWriteStream(SPEC_PATH);

    https
      .get(SPEC_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download spec: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', reject);
  });
}

function generateApi() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  execSync(
    `npx swagger-typescript-api generate \
      --path "${SPEC_PATH}" \
      --output "${OUTPUT_DIR}" \
      --name "lostark.ts"`,
    { stdio: 'inherit' }
  );
}

function runPrettier() {
  execSync(`npx prettier --write "${OUTPUT_DIR}"`, {
    stdio: 'inherit',
  });
}

(async () => {
  try {
    console.log('📥 Downloading OpenAPI spec...');
    await downloadSpec();

    console.log('⚙️ Generating TypeScript API...');
    generateApi();

    console.log('✨ Running Prettier...');
    runPrettier();

    console.log('✅ Done!');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
