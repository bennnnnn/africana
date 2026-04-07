export type AfricaCountryCityMap = Record<string, string[]>;

const loaders = {
  "AO": () => import('./countries/AO'),
  "BF": () => import('./countries/BF'),
  "BI": () => import('./countries/BI'),
  "BJ": () => import('./countries/BJ'),
  "BW": () => import('./countries/BW'),
  "CD": () => import('./countries/CD'),
  "CF": () => import('./countries/CF'),
  "CG": () => import('./countries/CG'),
  "CI": () => import('./countries/CI'),
  "CM": () => import('./countries/CM'),
  "CV": () => import('./countries/CV'),
  "DJ": () => import('./countries/DJ'),
  "DZ": () => import('./countries/DZ'),
  "EG": () => import('./countries/EG'),
  "ER": () => import('./countries/ER'),
  "ET": () => import('./countries/ET'),
  "GA": () => import('./countries/GA'),
  "GH": () => import('./countries/GH'),
  "GM": () => import('./countries/GM'),
  "GN": () => import('./countries/GN'),
  "GQ": () => import('./countries/GQ'),
  "GW": () => import('./countries/GW'),
  "KE": () => import('./countries/KE'),
  "KM": () => import('./countries/KM'),
  "LR": () => import('./countries/LR'),
  "LS": () => import('./countries/LS'),
  "LY": () => import('./countries/LY'),
  "MA": () => import('./countries/MA'),
  "MG": () => import('./countries/MG'),
  "ML": () => import('./countries/ML'),
  "MR": () => import('./countries/MR'),
  "MU": () => import('./countries/MU'),
  "MW": () => import('./countries/MW'),
  "MZ": () => import('./countries/MZ'),
  "NA": () => import('./countries/NA'),
  "NE": () => import('./countries/NE'),
  "NG": () => import('./countries/NG'),
  "RW": () => import('./countries/RW'),
  "SC": () => import('./countries/SC'),
  "SD": () => import('./countries/SD'),
  "SL": () => import('./countries/SL'),
  "SN": () => import('./countries/SN'),
  "SO": () => import('./countries/SO'),
  "SS": () => import('./countries/SS'),
  "ST": () => import('./countries/ST'),
  "TD": () => import('./countries/TD'),
  "TG": () => import('./countries/TG'),
  "TN": () => import('./countries/TN'),
  "TZ": () => import('./countries/TZ'),
  "UG": () => import('./countries/UG'),
  "ZA": () => import('./countries/ZA'),
  "ZM": () => import('./countries/ZM'),
  "ZW": () => import('./countries/ZW'),
} as const;

export async function loadAfricaCountryCities(countryCode: string): Promise<AfricaCountryCityMap | null> {
  const loader = loaders[countryCode as keyof typeof loaders];
  if (!loader) return null;
  const mod = await loader();
  return mod.default as unknown as AfricaCountryCityMap;
}

export const AFRICA_CITY_DATA_COUNTRIES = ["AO","BF","BI","BJ","BW","CD","CF","CG","CI","CM","CV","DJ","DZ","EG","ER","ET","GA","GH","GM","GN","GQ","GW","KE","KM","LR","LS","LY","MA","MG","ML","MR","MU","MW","MZ","NA","NE","NG","RW","SC","SD","SL","SN","SO","SS","ST","TD","TG","TN","TZ","UG","ZA","ZM","ZW"] as const;
