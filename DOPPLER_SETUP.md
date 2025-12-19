# 🔐 Doppler Setup Guide - Single Source of Truth

**Doppler is the single source of truth for all environment variables in this project.**

## Why Doppler?

- ✅ Centralized secret management
- ✅ Team collaboration without sharing `.env` files
- ✅ Environment-specific configurations (dev, staging, prod)
- ✅ Automatic syncing across team
- ✅ Audit logs for secret access
- ✅ Easy CI/CD integration
- ✅ No more `.env` files in Slack/Email

---

## 🚀 Quick Start

### 1. Install Doppler CLI

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

### 2. Run Setup Script
```bash
./setup-doppler.sh
```

This will:
- Check if Doppler is installed
- Authenticate you with Doppler
- Setup the project configuration
- Verify everything is working

### 3. That's It! 
All your secrets are now managed through Doppler. Run:
```bash
npm run dev
```

---

## 📋 Required Secrets in Doppler

Make sure these secrets are configured in your Doppler project:

### Clerk (Authentication) - 7 secrets
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### Firebase (Database) - 10 secrets
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

### Stream Chat - 2 secrets
```
NEXT_PUBLIC_STREAM_API_KEY
STREAM_API_SECRET
```

### Stripe (Payments) - 7 secrets
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_TRIAL_WEEKLY_PRICE_ID        # $9.99/week trial (converts to standard monthly)
STRIPE_STANDARD_MONTHLY_PRICE_ID    # $39.99/month standard plan
STRIPE_PREMIUM_MONTHLY_PRICE_ID     # $99/month premium plan
STRIPE_STANDARD_HALF_YEAR_PRICE_ID  # (optional) 6-month standard pricing
STRIPE_PREMIUM_HALF_YEAR_PRICE_ID   # (optional) 6-month premium pricing
```

### App Configuration - 1 secret
```
NEXT_PUBLIC_APP_URL
```

### Email (Resend) - 1 secret
```
RESEND_API_KEY
```

### Cron Jobs - 1 secret
```
CRON_SECRET
```

**Total: 28 secrets**

---

## 🎯 Common Commands

### Development
```bash
# Run dev server (uses Doppler automatically)
npm run dev

# Run dev server without Doppler (uses .env.local)
npm run dev:local
```

### Manage Secrets
```bash
# Open Doppler dashboard in browser
npm run doppler:open

# List all secrets in terminal
npm run doppler:secrets

# View specific secret
doppler secrets get SECRET_NAME

# Set a secret
doppler secrets set SECRET_NAME=value

# Download secrets to .env.local (for backup/debugging)
npm run doppler:sync
```

### Build & Deploy
```bash
# Build with Doppler
npm run build

# Start production with Doppler
npm run start

# Build without Doppler
npm run build:local
```

### Configuration
```bash
# Setup/change project
npm run doppler:setup

# View current config
doppler configure get

# Switch environment (dev, staging, prod)
doppler setup --config staging
```

---

## 🏗️ Project Structure

### Environments

Create these configs in your Doppler project:

1. **dev** - Development environment
   - Used by developers locally
   - Contains test API keys
   
2. **staging** - Staging environment
   - Pre-production testing
   - Mirrors production setup
   
3. **prod** - Production environment
   - Live application
   - Production API keys

### Switching Environments
```bash
# Switch to staging
doppler setup --config staging

# Switch back to dev
doppler setup --config dev
```

---

## 👥 Team Collaboration

### Adding Team Members

1. Invite team member in Doppler dashboard
2. They run:
   ```bash
   doppler login
   cd /path/to/project
   ./setup-doppler.sh
   npm run dev
   ```

That's it! They automatically get all the secrets.

### Benefits
- ✅ No sharing `.env` files over Slack/Email
- ✅ Instant secret updates for everyone
- ✅ Granular access control
- ✅ Audit logs of who accessed what

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3
      
      - name: Build
        run: doppler run -- npm run build
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}
```

### Service Token Setup
1. Go to Doppler Dashboard
2. Navigate to your project > Access
3. Create a Service Token for the environment
4. Add to GitHub Secrets as `DOPPLER_TOKEN`

---

## 🚀 Vercel Deployment

### Option 1: Doppler Integration (Recommended)

1. Install [Doppler Vercel Integration](https://vercel.com/integrations/doppler)
2. Connect your Vercel project
3. Select Doppler project and config
4. Deploy!

Doppler will automatically sync all secrets to Vercel.

### Option 2: Manual Sync

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Sync secrets from Doppler to Vercel
doppler secrets download --no-file --format env | vercel env add production
```

---

## 🔐 Security Best Practices

### DO ✅
- Use Doppler for ALL environments
- Rotate secrets regularly via Doppler dashboard
- Use service tokens for CI/CD
- Review audit logs periodically
- Use different projects for different apps

### DON'T ❌
- Don't commit `.env` files (already in `.gitignore`)
- Don't share secrets via Slack/Email
- Don't hardcode secrets in code
- Don't use same secrets across environments
- Don't share your personal Doppler token

---

## 🐛 Troubleshooting

### "Doppler CLI not found"
```bash
# Install Doppler CLI
brew install dopplerhq/cli/doppler  # macOS
```

### "Not logged in"
```bash
doppler login
```

### "Unable to fetch secrets"
```bash
# Re-setup the project
npm run doppler:setup
```

### "npm run dev fails"
```bash
# Check Doppler status
./check-doppler.sh

# Or use local .env.local as fallback
npm run dev:local
```

### Check Current Status
```bash
# View current configuration and secrets
./check-doppler.sh
```

---

## 📊 Doppler Dashboard

Access your secrets in the browser:
```bash
npm run doppler:open
```

Or visit: [https://dashboard.doppler.com](https://dashboard.doppler.com)

---

## 🔄 Migrating from .env.local

If you have existing `.env.local` file:

```bash
# Upload all secrets to Doppler
doppler secrets upload .env.local

# Verify
npm run doppler:secrets

# Delete local file (now in Doppler)
rm .env.local
```

---

## 📝 Local Development Without Doppler

If you need to work offline or without Doppler:

```bash
# Download secrets to .env.local
npm run doppler:sync

# Use local .env.local
npm run dev:local
```

**Note:** This is only for emergency/offline work. Always use Doppler when possible.

---

## 🎓 Advanced Usage

### Multiple Projects
```bash
# List all projects
doppler projects list

# Switch project
doppler setup
```

### Secret References
```bash
# Reference another secret
doppler secrets set API_URL=https://api.${DOMAIN}/v1
```

### Dynamic Secrets
```bash
# Use templating
doppler secrets set DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}"
```

---

## 📚 Additional Resources

- [Doppler Documentation](https://docs.doppler.com)
- [Doppler CLI Reference](https://docs.doppler.com/docs/cli)
- [Doppler Integrations](https://docs.doppler.com/docs/integrations)
- [Doppler Best Practices](https://docs.doppler.com/docs/best-practices)

---

## ✅ Checklist

Before starting development:

- [ ] Doppler CLI installed
- [ ] Logged in to Doppler (`doppler login`)
- [ ] Project configured (`./setup-doppler.sh`)
- [ ] All 20 secrets added to Doppler
- [ ] Verified with `./check-doppler.sh`
- [ ] Successfully ran `npm run dev`

---

## 🆘 Need Help?

1. Run `./check-doppler.sh` to diagnose issues
2. Check [Doppler Status](https://status.doppler.com)
3. Review [Doppler Docs](https://docs.doppler.com)
4. Contact team lead for access issues

---

**Remember: Doppler is your single source of truth. All secrets live there! 🔐**
