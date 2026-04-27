# TourLytics

Commercial real estate intelligence platform. AI-powered lease analytics, interactive maps, and tour management.

## Architecture

- **Framework**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Auth**: Supabase (email/password)
- **Backend**: Next.js API routes (serverless)
- **AI**: Anthropic Claude for lease analysis chatbot
- **Deploy**: Vercel

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/investors` | Public | Investor overview |
| `/login` | Public | Sign in / Sign up |
| `/dashboard` | Authenticated | Project selector |
| `/project/[id]` | Authenticated | Full app (map, financials, tour book, chatbot) |
| `/api/chat` | API | AI chatbot endpoint (streaming SSE) |
| `/api/auth/callback` | API | Supabase auth callback |

## Environment Variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://lsckcmvoqmwxovqejvyl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

## Local Dev

```bash
npm install
npm run dev
```

## Vercel Deployment

1. Import `smoitoza/tour-lytics` repo in Vercel dashboard
2. Set environment variables above
3. Connect tourlytics.ai domain
4. Deploy
