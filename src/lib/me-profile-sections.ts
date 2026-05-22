/** Map a `getProfileStrength` item key onto the on-screen section anchor. */
export function sectionForMissingKey(key: string | undefined): string {
  switch (key) {
    case 'photo':
      return 'photos';
    case 'bio':
      return 'about';
    case 'religion':
    case 'ethnicity':
    case 'languages':
      return 'personal';
    case 'education':
    case 'occupation':
      return 'work';
    case 'height':
      return 'physical';
    case 'hobbies':
      return 'hobbies';
    default:
      return 'about';
  }
}
