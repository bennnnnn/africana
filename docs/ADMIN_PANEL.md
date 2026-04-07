# Africana Admin Panel — Spec

> React web app. Build when ready. Connects to Supabase with service role key.

## Tech Stack
- React (Vite)
- Supabase JS (service role)
- Recharts (charts)
- Deployed on Vercel or Netlify

## Pages

### 1. Dashboard
- Total users, active today, active this week
- New signups: daily / weekly / monthly chart
- Users by country and state (bar chart)
- Most active users (time spent, messages sent)
- Growth forecast (trend projection for next month)

### 2. Revenue (after Gold launches)
- Income: this week, this month, all-time
- Active subscriber count
- Conversion rate: free → Gold
- Revenue chart over time

### 3. Reports
- Pending reports queue with reporter + reported user details
- Actions: dismiss, warn, ban
- Report history log

### 4. Users
- Search / filter by name, email, country, status
- View full profile details
- Ban / unban / delete account
- Verification review: approve or reject verification photos

### 5. Messaging / Moderation
- Flagged messages (when content moderation is added)
- Email broadcast to all users or segments

## Auth
- Admin login via Supabase email auth
- Restrict to a list of admin email addresses
- Service role key used server-side only (never exposed to browser)

## Tables Needed
- `admin_users` — email whitelist for admin access
- Existing tables: `profiles`, `reports`, `blocks`, `likes`, `conversations`, `messages`, `subscriptions`, `user_settings`, `notification_events`, `profile_views`
