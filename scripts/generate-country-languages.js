const fs = require('fs');
const path = require('path');

const inputPath = path.join(process.cwd(), 'data/cldr/supplementalData.xml');
const outputDir = path.join(process.cwd(), 'src/lib/cultural-data/generated');
const REGION_CODES = {
  east_africa: ['ET', 'KE', 'TZ', 'UG', 'RW', 'BI', 'SO', 'ER', 'DJ', 'MG', 'SS', 'KM', 'SC', 'MU'],
  west_africa: ['NG', 'GH', 'SN', 'CI', 'SL', 'LR', 'GN', 'ML', 'BF', 'GW', 'GM', 'CV', 'TG', 'BJ', 'NE', 'MR', 'ST', 'CM'],
  central_africa: ['CD', 'CG', 'CF', 'TD', 'GA', 'GQ'],
  north_africa: ['EG', 'MA', 'DZ', 'TN', 'LY', 'SD'],
  southern_africa: ['ZA', 'ZW', 'ZM', 'MZ', 'AO', 'BW', 'NA', 'MW', 'LS', 'SZ'],
};

const xml = fs.readFileSync(inputPath, 'utf8');
const output = {};

const territoryRegex = /<territory type="([A-Z]{2})"[^>]*>([\s\S]*?)<\/territory>/g;
let territoryMatch;

while ((territoryMatch = territoryRegex.exec(xml))) {
  const countryCode = territoryMatch[1];
  const body = territoryMatch[2];
  const languageEntries = [];

  const languageRegex = /<languagePopulation\s+type="([^"]+)"([^/>]*?)\/?>\s*<!--([^>]*)-->/g;
  let languageMatch;

  while ((languageMatch = languageRegex.exec(body))) {
    const type = languageMatch[1];
    const attrs = languageMatch[2] || '';
    const comment = (languageMatch[3] || '').trim();
    if (type === 'und') continue;

    const isOfficial = /officialStatus="([^"]+)"/.test(attrs);
    const percentMatch = attrs.match(/populationPercent="([^"]+)"/);
    const percent = percentMatch ? parseFloat(percentMatch[1]) : 0;

    if (!isOfficial && !(percent >= 1)) continue;

    const cleanedName = (comment || type)
      .replace(/\s*\([^)]*\)\s*/g, '')
      .trim();

    if (!cleanedName) continue;
    languageEntries.push({ cleanedName, isOfficial, percent });
  }

  if (languageEntries.length === 0) continue;

  languageEntries.sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return Number(b.isOfficial) - Number(a.isOfficial);
    return b.percent - a.percent;
  });

  output[countryCode] = Array.from(new Set(languageEntries.map((entry) => entry.cleanedName)));
}

fs.mkdirSync(outputDir, { recursive: true });

for (const [region, countryCodes] of Object.entries(REGION_CODES)) {
  const regionalOutput = Object.fromEntries(
    countryCodes
      .filter((countryCode) => output[countryCode])
      .map((countryCode) => [countryCode, output[countryCode]])
  );

  const outputPath = path.join(outputDir, `${region}-languages.generated.ts`);
  fs.writeFileSync(
    outputPath,
    `export const COUNTRY_LANGUAGE_MAP = ${JSON.stringify(regionalOutput, null, 2)} as const;\n`
  );
}

console.log('Generated regional African language maps.');
