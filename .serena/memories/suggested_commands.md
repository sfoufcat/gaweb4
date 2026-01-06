# Suggested Commands

## Development Commands
```bash
# Development (requires Doppler CLI for secrets)
npm run dev              # Start dev server with Doppler
npm run dev:local        # Start with .env.local (fallback for offline)

# Build & Production
npm run build            # Build for production
npm run start            # Start production server

# Linting
npm run lint             # Run ESLint (Next.js lint)
```

## Doppler (Secrets Management)
```bash
npm run doppler:setup    # Configure Doppler project
npm run doppler:open     # Open Doppler dashboard
npm run doppler:secrets  # List all secrets
npm run doppler:sync     # Download secrets to .env.local
```

## Git Commands
```bash
git status               # Show working tree status
git diff                 # Show unstaged changes
git add .                # Stage all changes
git commit -m "message"  # Commit with message
git push                 # Push to remote
git pull                 # Pull from remote
git log --oneline -10    # Show recent commits
```

## File System Commands (macOS/Darwin)
```bash
ls -la                   # List files with details
find . -name "*.ts"      # Find TypeScript files
grep -r "pattern" src/   # Search for pattern in src
```

## TypeScript
```bash
npx tsc --noEmit         # Type check without emitting
```
