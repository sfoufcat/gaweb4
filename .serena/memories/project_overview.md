# Coachful - Project Overview

## Purpose
Coachful is a multi-tenant productivity and accountability SaaS platform built with Next.js. It's a coaching platform where coaches can create organizations with custom domains, programs, and squads to support their clients.

## Multi-Tenancy Model
- Platform operates on `app.coachful.co` (admin/platform)
- Coaches get subdomains: `{org}.coachful.co`
- Coaches can also use custom domains
- Tenant resolution happens in `src/proxy.ts` (middleware)

## Tech Stack
- **Framework**: Next.js 16+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design tokens
- **Auth**: Clerk (multi-tenant with organizations)
- **Database**: Firebase Firestore
- **Real-time Chat**: Stream Chat
- **Video Calls**: Stream Video
- **Payments**: Stripe (with Stripe Connect for coaches)
- **Email**: Resend
- **AI**: Anthropic Claude API
- **Secrets**: Doppler (required for development)
- **State Management**: SWR for client-side data fetching/caching

## User Roles
- `user` - Regular client/member
- `editor` - Can edit content
- `coach` - Can manage squads within an organization
- `admin` - Organization admin (super_coach)
- `super_admin` - Platform admin

## Organization Roles (within a tenant)
- `super_coach` - Organization owner
- `coach` - Squad coach
- `member` - Client/member

## Demo Mode
The app supports a demo mode (`demo.coachful.co`) that simulates data without authentication.
