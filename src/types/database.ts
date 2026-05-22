export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_hidden: {
        Row: {
          conversation_id: string
          hidden_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_hidden_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          participant_ids: string[]
          user_high_id: string
          user_low_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_ids: string[]
          user_high_id: string
          user_low_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_ids?: string[]
          user_high_id?: string
          user_low_id?: string
        }
        Relationships: []
      }
      email_campaign_events: {
        Row: {
          campaign_key: string
          created_at: string
          id: string
          sent_at: string
          trigger_metadata: Json
          user_id: string
        }
        Insert: {
          campaign_key: string
          created_at?: string
          id?: string
          sent_at?: string
          trigger_metadata?: Json
          user_id: string
        }
        Update: {
          campaign_key?: string
          created_at?: string
          id?: string
          sent_at?: string
          trigger_metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          favourited_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favourited_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favourited_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_favourited_id_fkey"
            columns: ["favourited_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_hidden: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hidden_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string | null
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_for: string[]
          edited_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_for?: string[]
          edited_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_for?: string[]
          edited_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          created_at: string
          dedupe_key: string
          id: string
          last_sent_at: string
          recipient_id: string
          sender_id: string
          type: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string
          id?: string
          last_sent_at?: string
          recipient_id: string
          sender_id: string
          type: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          id?: string
          last_sent_at?: string
          recipient_id?: string
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_share_events: {
        Row: {
          created_at: string
          id: string
          shared_profile_id: string
          sharer_id: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          shared_profile_id: string
          sharer_id: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          shared_profile_id?: string
          sharer_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_share_events_shared_profile_id_fkey"
            columns: ["shared_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_share_events_sharer_id_fkey"
            columns: ["sharer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          viewed_at: string
          viewed_id: string
          viewer_id: string
        }
        Insert: {
          id?: string
          viewed_at?: string
          viewed_id: string
          viewer_id: string
        }
        Update: {
          id?: string
          viewed_at?: string
          viewed_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_viewed_id_fkey"
            columns: ["viewed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_messages: boolean
          avatar_url: string | null
          bio: string | null
          birthdate: string
          body_type: string | null
          city: string | null
          country: string
          created_at: string
          education: string | null
          ethnicity: string | null
          favorite_interests: string[]
          full_name: string
          gender: string
          has_children: boolean | null
          height_cm: number | null
          hobbies: string[] | null
          id: string
          interested_in: string | null
          languages: string[] | null
          last_seen: string
          looking_for: string[]
          marital_status: string | null
          max_age_pref: number | null
          min_age_pref: number | null
          occupation: string | null
          online_status: string
          online_visible: boolean
          origin_city: string | null
          origin_country: string | null
          origin_state: string | null
          profile_photos: string[]
          profile_title: string | null
          religion: string | null
          show_in_discover: boolean
          state: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string | null
          verification_photo: string | null
          verification_status: string
          verified: boolean
          verified_at: string | null
          want_children: string | null
          weight_kg: number | null
        }
        Insert: {
          accepts_messages?: boolean
          avatar_url?: string | null
          bio?: string | null
          birthdate: string
          body_type?: string | null
          city?: string | null
          country: string
          created_at?: string
          education?: string | null
          ethnicity?: string | null
          favorite_interests?: string[]
          full_name: string
          gender: string
          has_children?: boolean | null
          height_cm?: number | null
          hobbies?: string[] | null
          id: string
          interested_in?: string | null
          languages?: string[] | null
          last_seen?: string
          looking_for?: string[]
          marital_status?: string | null
          max_age_pref?: number | null
          min_age_pref?: number | null
          occupation?: string | null
          online_status?: string
          online_visible?: boolean
          origin_city?: string | null
          origin_country?: string | null
          origin_state?: string | null
          profile_photos?: string[]
          profile_title?: string | null
          religion?: string | null
          show_in_discover?: boolean
          state?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
          verification_photo?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          want_children?: string | null
          weight_kg?: number | null
        }
        Update: {
          accepts_messages?: boolean
          avatar_url?: string | null
          bio?: string | null
          birthdate?: string
          body_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          education?: string | null
          ethnicity?: string | null
          favorite_interests?: string[]
          full_name?: string
          gender?: string
          has_children?: boolean | null
          height_cm?: number | null
          hobbies?: string[] | null
          id?: string
          interested_in?: string | null
          languages?: string[] | null
          last_seen?: string
          looking_for?: string[]
          marital_status?: string | null
          max_age_pref?: number | null
          min_age_pref?: number | null
          occupation?: string | null
          online_status?: string
          online_visible?: boolean
          origin_city?: string | null
          origin_country?: string | null
          origin_state?: string | null
          profile_photos?: string[]
          profile_title?: string | null
          religion?: string | null
          show_in_discover?: boolean
          state?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
          verification_photo?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          want_children?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          reviewed: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          reviewed?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          reviewed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          plan: string
          provider: string | null
          provider_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          plan?: string
          provider?: string | null
          provider_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          plan?: string
          provider?: string | null
          provider_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          email_notifications: boolean
          favourites_seen_at: string | null
          id: string
          incognito: boolean
          likes_seen_at: string | null
          matches_seen_at: string | null
          moderation_locked: boolean
          notify_likes: boolean | null
          notify_matches: boolean | null
          notify_messages: boolean | null
          notify_views: boolean | null
          profile_visible: boolean
          push_token: string | null
          receive_messages: boolean
          sent_seen_at: string | null
          show_online_status: boolean
          theme: string | null
          updated_at: string
          user_id: string
          views_seen_at: string | null
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          favourites_seen_at?: string | null
          id?: string
          incognito?: boolean
          likes_seen_at?: string | null
          matches_seen_at?: string | null
          moderation_locked?: boolean
          notify_likes?: boolean | null
          notify_matches?: boolean | null
          notify_messages?: boolean | null
          notify_views?: boolean | null
          profile_visible?: boolean
          push_token?: string | null
          receive_messages?: boolean
          sent_seen_at?: string | null
          show_online_status?: boolean
          theme?: string | null
          updated_at?: string
          user_id: string
          views_seen_at?: string | null
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          favourites_seen_at?: string | null
          id?: string
          incognito?: boolean
          likes_seen_at?: string | null
          matches_seen_at?: string | null
          moderation_locked?: boolean
          notify_likes?: boolean | null
          notify_matches?: boolean | null
          notify_messages?: boolean | null
          notify_views?: boolean | null
          profile_visible?: boolean
          push_token?: string | null
          receive_messages?: boolean
          sent_seen_at?: string | null
          show_online_status?: boolean
          theme?: string | null
          updated_at?: string
          user_id?: string
          views_seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activity_unseen_counts: { Args: never; Returns: Json }
      claim_email_campaign_event: {
        Args: {
          p_campaign_key: string
          p_trigger_metadata?: Json
          p_user_id: string
        }
        Returns: boolean
      }
      conversation_unread_counts: {
        Args: { p_conversation_ids: string[] }
        Returns: {
          conversation_id: string
          count: number
        }[]
      }
      delete_user_by_id: { Args: { p_user_id: string }; Returns: undefined }
      export_user_data: { Args: never; Returns: Json }
      fetch_discover_profiles_page: {
        Args: {
          p_city?: string
          p_country?: string
          p_exclude_liked?: boolean
          p_gender?: string
          p_limit?: number
          p_max_age?: number
          p_min_age?: number
          p_offset?: number
          p_online_only?: boolean
          p_religion?: string
          p_state?: string
          p_verified_only?: boolean
          p_viewer_id: string
        }
        Returns: {
          accepts_messages: boolean
          avatar_url: string | null
          bio: string | null
          birthdate: string
          body_type: string | null
          city: string | null
          country: string
          created_at: string
          education: string | null
          ethnicity: string | null
          favorite_interests: string[]
          full_name: string
          gender: string
          has_children: boolean | null
          height_cm: number | null
          hobbies: string[] | null
          id: string
          interested_in: string | null
          languages: string[] | null
          last_seen: string
          looking_for: string[]
          marital_status: string | null
          max_age_pref: number | null
          min_age_pref: number | null
          occupation: string | null
          online_status: string
          online_visible: boolean
          origin_city: string | null
          origin_country: string | null
          origin_state: string | null
          profile_photos: string[]
          profile_title: string | null
          religion: string | null
          show_in_discover: boolean
          state: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string | null
          verification_photo: string | null
          verification_status: string
          verified: boolean
          verified_at: string | null
          want_children: string | null
          weight_kg: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_activity_feed: { Args: never; Returns: Json }
      get_email_campaign_candidates: {
        Args: {
          p_campaign_key: string
          p_last_seen_before: string
          p_limit?: number
        }
        Returns: {
          full_name: string
          last_seen: string
          user_id: string
        }[]
      }
      get_matches:
        | {
            Args: { p_limit?: number }
            Returns: {
              avatar_url: string
              birthdate: string
              city: string
              country: string
              full_name: string
              id: string
              last_seen: string
              online_status: string
              profile_photos: string[]
            }[]
          }
        | { Args: { p_limit?: number; p_offset?: number }; Returns: Json }
      get_public_user_prefs_batch: {
        Args: { p_ids: string[] }
        Returns: {
          profile_visible: boolean
          receive_messages: boolean
          show_online_status: boolean
          user_id: string
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      rate_limit_counts: { Args: never; Returns: Json }
      refresh_conversation_preview: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      soft_delete_message_for_self: {
        Args: { p_message_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
