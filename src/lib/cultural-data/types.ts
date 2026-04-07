export interface CountryCultureData {
  ethnicities: string[];
  languages: string[];
  subdivisionEthnicities?: Record<string, string[]>;
  cityEthnicities?: Record<string, string[]>;
  ethnicityLanguages?: Record<string, string[]>;
  subdivisionLanguages?: Record<string, string[]>;
  cityLanguages?: Record<string, string[]>;
}
