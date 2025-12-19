# GAweb3 - Productivity & Accountability Web App

A modern web application for productivity and accountability built with Next.js, Firebase, Clerk, and Stream Chat.

**🔐 Environment Variables: Managed via [Doppler](https://doppler.com) (Single Source of Truth)**

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Database**: Firebase Firestore
- **Real-time Chat**: Stream Chat
- **Environment Management**: **Doppler (Required)**

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- **Doppler CLI** (required)
- Clerk account
- Firebase project
- Stream Chat account

### 1. Clone and Install Dependencies

```bash
cd GAweb3
npm install
```

### 2. Setup Doppler (Single Source of Truth)

```bash
# Run the setup script
./setup-doppler.sh
```

This will:
- Install/verify Doppler CLI
- Authenticate you with Doppler
- Configure the project
- Verify all secrets are accessible

### 3. Add Secrets to Doppler

```bash
# Open Doppler dashboard in browser
npm run doppler:open
```

Add all required secrets (see [DOPPLER_SETUP.md](./DOPPLER_SETUP.md) for full list)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Note:** `npm run dev` now uses Doppler by default. All commands are Doppler-first.

---

## 📦 Project Structure

```
GAweb3/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   │   ├── stream-token/   # Stream token generation
│   │   │   └── webhooks/       # Webhook handlers
│   │   ├── layout.tsx    # Root layout with Clerk provider
│   │   └── page.tsx      # Home page
│   ├── lib/              # Utility libraries
│   │   ├── firebase.ts          # Firebase client SDK
│   │   ├── firebase-admin.ts    # Firebase Admin SDK
│   │   ├── stream-client.ts     # Stream Chat client
│   │   ├── stream-server.ts     # Stream Chat server
│   │   └── clerk-firebase-sync.ts # Clerk-Firebase integration
│   ├── hooks/            # Custom React hooks
│   ├── components/       # UI components
│   ├── types/           # TypeScript definitions
│   └── middleware.ts     # Clerk authentication middleware
├── .env.example          # Example environment variables
├── doppler.yaml          # Doppler configuration
├── setup-doppler.sh      # Doppler setup script
├── check-doppler.sh      # Check Doppler status
└── DOPPLER_SETUP.md      # Detailed Doppler guide
```

---

## 🔑 Environment Variables (Doppler)

All environment variables are managed through Doppler. You need **20 secrets** configured:

- **Clerk**: 7 secrets (Authentication)
- **Firebase**: 10 secrets (Database)
- **Stream**: 2 secrets (Chat)
- **App**: 1 secret (Configuration)

See [DOPPLER_SETUP.md](./DOPPLER_SETUP.md) for the complete list and setup instructions.

---

## 💻 npm Scripts

### Development (Doppler-first)
```bash
npm run dev              # Run with Doppler (default)
npm run dev:local        # Run with .env.local (fallback)
```

### Build & Production
```bash
npm run build            # Build with Doppler
npm run start            # Start with Doppler
npm run build:local      # Build with .env.local
npm run start:local      # Start with .env.local
```

### Doppler Management
```bash
npm run doppler:setup    # Setup/configure Doppler
npm run doppler:open     # Open dashboard in browser
npm run doppler:secrets  # List all secrets in terminal
npm run doppler:sync     # Download secrets to .env.local (backup)
```

### Other
```bash
npm run lint             # Run ESLint
```

---

## 🏗️ Infrastructure Features

### Authentication (Clerk)
- User authentication and management
- Protected routes via middleware
- Webhook integration for user sync
- Session management

### Database (Firebase)
- Firestore for data storage
- Real-time updates
- User profile sync from Clerk
- Cloud Storage for file uploads

### Chat (Stream)
- Real-time messaging
- Token-based authentication
- React components ready
- User presence and typing indicators

### Environment Variables (Doppler)
- **Single source of truth**
- Secure secret management
- Team collaboration
- Environment-specific configs
- CI/CD integration

---

## 🔐 Security

- All secrets stored in Doppler (never in code)
- Clerk handles authentication securely
- Firebase Admin SDK for server-side operations only
- Stream tokens generated server-side
- Webhook signature verification
- Environment-specific configurations

---

## 👥 Team Collaboration

New team member setup:
```bash
doppler login
cd /path/to/GAweb3
./setup-doppler.sh
npm run dev
```

That's it! They automatically get all secrets from Doppler.

---

## 🚀 Deployment

### Vercel (Recommended)

1. Install [Doppler Vercel Integration](https://vercel.com/integrations/doppler)
2. Connect your repository to Vercel
3. Link Doppler project to Vercel project
4. Deploy

Doppler will automatically sync all secrets to Vercel.

### Other Platforms

Use Doppler Service Tokens:

```bash
# Generate service token in Doppler dashboard
# Add to CI/CD as DOPPLER_TOKEN

# In your deployment script:
doppler run --token=$DOPPLER_TOKEN -- npm run build
```

---

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Detailed setup guide
- **[DOPPLER_SETUP.md](./DOPPLER_SETUP.md)** - Complete Doppler documentation
- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)** - Architecture overview
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Code examples
- **[DOCS_INDEX.md](./DOCS_INDEX.md)** - Documentation index

---

## 🔍 Check Doppler Status

```bash
./check-doppler.sh
```

This will show:
- Doppler CLI version
- Authentication status
- Current project/config
- Number of secrets
- Available commands

---

## 🐛 Troubleshooting

### Doppler not installed
```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux
curl -Ls https://cli.doppler.com/install.sh | sudo sh
```

### Not authenticated
```bash
doppler login
```

### Can't fetch secrets
```bash
./setup-doppler.sh
```

### Need to work offline
```bash
# Download secrets to .env.local
npm run doppler:sync

# Use local environment
npm run dev:local
```

---

## 🎯 Key Features Ready to Build

- User dashboards
- Task/goal management
- Team collaboration
- Real-time notifications
- Chat rooms & DMs
- Activity tracking
- Accountability groups
- Progress analytics
- File sharing

---

## 📖 API Routes

- `GET /api/stream-token` - Generate Stream Chat token for authenticated users
- `POST /api/webhooks/clerk` - Handle Clerk user events (create, update, delete)

---

## 🤝 Contributing

1. Get access to Doppler project
2. Run `./setup-doppler.sh`
3. Create your feature branch
4. Implement features with TypeScript
5. Test with Doppler environment
6. Submit PR

---

## 📞 Support

### Environment Issues
- Run `./check-doppler.sh` for diagnostics
- See [DOPPLER_SETUP.md](./DOPPLER_SETUP.md)

### Service Documentation
- **Clerk**: [clerk.com/docs](https://clerk.com/docs)
- **Firebase**: [firebase.google.com/docs](https://firebase.google.com/docs)
- **Stream**: [getstream.io/chat/docs](https://getstream.io/chat/docs/)
- **Doppler**: [docs.doppler.com](https://docs.doppler.com)

---

## ⚡ Quick Commands Reference

```bash
# Setup
./setup-doppler.sh              # First-time setup
./check-doppler.sh              # Check status

# Development
npm run dev                     # Start dev server
npm run doppler:open           # Open Doppler dashboard
npm run doppler:secrets        # View secrets

# Team
doppler login                   # Login to Doppler
doppler setup                   # Configure project
```

---

## 🎉 Status

✅ Infrastructure Complete  
✅ Doppler Integrated (Single Source of Truth)  
✅ All Services Connected  
✅ Ready for Feature Development  

---

**🔐 Remember: All secrets live in Doppler. Never commit `.env` files!**

## License

MIT
