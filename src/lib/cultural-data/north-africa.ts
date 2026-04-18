import { CountryCultureData } from './types';

export const NORTH_AFRICA_CULTURE: Record<string, CountryCultureData> = {
  EG: {
    ethnicities: ['Egyptian Arab', 'Coptic', 'Nubian', 'Bedouin', 'Beja', 'Saidi', 'Alexandrian / Mediterranean', 'Mixed / Other'],
    languages: ['Arabic', 'Egyptian Arabic', 'English', 'Coptic'],
    ethnicityLanguages: {
      'Egyptian Arab': ['Egyptian Arabic', 'Arabic', 'English'],
      Coptic: ['Coptic', 'Arabic', 'English'],
      Nubian: ['Arabic', 'English'],
    },
  },
  MA: {
    ethnicities: ['Arab-Berber', 'Amazigh (Berber)', 'Haratin', 'Jewish heritage', 'Sahrawi', 'Mixed / Other'],
    languages: ['Arabic', 'French', 'Central Atlas Tamazight', 'Moroccan Arabic', 'Standard Moroccan Tamazight', 'English', 'Tachelhit', 'Riffian'],
    ethnicityLanguages: {
      'Arab-Berber': ['Moroccan Arabic', 'Arabic', 'French'],
      'Amazigh (Berber)': ['Tachelhit', 'Riffian', 'Central Atlas Tamazight', 'Standard Moroccan Tamazight', 'Arabic', 'French'],
    },
  },
  DZ: {
    ethnicities: ['Arab', 'Kabyle', 'Chaoui', 'Mzab', 'Tuareg', 'European Algerian', 'Mixed / Other'],
    languages: ['Arabic', 'French', 'Algerian Arabic', 'Hassaniyya', 'Kabyle', 'English'],
    ethnicityLanguages: {
      Arab: ['Algerian Arabic', 'Arabic', 'French'],
      Kabyle: ['Kabyle', 'Arabic', 'French'],
      Tuareg: ['Hassaniyya', 'Arabic'],
    },
  },
  TN: {
    ethnicities: ['Tunisian Arab', 'Amazigh', 'Jewish heritage', 'European Tunisian', 'Mixed / Other'],
    languages: ['Arabic', 'French', 'Tunisian Arabic'],
    ethnicityLanguages: {
      'Tunisian Arab': ['Tunisian Arabic', 'Arabic', 'French'],
      Amazigh: ['Arabic', 'French'],
    },
  },
  LY: {
    ethnicities: ['Arab Libyan', 'Amazigh', 'Tuareg', 'Tebu', 'Mixed / Other'],
    languages: ['Arabic'],
    ethnicityLanguages: {
      'Arab Libyan': ['Arabic'],
      Amazigh: ['Arabic'],
      Tuareg: ['Arabic'],
    },
  },
  SD: {
    ethnicities: ['Arab Sudanese', 'Nuba', 'Beja', 'Fur', 'Nilotic', 'Hausa', 'Mixed / Other'],
    languages: ['Arabic', 'English', 'Sudanese Arabic', 'Beja', 'Fur', 'Hausa'],
    ethnicityLanguages: {
      'Arab Sudanese': ['Sudanese Arabic', 'Arabic', 'English'],
      Beja: ['Beja', 'Arabic', 'English'],
      Fur: ['Fur', 'Arabic', 'English'],
      Hausa: ['Hausa', 'Arabic', 'English'],
    },
  },
};
