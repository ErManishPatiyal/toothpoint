# Toothpoint - Dental Appointment Booking System

A modern, full-stack dental appointment booking platform built with Next.js 15, Supabase, and PWA support.

## Features

- **Role-based Authentication**: Separate interfaces for patients and dentists
- **Smart Scheduling**: Dentists set recurring availability; slots generated automatically
- **Real-time Calendar**: Live updates with react-big-calendar
- **Booking Workflow**: Patient requests → Dentist approves/rejects → Notifications
- **Push Notifications**: Web Push API with VAPID keys for reminders
- **PWA Support**: Installable, offline-capable progressive web app
- **Automated Reminders**: 24h and 1h before appointments via pg_cron
- **Race Condition Prevention**: Atomic booking with PostgreSQL constraints

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Calendar**: react-big-calendar with moment.js
- **Forms**: React Hook Form with Zod validation
- **Push Notifications**: Web Push API, web-push library
- **Deployment**: Vercel (frontend), Supabase (backend)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Vercel account (for deployment)

### 1. Clone and Install

```bash
git clone <repository-url>
cd toothpoint
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Enable Realtime for `appointments` and `slots` tables
4. Create a storage bucket named `avatars` for profile images
5. Enable pg_cron extension (Database → Extensions)

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key (generate with `npx web-push generate-vapid-keys`)
- `VAPID_PRIVATE_KEY` - VAPID private key
- `CRON_SECRET` - Secure random string for pg_cron authentication
- `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., `http://localhost:3000`)

### 4. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Add the keys to your `.env.local` and Supabase Edge Function secrets.

### 5. Set Up pg_cron Reminders

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy reminders
   ```

2. Run the pg_cron setup SQL from `supabase/pg_cron_setup.sql` (update the URL to your Edge Function)

### 6. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── push-subscription/
│   │   └── reminders/
│   ├── dashboard/           # Protected dashboard routes
│   │   ├── layout.tsx       # Dashboard layout with navigation
│   │   ├── page.tsx         # Dashboard home
│   │   ├── availability/    # Dentist availability management
│   │   ├── bookings/        # Dentist booking approval
│   │   ├── calendar/        # Calendar view
│   │   ├── dentists/        # Patient dentist browsing
│   │   └── profile/         # User profile
│   ├── login/               # Authentication pages
│   ├── signup/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/
│   ├── auth/                # Authentication components
│   ├── PWAProvider.tsx      # PWA and push notification context
│   └── ui/                  # Reusable UI components
├── lib/
│   ├── supabase/            # Supabase clients
│   ├── types/               # TypeScript types
│   └── utils.ts             # Utility functions
├── middleware.ts            # Auth middleware
└── supabase/
    ├── schema.sql           # Database schema
    ├── pg_cron_setup.sql    # pg_cron configuration
    └── functions/
        └── reminders/       # Edge Function for reminders
```

## Database Schema

Key tables:
- `profiles` - User profiles with roles (patient/dentist)
- `availability` - Dentist recurring weekly schedules
- `slots` - Generated appointment time slots
- `appointments` - Booking requests with status tracking
- `push_subscriptions` - Web Push subscriptions
- `notification_logs` - Notification delivery logs

## Key Features Implementation

### Atomic Booking (Race Condition Prevention)
Uses PostgreSQL `UPDATE ... WHERE is_booked = FALSE` with `RETURNING` to atomically claim a slot.

### Realtime Updates
Supabase Realtime subscriptions on `appointments` and `slots` tables for live calendar updates.

### Push Notifications
- Service Worker handles push events
- VAPID keys for authentication
- Subscriptions stored in database
- Edge Function sends reminders via pg_cron

### PWA
- Web App Manifest for installability
- Service Worker for offline support
- Cache-first strategy for static assets

## Deployment

### Vercel (Frontend)
1. Connect repository to Vercel
2. Add environment variables
3. Deploy

### Supabase (Backend)
1. Run migrations in production
2. Deploy Edge Functions
3. Configure pg_cron job
4. Set up custom domain (optional)

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

## License

MIT