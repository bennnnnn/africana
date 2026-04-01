export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
export type LookingFor = 'relationship' | 'friendship' | 'marriage' | 'pen_pal';
export type OnlineStatus = 'online' | 'away' | 'offline';

export interface User {
  id: string;
  email: string;
  full_name: string;
  username: string;
  bio: string | null;
  birthdate: string;
  gender: Gender;
  looking_for: LookingFor[];
  country: string;
  state: string | null;
  city: string | null;
  profile_photos: string[];
  avatar_url: string | null;
  online_status: OnlineStatus;
  last_seen: string;
  created_at: string;
  updated_at: string;
  age?: number;
}

export interface UserSettings {
  id: string;
  user_id: string;
  receive_messages: boolean;
  show_online_status: boolean;
  profile_visible: boolean;
  email_notifications: boolean;
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
  gender: Gender | null;
  min_age: number;
  max_age: number;
  looking_for: LookingFor | null;
  online_only: boolean;
}
