import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const ZIP_PATH = '/tmp/cities15000.zip';
const ADMIN1_PATH = '/tmp/admin1CodesASCII.txt';
const OUT_DIR = path.join(ROOT, 'src/lib/africa-city-data');
const COUNTRIES_DIR = path.join(OUT_DIR, 'countries');

const AFRICAN_CODES = new Set([
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG',
  'GQ','ER','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR',
  'MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ',
  'TG','TN','UG','ZM','ZW',
]);

const admin1Map = new Map();
for (const line of fs.readFileSync(ADMIN1_PATH, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const [compound, name] = line.split('\t');
  if (!compound || !name) continue;
  admin1Map.set(compound, name);
}

const raw = execFileSync('unzip', ['-p', ZIP_PATH], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
const grouped = {};

for (const line of raw.split('\n')) {
  if (!line.trim()) continue;
  const parts = line.split('\t');
  const countryCode = parts[8];
  if (!AFRICAN_CODES.has(countryCode)) continue;

  const featureClass = parts[6];
  if (featureClass !== 'P') continue;

  const name = parts[2] || parts[1];
  const admin1Code = parts[10];
  const population = Number(parts[14] || '0');
  if (!name || !admin1Code || population < 15000) continue;

  const admin1Name = admin1Map.get(`${countryCode}.${admin1Code}`) || admin1Code;

  grouped[countryCode] ??= {};
  grouped[countryCode][admin1Name] ??= new Set();
  grouped[countryCode][admin1Name].add(name);
}

const output = {};
for (const [countryCode, subdivisions] of Object.entries(grouped)) {
  output[countryCode] = {};
  for (const [admin1Name, cities] of Object.entries(subdivisions)) {
    output[countryCode][admin1Name] = [...cities].sort((a, b) => a.localeCompare(b));
  }
}

fs.mkdirSync(COUNTRIES_DIR, { recursive: true });

const codes = Object.keys(output).sort();
for (const code of codes) {
  const countryPath = path.join(COUNTRIES_DIR, `${code}.ts`);
  fs.writeFileSync(countryPath, `export default ${JSON.stringify(output[code], null, 2)} as const;\n`);
}

const loaderLines = codes.map((code) => `  ${JSON.stringify(code)}: () => import('./countries/${code}'),`).join('\n');
const indexContents = `export type AfricaCountryCityMap = Record<string, string[]>;\n\nconst loaders = {\n${loaderLines}\n} as const;\n\nexport async function loadAfricaCountryCities(countryCode: string): Promise<AfricaCountryCityMap | null> {\n  const loader = loaders[countryCode as keyof typeof loaders];\n  if (!loader) return null;\n  const mod = await loader();\n  return mod.default as unknown as AfricaCountryCityMap;\n}\n\nexport const AFRICA_CITY_DATA_COUNTRIES = ${JSON.stringify(codes)} as const;\n`;

fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), indexContents);
console.log(`Wrote ${codes.length} country files to ${COUNTRIES_DIR}`);
