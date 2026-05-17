import type { Gender, InterestedIn, LookingFor } from '@/types';

export const ONBOARDING_TOTAL_STEPS = 6;

export const ONBOARDING_STEP_METAS = [
  {
    emoji: '👤',
    title: "What's your name?",
    subtitle: "This is how you'll appear to others on Africana.",
    bg: '#FFF3E0',
  },
  {
    emoji: '📸',
    title: 'Add your photo',
    subtitle: 'Profiles with a photo get 6× more matches.',
    bg: '#FFF8E1',
  },
  {
    emoji: '🎂',
    title: 'A bit about you',
    subtitle: 'A few basics to help us find the right people.',
    bg: '#E8F5E9',
  },
  {
    emoji: '💞',
    title: 'What are you looking for?',
    subtitle: 'Be honest — the right match is out there.',
    bg: '#FCE4EC',
  },
  {
    emoji: '📍',
    title: 'Where do you live?',
    subtitle: 'Your location helps people near you find you.',
    bg: '#E0F7FA',
  },
  {
    emoji: '🌍',
    title: 'Your roots',
    subtitle: 'Ethnicity and languages help us find your people.',
    bg: '#E8F5E9',
  },
] as const;

export const ONBOARDING_INTEREST_OPTIONS: { value: InterestedIn; label: string; emoji: string }[] =
  [
    { value: 'women', label: 'Women', emoji: '👩' },
    { value: 'men', label: 'Men', emoji: '👨' },
    { value: 'everyone', label: 'Everyone', emoji: '🌍' },
  ];

export const ONBOARDING_GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male', label: 'Male', emoji: '👨' },
  { value: 'female', label: 'Female', emoji: '👩' },
  { value: 'nonbinary', label: 'Non-binary', emoji: '🌈' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

export const ONBOARDING_LOOKING_FOR_OPTIONS: {
  value: LookingFor;
  emoji: string;
  label: string;
  desc: string;
}[] = [
  {
    value: 'relationship',
    emoji: '💑',
    label: 'Relationship',
    desc: 'A deep, meaningful connection',
  },
  { value: 'marriage', emoji: '💍', label: 'Marriage', desc: 'Serious, long-term commitment' },
  {
    value: 'friendship',
    emoji: '🤝',
    label: 'Friendship',
    desc: 'Friends first, see what happens',
  },
  { value: 'pen_pal', emoji: '✉️', label: 'Pen Pal', desc: 'Chat, share stories, connect' },
];
