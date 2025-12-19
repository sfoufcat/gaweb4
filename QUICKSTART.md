# Quick Start Guide - Doppler Edition 🔐

**This project uses Doppler as the single source of truth for all environment variables.**

---

## ⚡ Super Quick Start

```bash
# 1. Setup Doppler
./setup-doppler.sh

# 2. Verify secrets are loaded
./check-doppler.sh

# 3. Run the app
npm run dev
```

That's it! Open http://localhost:3000

---

## 📋 Detailed Setup

### Step 1: Install Doppler CLI

#### macOS
```bash
brew install dopplerhq/cli/doppler
```

#### Windows (Scoop)
```bash
scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git
scoop install doppler
```

#### Linux
```bash
curl -Ls https://cli.doppler.com/install.sh | sudo sh
```

### Step 2: Run Setup Script

```bash
./setup-doppler.sh
```

This interactive script will:
- ✅ Verify Doppler CLI is installed
- ✅ Authenticate you with Doppler
- ✅ Setup the project configuration
- ✅ Verify all secrets are accessible

### Step 3: Verify Everything Works

```bash
./check-doppler.sh
```

You should see:
- ✅ Doppler CLI version
- ✅ Your email (authenticated)
- ✅ Project: `gaweb3`
- ✅ Config: `dev` (or your environment)
- ✅ Total secrets: 20

### Step 4: Start Development

```bash
npm run dev
```

The app will automatically load all secrets from Doppler and start on http://localhost:3000

---

## 🔑 Required Secrets in Doppler

Ensure these **20 secrets** are in your Doppler project:

### Clerk (Authentication) - 7 secrets
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

**Get keys from:** [clerk.com](https://clerk.com)

### Firebase (Database) - 10 secrets
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Get keys from:** [firebase.google.com](https://firebase.google.com)

### Stream Chat - 2 secrets
```
NEXT_PUBLIC_STREAM_API_KEY=
STREAM_API_SECRET=
```

**Get keys from:** [getstream.io](https://getstream.io)

### App Configuration - 1 secret
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📝 Adding Secrets to Doppler

### Method 1: Web Dashboard (Easiest)
```bash
npm run doppler:open
```

This opens the Doppler dashboard in your browser where you can:
- Add secrets one by one
- Copy/paste values
- See which secrets are missing

### Method 2: CLI
```bash
# Add a single secret
doppler secrets set SECRET_NAME="value"

# Add multiple secrets from a file
doppler secrets upload .env.local
```

### Method 3: Bulk Import
If you have an existing `.env.local`:
```bash
doppler secrets upload .env.local
```

---

## ✅ Verification Steps

### 1. Check Doppler Status
```bash
./check-doppler.sh
```

Should show 20 secrets loaded.

### 2. Test the App
```bash
npm run dev
```

Visit http://localhost:3000 - you should see the landing page.

### 3. Test Authentication
- Click "Sign In" or "Get Started"
- Create an account
- Verify you're redirected back

### 4. Check Firebase
- Open [Firebase Console](https://console.firebase.google.com)
- Go to Firestore Database
- You should see a `users` collection with your user

---

## 🎯 Common Commands

### Development
```bash
npm run dev              # Start dev server (uses Doppler)
npm run build            # Build for production (uses Doppler)
npm run start            # Start production server (uses Doppler)
```

### Doppler Management
```bash
npm run doppler:open     # Open dashboard in browser
npm run doppler:secrets  # List all secrets
npm run doppler:setup    # Reconfigure project
npm run doppler:sync     # Download to .env.local (backup)
```

### Verification
```bash
./check-doppler.sh       # Check Doppler status
./setup-doppler.sh       # Re-run setup if needed
```

---

## 👥 Team Member Onboarding

New team member? Super simple:

```bash
# 1. Clone the repo
git clone <repo-url>
cd GAweb3

# 2. Install dependencies
npm install

# 3. Setup Doppler
./setup-doppler.sh

# 4. Start developing
npm run dev
```

No need to share `.env` files! They get all secrets from Doppler automatically.

---

## 🐛 Troubleshooting

### "Doppler CLI not found"
Install Doppler CLI (see Step 1 above)

### "Not logged in to Doppler"
```bash
doppler login
```

### "Unable to fetch secrets"
```bash
# Re-run setup
./setup-doppler.sh

# Or reconfigure manually
doppler setup
```

### "Missing required secrets"
```bash
# Check which secrets you have
./check-doppler.sh

# Add missing ones
npm run doppler:open
```

### "npm run dev fails"
```bash
# Check Doppler status first
./check-doppler.sh

# If Doppler is working but dev fails, check the error message
# Make sure all 20 secrets are in Doppler
```

### Need to work offline?
```bash
# Download secrets to .env.local
npm run doppler:sync

# Use local environment
npm run dev:local
```

---

## 🏗️ Project Structure Overview

```
GAweb3/
├── 📚 Documentation
│   ├── QUICKSTART.md (this file)
│   ├── DOPPLER_SETUP.md (detailed Doppler guide)
│   ├── README.md (project overview)
│   └── QUICK_REFERENCE.md (code examples)
│
├── 🔧 Scripts
│   ├── setup-doppler.sh (setup automation)
│   └── check-doppler.sh (status check)
│
├── ⚙️ Configuration
│   ├── doppler.yaml (Doppler config)
│   ├── package.json (dependencies & scripts)
│   └── .env.example (reference only)
│
└── 💻 Source Code
    └── src/ (Next.js application)
```

---

## 🚀 Ready for Features

Your infrastructure is now connected! You can use:

### Authentication
```tsx
import { useUser } from '@clerk/nextjs';

function MyComponent() {
  const { user } = useUser();
  return <div>Hello {user?.firstName}</div>;
}
```

### Database
```tsx
import { useFirebaseUser } from '@/hooks/useFirebaseUser';

function MyComponent() {
  const { userData, loading } = useFirebaseUser();
  // Access Firebase user data
}
```

### Chat
```tsx
import { useStreamChat } from '@/hooks/useStreamChat';

function MyComponent() {
  const { client, isConnecting } = useStreamChat();
  // Use Stream client
}
```

---

## 📖 Next Steps

1. ✅ **Done:** Infrastructure connected via Doppler
2. 📝 **Next:** Share your Figma designs
3. 🎨 **Then:** Start building features

---

## 📚 Additional Documentation

- **[DOPPLER_SETUP.md](./DOPPLER_SETUP.md)** - Complete Doppler guide
- **[README.md](./README.md)** - Full project documentation
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Code snippets
- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)** - Architecture details

---

## 💡 Pro Tips

1. **Always use Doppler:** `npm run dev` (not `npm run dev:local`)
2. **Never commit secrets:** They live in Doppler, not in files
3. **Check status often:** Run `./check-doppler.sh` when in doubt
4. **Keep secrets synced:** Team changes are automatic via Doppler
5. **Use environments:** Switch between dev/staging/prod with `doppler setup`

---

## 🔐 Security Reminders

- ✅ All secrets in Doppler
- ✅ Never commit `.env` files
- ✅ Don't share secrets via Slack/Email
- ✅ Use service tokens for CI/CD
- ✅ Rotate secrets regularly via Doppler

---

## 🎉 You're Ready!

Your development environment is now powered by Doppler. All secrets are secure, synced, and ready to use.

**Start building:** `npm run dev`

🔐 **Remember: Doppler is your single source of truth!**
