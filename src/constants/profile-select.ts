/**
 * Explicit PostgREST `profiles` column list for list/grid/inbox fetches.
 * Avoids `select('*')` payload bloat on large profile rows.
 *
 * Keep in sync with `User` in `@/types` and `public.profiles` migrations.
 */
export const PROFILE_LIST_SELECT = [
  'id',
  'full_name',
  'username',
  'bio',
  'birthdate',
  'gender',
  'interested_in',
  'looking_for',
  'country',
  'state',
  'city',
  'origin_country',
  'origin_state',
  'origin_city',
  'religion',
  'education',
  'marital_status',
  'height_cm',
  'weight_kg',
  'body_type',
  'ethnicity',
  'occupation',
  'languages',
  'hobbies',
  'has_children',
  'want_children',
  'verified',
  'verification_status',
  'profile_photos',
  'avatar_url',
  'online_status',
  'last_seen',
  'online_visible',
  'show_in_discover',
  'accepts_messages',
  'min_age_pref',
  'max_age_pref',
  'created_at',
  'updated_at',
].join(',');

/** Narrow select for Discover/Online grid cards and inbox peer avatars. */
export const PROFILE_CARD_SELECT = [
  'id',
  'full_name',
  'birthdate',
  'gender',
  'country',
  'state',
  'city',
  'avatar_url',
  'profile_photos',
  'online_status',
  'last_seen',
  'online_visible',
  'verified',
  'religion',
  'show_in_discover',
  'accepts_messages',
  'created_at',
].join(',');

/** Inbox + chat list conversation rows (excludes unused profile fields). */
export const CONVERSATION_LIST_SELECT =
  'id,participant_ids,user_low_id,user_high_id,last_message,last_message_at,created_at';

/** Message thread pages (excludes heavy/unused columns). */
export const MESSAGE_LIST_SELECT =
  'id,conversation_id,sender_id,content,read_at,created_at,edited_at,reactions,deleted_for';
