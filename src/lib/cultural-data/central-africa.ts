import { CountryCultureData } from './types';

export const CENTRAL_AFRICA_CULTURE: Record<string, CountryCultureData> = {
  CD: {
    ethnicities: ['Luba', 'Mongo', 'Kongo', 'Lingala', 'Hunde', 'Nande', 'Tetela', 'Mixed / Other'],
    languages: ['French', 'Swahili', 'Luba-Lulua', 'Lingala', 'Kongo', 'Luba-Katanga'],
    ethnicityLanguages: {
      Luba: ['Luba-Lulua', 'Luba-Katanga', 'French'],
      Mongo: ['French'],
      Kongo: ['Kongo', 'French'],
      Lingala: ['Lingala', 'French'],
    },
  },
  CG: {
    ethnicities: ['Kongo', 'Teke', 'Mbochi', 'Sangha', 'Mixed / Other'],
    languages: ['French', 'Lingala'],
    ethnicityLanguages: {
      Kongo: ['Lingala', 'French'],
      Teke: ['French'],
      Mbochi: ['French'],
    },
  },
  CF: {
    ethnicities: ['Baya', 'Banda', 'Sara', 'Mandjia', 'Mboum', 'Arab-Chadian', 'Mixed / Other'],
    languages: ['Sango', 'French'],
    ethnicityLanguages: {
      Baya: ['Sango', 'French'],
      Banda: ['Sango', 'French'],
      Sara: ['French'],
    },
  },
  TD: {
    ethnicities: ['Sara', 'Arab', 'Kanembu', 'Hadjarai', 'Toubou', 'Zaghawa', 'Gorane', 'Mixed / Other'],
    languages: ['Arabic', 'French'],
    ethnicityLanguages: {
      Sara: ['French'],
      Arab: ['Arabic', 'French'],
      Toubou: ['Arabic', 'French'],
    },
  },
  GA: {
    ethnicities: ['Fang', 'Punu', 'Nzebi', 'Obamba', 'Mixed / Other'],
    languages: ['French', 'Punu'],
    ethnicityLanguages: {
      Fang: ['French'],
      Punu: ['Punu', 'French'],
    },
  },
  GQ: {
    ethnicities: ['Fang', 'Bubi', 'Ndowe', 'Combe', 'Bujeba', 'Mixed / Other'],
    languages: ['Spanish', 'French', 'Portuguese', 'Fang', 'Bube'],
    ethnicityLanguages: {
      Fang: ['Fang', 'Spanish', 'French'],
      Bubi: ['Bube', 'Spanish'],
    },
  },
};
