import type { User } from '@/types';

export interface Icebreaker {
  key: string;
  text: string;
}

export function generateIcebreakers(viewer: User, peer: User): Icebreaker[] {
  const items: Icebreaker[] = [];

  // Shared language prompt
  const viewerLangs = new Set((viewer.languages ?? []).map((l) => l.toLowerCase()));
  const sharedLang = (peer.languages ?? []).find((l) => viewerLangs.has(l.toLowerCase()));
  if (sharedLang) {
    items.push({
      key: 'shared_lang',
      text: `Say hi in ${sharedLang} 👋`,
    });
  }

  // Shared hobby prompt
  const viewerHobbies = new Set((viewer.hobbies ?? []).map((h) => h.toLowerCase()));
  const sharedHobby = (peer.hobbies ?? []).find((h) => viewerHobbies.has(h.toLowerCase()));
  if (sharedHobby) {
    items.push({
      key: 'shared_hobby',
      text: `Ask about ${sharedHobby}`,
    });
  }

  // Ethnicity / roots prompt
  if (peer.ethnicity) {
    items.push({
      key: 'roots',
      text: `Ask about ${peer.ethnicity} roots`,
    });
  }

  // Country prompt
  if (peer.country && peer.country !== viewer.country) {
    items.push({
      key: 'country',
      text: `Ask about life in ${peer.country}`,
    });
  }

  // Occupation prompt
  if (peer.occupation) {
    items.push({
      key: 'occupation',
      text: `Ask about their work as ${peer.occupation}`,
    });
  }

  // Language exchange / learning
  const peerExtraLang = (peer.languages ?? []).find((l) => !viewerLangs.has(l.toLowerCase()));
  if (peerExtraLang) {
    items.push({
      key: 'lang_learn',
      text: `"Teach me some ${peerExtraLang}"`,
    });
  }

  // Looking for match
  if ((peer.looking_for ?? []).includes('friendship')) {
    items.push({
      key: 'friendship',
      text: `"Looking for friends too — what do you enjoy doing?"`,
    });
  }

  return items.slice(0, 4);
}
