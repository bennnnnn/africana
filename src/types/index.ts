export type Gender = 'male' | 'female';
export type InterestedIn = 'men' | 'women' | 'everyone';
export type LookingFor = 'relationship' | 'friendship' | 'marriage' | 'pen_pal';
export type OnlineStatus = 'online' | 'offline';
export type MaritalStatus = 'single' | 'divorced' | 'widowed' | 'separated';
export type Religion =
  | 'christianity' | 'islam' | 'catholicism' | 'protestantism' | 'pentecostal'
  | 'orthodox_christian' | 'traditional_african' | 'judaism' | 'buddhism'
  | 'hinduism' | 'atheist' | 'agnostic' | 'spiritual' | 'other';
export type Education =
  | 'high_school' | 'some_college' | 'vocational' | 'bachelors'
  | 'masters' | 'phd' | 'other';
export type WantChildren = 'yes' | 'no' | 'open';

export interface User {
  id: string;
  email: string;
  full_name: string;
  username: string;
  bio: string | null;
  birthdate: string;
  gender: Gender;
  interested_in: InterestedIn;
  looking_for: LookingFor[];
  country: string;
  state: string | null;
  city: string | null;
  // Extended profile
  religion: Religion | null;
  education: Education | null;
  marital_status: MaritalStatus | null;
  height_cm: number | null;          // e.g. 175
  ethnicity: string | null;          // free text
  occupation: string | null;         // free text
  languages: string[];               // e.g. ['English','Amharic']
  has_children: boolean | null;
  want_children: WantChildren | null;
  // Media & status
  profile_photos: string[];
  avatar_url: string | null;
  online_status: OnlineStatus;
  last_seen: string;
  created_at: string;
  updated_at: string;
  age?: number;
}

export interface UserSettings {
  id?: string;
  user_id: string;
  receive_messages: boolean;
  show_online_status: boolean;
  profile_visible: boolean;
  email_notifications: boolean;
  notify_messages: boolean;
  notify_likes: boolean;
  notify_matches: boolean;
  notify_views: boolean;
  push_token: string | null;
}

export interface Like {
  id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: User;
}

export interface Conversation {
  id: string;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  other_user?: User;
  unread_count?: number;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface FilterOptions {
  country: string | null;
  state: string | null;
  city: string | null;
  min_age: number;
  max_age: number;
  religion: Religion | null;
  marital_status: MaritalStatus | null;
  online_only: boolean;
}
