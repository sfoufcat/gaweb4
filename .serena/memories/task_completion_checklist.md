# Task Completion Checklist

When completing a coding task in this project, ensure the following:

## Before Committing
1. **Run Lint**: `npm run lint`
   - Fix any errors
   - Warnings are acceptable but review them

2. **Run Build**: `npm run build`
   - Ensure no TypeScript errors
   - Ensure no build failures

3. **Type Check** (optional standalone): `npx tsc --noEmit`
   - Verify TypeScript types are correct

## Code Quality Checks
- [ ] No `console.log` statements left in code (use proper logging if needed)
- [ ] No hardcoded secrets or credentials
- [ ] Proper error handling in API routes
- [ ] Loading and error states handled in UI components
- [ ] Clerk `auth()` used for authentication in API routes

## Testing Considerations
- Manual testing in browser for UI changes
- Test with Doppler secrets (`npm run dev`)
- Test multi-tenant behavior if relevant

## Common Issues to Avoid
- Missing `'use client'` directive in client components
- Improper async/await usage in Server Components
- Not handling loading states in hooks
- Not using path alias `@/*` for imports
