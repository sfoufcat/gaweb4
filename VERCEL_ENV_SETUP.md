# Vercel Environment Variables Setup

## Quick Setup (Option 1 - Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable below
5. Select **Production, Preview, and Development** for each

## Required Environment Variables

Copy these from your Doppler dashboard (https://dashboard.doppler.com):

### Clerk (Authentication)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Firebase (Database)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

**Important for FIREBASE_PRIVATE_KEY:**
- Include the full key with quotes and newlines
- Format: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`

### Stream Chat
```
NEXT_PUBLIC_STREAM_API_KEY
STREAM_SECRET
```

### Anthropic (AI)
```
ANTHROPIC_API_KEY
```

## Alternative: Using Vercel CLI

If you prefer the CLI:

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Link your project
vercel link

# Add environment variables (do this for each variable)
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
# ... continue for all variables
```

## After Adding Variables

1. Trigger a new deployment:
   - Push to your git repository, or
   - Go to Vercel dashboard → Deployments → Redeploy

2. The build should now succeed!

## Troubleshooting

- **"Missing publishableKey" error**: You didn't add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **Firebase errors**: Check that `FIREBASE_PRIVATE_KEY` includes quotes and `\n` for newlines
- **Still failing**: Make sure you selected "Production, Preview, and Development" for all variables

