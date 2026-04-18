import { CountryCultureData } from './types';

/** Culture-backed ethnicity & language hints (not exhaustive). Language names align with generated maps where possible. */
export const SOUTHERN_AFRICA_CULTURE: Record<string, CountryCultureData> = {
  ZA: {
    ethnicities: [
      'Zulu',
      'Xhosa',
      'Afrikaans',
      'Coloured',
      'Indian / South Asian',
      'English-speaking White',
      'Northern Sotho (Pedi)',
      'Southern Sotho',
      'Tswana',
      'Tsonga',
      'Swati',
      'Venda',
      'Ndebele',
      'Khoisan heritage',
      'Mixed / Other',
    ],
    languages: [
      'English',
      'Zulu',
      'Xhosa',
      'Afrikaans',
      'Northern Sotho',
      'Tswana',
      'Southern Sotho',
      'Tsonga',
      'Swati',
      'Venda',
      'South Ndebele',
      'Hindi',
    ],
    ethnicityLanguages: {
      Zulu: ['Zulu', 'English'],
      Xhosa: ['Xhosa', 'English'],
      Afrikaans: ['Afrikaans', 'English'],
      Coloured: ['Afrikaans', 'English'],
      'Indian / South Asian': ['English', 'Hindi'],
      'English-speaking White': ['English', 'Afrikaans'],
      'Northern Sotho (Pedi)': ['Northern Sotho', 'English'],
      'Southern Sotho': ['Southern Sotho', 'English'],
      Tswana: ['Tswana', 'English'],
      Tsonga: ['Tsonga', 'English'],
      Swati: ['Swati', 'English'],
      Venda: ['Venda', 'English'],
      Ndebele: ['South Ndebele', 'English', 'Zulu'],
    },
  },
  ZW: {
    ethnicities: ['Shona', 'Ndebele', 'White Zimbabwean', 'Coloured', 'Indian / South Asian', 'Tonga', 'Venda', 'Kalanga', 'Manyika', 'Ndau', 'Mixed / Other'],
    languages: ['Shona', 'English', 'North Ndebele', 'Manyika', 'Ndau', 'Kalanga', 'Nyanja'],
    ethnicityLanguages: {
      Shona: ['Shona', 'English'],
      Ndebele: ['North Ndebele', 'English'],
      Tonga: ['English'],
      Kalanga: ['Kalanga', 'English'],
      Manyika: ['Manyika', 'English'],
      Ndau: ['Ndau', 'English'],
    },
  },
  ZM: {
    ethnicities: ['Bemba', 'Tonga', 'Lozi', 'Lunda', 'Kaonde', 'Luvale', 'Nyanja (Chewa)', 'Nsenga', 'Lala-Bisa', 'Tumbuka', 'Mixed / Other'],
    languages: ['English', 'Bemba', 'Nyanja', 'Tonga [Zambia]', 'Lozi', 'Nsenga', 'Lala-Bisa', 'Tumbuka', 'Kaonde', 'Lunda', 'Luvale'],
    ethnicityLanguages: {
      Bemba: ['Bemba', 'English'],
      Tonga: ['Tonga [Zambia]', 'English'],
      Lozi: ['Lozi', 'English'],
      'Nyanja (Chewa)': ['Nyanja', 'English'],
      Tumbuka: ['Tumbuka', 'English'],
    },
  },
  MZ: {
    ethnicities: ['Makhuwa', 'Tsonga', 'Lomwe', 'Sena', 'Ndau', 'Makhuwa-Meetto', 'Ronga', 'Nyanja', 'Yao', 'Mixed / Other'],
    languages: ['Portuguese', 'Makhuwa', 'Ndau', 'Tsonga', 'Lomwe', 'Sena', 'Makhuwa-Meetto', 'Ronga', 'Nyanja', 'Yao'],
    ethnicityLanguages: {
      Makhuwa: ['Makhuwa', 'Portuguese'],
      Tsonga: ['Tsonga', 'Portuguese'],
      Lomwe: ['Lomwe', 'Portuguese'],
      Sena: ['Sena', 'Portuguese'],
    },
  },
  AO: {
    ethnicities: ['Ovimbundu', 'Kimbundu', 'Bakongo', 'Chokwe', 'Lunda', 'Nganguela', 'Ambundu', 'Mixed / Other'],
    languages: ['Portuguese', 'Umbundu', 'Kimbundu'],
    ethnicityLanguages: {
      Ovimbundu: ['Umbundu', 'Portuguese'],
      Kimbundu: ['Kimbundu', 'Portuguese'],
      Bakongo: ['Kimbundu', 'Portuguese'],
    },
  },
  BW: {
    ethnicities: ['Tswana', 'Kalanga', 'Basarwa', 'Herero', 'Mbukushu', 'Yei', 'Mixed / Other'],
    languages: ['English', 'Tswana'],
    ethnicityLanguages: {
      Tswana: ['Tswana', 'English'],
      Kalanga: ['English', 'Tswana'],
    },
  },
  NA: {
    ethnicities: ['Ovambo', 'Kavango', 'Herero', 'Damara', 'Nama', 'Caprivian', 'Coloured', 'White Namibian', 'San', 'Mixed / Other'],
    languages: ['English', 'Afrikaans', 'Kuanyama', 'Ndonga', 'Nama', 'Herero'],
    ethnicityLanguages: {
      Ovambo: ['Kuanyama', 'Ndonga', 'English'],
      Herero: ['Herero', 'English'],
      Nama: ['Nama', 'English'],
    },
  },
  MW: {
    ethnicities: ['Chewa (Nyanja)', 'Lomwe', 'Yao', 'Tumbuka', 'Sena', 'Tonga', 'Ngoni', 'Mixed / Other'],
    languages: ['English', 'Nyanja', 'Tumbuka'],
    ethnicityLanguages: {
      'Chewa (Nyanja)': ['Nyanja', 'English'],
      Tumbuka: ['Tumbuka', 'English'],
    },
  },
  LS: {
    ethnicities: ['Basotho', 'Zulu heritage', 'European', 'Mixed / Other'],
    languages: ['Southern Sotho', 'English', 'Zulu', 'Swati'],
    ethnicityLanguages: {
      Basotho: ['Southern Sotho', 'English'],
      'Zulu heritage': ['Zulu', 'English'],
    },
  },
  SZ: {
    ethnicities: ['Swazi', 'Zulu', 'Tsonga', 'Mixed / Other'],
    languages: ['English', 'Swati', 'Zulu', 'Tsonga'],
    ethnicityLanguages: {
      Swazi: ['Swati', 'English'],
      Zulu: ['Zulu', 'English'],
      Tsonga: ['Tsonga', 'English'],
    },
  },
};
