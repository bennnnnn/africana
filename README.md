# 🌍 Africana Dating App

A browse-based dating app for Africans and the African diaspora — built with React Native + Expo + Supabase.

## Features

- **Discover** — Browse member profiles in a grid layout, filtered by country, state/region, city, gender, age range, and looking-for
- **Online Now** — See who's currently online or recently active
- **Likes** — View who liked you and who you've liked
- **Messages** — Real-time 1-on-1 chat with read receipts
- **Profile** — Multi-photo profile with bio, location hierarchy, and looking-for tags
- **Privacy Controls** — Disable receiving messages, hide online status, hide profile from discover
- **Block Users** — Block/unblock members, with full cascade from discover and chat
- **Delete Account** — Permanent account deletion with password confirmation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo 54 + React Native 0.81 |
| Navigation | Expo Router 5 (file-based) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| State | Zustand |
| Styling | NativeWind (Tailwind CSS for RN) |
| Images | expo-image |
| Language | TypeScript (strict) |

## Getting Started

### 1. Clone & Install

```bash
git clone ...
cd africana
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema in `src/lib/supabase-schema.sql` via the Supabase SQL editor
3. Copy your project URL and anon key

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run

```bash
# Start development server
npm start

# iOS
npm run ios

# Android
npm run android
```

## Project Structure

```
africana/
├── app/                     # Expo Router screens
│   ├── (auth)/              # Login, Register, Onboarding
│   ├── (tabs)/              # Discover, Online, Likes, Messages, Profile
│   ├── (profile)/           # View/Edit profile, Photos
│   ├── (chat)/              # Chat conversation
│   └── (settings)/          # Settings, Blocked users, Delete account
├── src/
│   ├── components/
│   │   ├── ui/              # Button, Input, Avatar, Badge, EmptyState
│   │   ├── discover/        # UserCard, FilterSheet
│   │   └── chat/            # (future: message components)
│   ├── store/               # Zustand stores (auth, discover, chat)
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── supabase-schema.sql  # Database schema
│   ├── types/               # TypeScript types
│   └── constants/           # Colors, countries list, config
└── global.css               # Tailwind CSS entry
```

## Database Schema

- **profiles** — User profile data with location hierarchy (country/state/city)
- **user_settings** — Privacy settings per user
- **likes** — User-to-user likes
- **conversations** — Chat threads
- **messages** — Chat messages with read receipts
- **blocks** — Blocked user pairs

## Color Palette

| Name | Hex | Use |
|------|-----|-----|
| Primary | `#C84B31` | Buttons, accents |
| Earth | `#8B5E3C` | Secondary elements |
| Savanna | `#F5E6D0` | Backgrounds, chips |
| Gold | `#D4AF37` | Highlights |
| Green | `#2D6A4F` | Success states |

## Roadmap

- [ ] Push notifications (new messages, new likes)
- [ ] Voice messages
- [ ] Premium subscription tier
- [ ] Video profile clips
- [ ] Advanced match algorithm
- [ ] In-app reporting system
- [ ] Multi-language support (French, Swahili, Arabic, Amharic)
