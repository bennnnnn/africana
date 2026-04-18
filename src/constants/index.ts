export const COLORS = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  /** Vivid coral-terracotta — confident, modern, still rooted in the Africana warmth */
  primary:        '#EF3E2A',
  primaryLight:   '#FF7A5F',
  primaryDark:    '#C02B1A',
  /** Tinted surface for primary backgrounds (banners, soft chips) */
  primarySurface: '#FFEDE8',
  primaryBorder:  '#FCC9BD',

  /** Muted accent (labels, secondary chips) — neutral graphite */
  earth:        '#3A3A3C',
  earthLight:   '#8E8E93',
  /** Subtle neutral surface tint for pills / icon wells (iOS-like) */
  savanna:      '#F2F2F4',
  savannaDark:  '#E5E5E7',

  /** Single accent: gold for highlights (premium, stars) */
  gold:         '#F5A623',
  goldSurface:  '#FFF4DE',
  /** Forest green retained for nature accents */
  green:        '#0E9F6E',

  // ── Surfaces ────────────────────────────────────────────────────────────────
  /** App background — clean near-white (big-company neutral) */
  surface:  '#FFFFFF',
  /** Secondary surface — grouped sections, subtle wells */
  surfaceAlt: '#F7F7F8',
  card:     '#FFFFFF',
  white:    '#FFFFFF',
  inputBg:  '#FFFFFF',

  // ── Text ───────────────────────────────────────────────────────────────────
  /** Apple-style neutral scale — crisp, high contrast */
  text:          '#0B0B0C',
  textSecondary: '#4A4A4F',
  textMuted:     '#8E8E93',
  textInverse:   '#FFFFFF',
  textStrong:    '#000000',

  // ── Borders ────────────────────────────────────────────────────────────────
  /** Neutral hairline divider — clean, non-tinted */
  border:       '#EBEBED',
  borderStrong: '#D6D6D9',

  // ── Semantic ───────────────────────────────────────────────────────────────
  error:          '#E53935',
  errorSurface:   '#FDECEC',
  errorBorder:    '#F6BFBF',
  success:        '#0E9F6E',
  successSurface: '#E1F7EE',
  successBorder:  '#9FE3C6',
  warning:        '#F5A623',
  warningSurface: '#FFF4DE',
  warningBorder:  '#F6D48A',

  /** Unfilled profile fields — soft coral to invite action */
  emptyField:        '#EF6A56',
  emptyFieldSurface: '#FFEDE8',
  emptyFieldBorder:  'rgba(239, 106, 86, 0.32)',

  // ── Status ─────────────────────────────────────────────────────────────────
  online:  '#0E9F6E',
  offline: '#C7C7CC',

  // ── Overlays ───────────────────────────────────────────────────────────────
  overlay:      'rgba(0,0,0,0.72)',
  overlayLight: 'rgba(0,0,0,0.32)',
  toastBg:      'rgba(17,17,20,0.94)',
} as const;

// ── Spacing & radius scale ──────────────────────────────────────────────────
export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 9999,
} as const;

// ── Typography scale ────────────────────────────────────────────────────────
/**
 * Font families:
 *  - `display`: DM Serif Display — only for screen titles / hero name
 *  - default: System sans (use the `weights` for everything else)
 */
export const FONT = {
  // sizes
  xs:      11,
  sm:      13,
  md:      15,
  lg:      17,
  xl:      20,
  xxl:     24,
  xxxl:    30,
  display: 36,
  // weights — capped at 4 (regular / medium / semibold / extrabold)
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
  // families
  displayFamily: 'DMSerifDisplay_400Regular',
} as const;

// ── Shadow presets — neutral, crisp (big-company style) ────────────────────
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const AFRICAN_COUNTRIES = [
  { code: 'DZ', name: 'Algeria' },
  { code: 'AO', name: 'Angola' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'DR Congo' },
  { code: 'CI', name: 'Côte d\'Ivoire' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'EG', name: 'Egypt' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'KE', name: 'Kenya' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'ML', name: 'Mali' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SN', name: 'Senegal' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'SD', name: 'Sudan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TG', name: 'Togo' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'UG', name: 'Uganda' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
  // Diaspora countries
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'AU', name: 'Australia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'NZ', name: 'New Zealand' },
];

export const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const INTERESTED_IN_OPTIONS = [
  { value: 'women', label: 'Women' },
  { value: 'men',   label: 'Men' },
];

export const HAS_CHILDREN_OPTIONS = [
  { value: 'true',  label: 'Yes' },
  { value: 'false', label: 'No' },
];

export const WANT_CHILDREN_YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
];

export const LOOKING_FOR_OPTIONS = [
  { value: 'relationship', label: 'Relationship' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'pen_pal', label: 'Pen Pal' },
];

export const RELIGION_OPTIONS = [
  { value: 'christianity',       label: 'Christianity',        emoji: '✝️' },
  { value: 'catholicism',        label: 'Catholic',            emoji: '✝️' },
  { value: 'protestantism',      label: 'Protestant',          emoji: '✝️' },
  { value: 'pentecostal',        label: 'Pentecostal',         emoji: '✝️' },
  { value: 'orthodox_christian', label: 'Orthodox Christian',  emoji: '☦️' },
  { value: 'islam',              label: 'Islam',               emoji: '☪️' },
  { value: 'traditional_african',label: 'Traditional African', emoji: '🌿' },
  { value: 'judaism',            label: 'Judaism',             emoji: '✡️' },
  { value: 'buddhism',           label: 'Buddhism',            emoji: '☸️' },
  { value: 'hinduism',           label: 'Hinduism',            emoji: '🕉️' },
  { value: 'atheist',            label: 'Atheist',             emoji: '⚛️' },
  { value: 'other',              label: 'Other',               emoji: '🙏' },
];

export const EDUCATION_OPTIONS = [
  { value: 'high_school',    label: 'High School' },
  { value: 'some_college',   label: 'Some College' },
  { value: 'vocational',     label: 'Vocational / Trade' },
  { value: 'bachelors',      label: "Bachelor's Degree" },
  { value: 'masters',        label: "Master's Degree" },
  { value: 'phd',            label: 'PhD / Doctorate' },
  { value: 'other',          label: 'Other' },
];

export const OCCUPATION_OPTIONS = [
  { value: 'accountant', label: 'Accountant' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'architect', label: 'Architect' },
  { value: 'artist', label: 'Artist' },
  { value: 'banker', label: 'Banker' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'chef', label: 'Chef' },
  { value: 'civil_servant', label: 'Civil Servant' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'designer', label: 'Designer' },
  { value: 'developer', label: 'Developer / Engineer' },
  { value: 'doctor', label: 'Doctor / Physician' },
  { value: 'driver', label: 'Driver' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'entrepreneur', label: 'Entrepreneur' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'financial_analyst', label: 'Financial Analyst' },
  { value: 'government_worker', label: 'Government Worker' },
  { value: 'hair_beauty', label: 'Hair / Beauty Professional' },
  { value: 'healthcare_worker', label: 'Healthcare Worker' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'journalist', label: 'Journalist / Media' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'lecturer', label: 'Lecturer / Professor' },
  { value: 'manager', label: 'Manager' },
  { value: 'marketing', label: 'Marketing / Sales' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'military', label: 'Military / Security' },
  { value: 'musician', label: 'Musician / Entertainer' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'pilot', label: 'Pilot / Aviation' },
  { value: 'police', label: 'Police / Law Enforcement' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'retail', label: 'Retail / Trade' },
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'technician', label: 'Technician' },
  { value: 'trader', label: 'Trader / Merchant' },
  { value: 'writer', label: 'Writer' },
  { value: 'other', label: 'Other' },
] as const;

export const PHYSICAL_CONDITION_OPTIONS = [
  { value: 'slim', label: 'Slim' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'average', label: 'Average' },
  { value: 'curvy', label: 'Curvy' },
  { value: 'plus_size', label: 'Plus Size' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single',    label: 'Single',    emoji: '🙂' },
  { value: 'divorced',  label: 'Divorced',  emoji: '💔' },
  { value: 'widowed',   label: 'Widowed',   emoji: '🕊️' },
  { value: 'separated', label: 'Separated', emoji: '↔️' },
];

export const APP_NAME = 'Africana';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=EF3E2A&color=fff&size=200&name=';
export const MAX_PROFILE_PHOTOS = 6;
export const MIN_AGE = 18;
export const MAX_AGE = 100;
