# Onboarding Implementation - Testing Checklist

## ✅ Pre-Testing Setup

Before testing, ensure:
- [ ] Firebase is configured and accessible
- [ ] Clerk authentication is set up
- [ ] Development server is running (`npm run dev`)

## 🧪 Test Scenarios

### 1. New User Complete Flow
- [ ] Create a new account via Clerk signup
- [ ] Verify redirect to `/onboarding/welcome`
- [ ] Click "Let's Crush It!" button
- [ ] Verify navigation to `/onboarding/create-profile-intro`
- [ ] Click "Next" button
- [ ] Verify navigation to profile edit with `fromOnboarding=true`
- [ ] Fill out profile form (at least name)
- [ ] Click "Save" button
- [ ] Verify redirect to `/onboarding` (mission page, NOT profile view)
- [ ] Complete mission statement
- [ ] Verify redirect to `/onboarding/goal`
- [ ] Set a goal with target date
- [ ] Verify redirect to `/onboarding/commitment`
- [ ] Click "Let's go!" button
- [ ] Verify redirect to home dashboard (`/`)
- [ ] Log out and log back in
- [ ] Verify you go directly to home (not onboarding)

### 2. Skip Profile Flow
- [ ] Create a new account
- [ ] Navigate through welcome to create-profile-intro
- [ ] Click "I'll do it later in settings" button
- [ ] Verify direct redirect to `/onboarding` (mission)
- [ ] Complete remaining steps
- [ ] Verify profile was NOT filled out
- [ ] Navigate to profile page manually later
- [ ] Edit profile normally
- [ ] Verify it saves and returns to profile view (not mission)

### 3. Resume Mid-Onboarding
- [ ] Create a new account
- [ ] Start onboarding, get to mission step
- [ ] Close browser/log out WITHOUT completing
- [ ] Log back in
- [ ] Verify redirect back to `/onboarding` (mission step)
- [ ] Complete onboarding from there
- [ ] Verify completion works properly

### 4. Edit Profile After Onboarding
- [ ] Complete onboarding as a new user
- [ ] Navigate to profile page
- [ ] Click edit profile
- [ ] Verify URL is `/profile?edit=true` (NO fromOnboarding)
- [ ] Make changes and save
- [ ] Verify redirect back to profile view (not mission)

### 5. Existing Users (Already Completed)
- [ ] Log in as an existing user with `hasCompletedOnboarding: true`
- [ ] Verify direct navigation to home dashboard
- [ ] Verify no onboarding screens appear

## 🔍 Database Verification

Check Firebase for proper field updates:

### New User Creation
- [ ] Document created in `users` collection
- [ ] Field `onboardingStatus` = `'welcome'`
- [ ] Field `hasCompletedOnboarding` = `false`

### During Onboarding
- [ ] After welcome: `onboardingStatus` = `'create_profile_intro'`
- [ ] After profile intro → next: `onboardingStatus` = `'edit_profile'`
- [ ] After profile save: `onboardingStatus` = `'mission'`
- [ ] Profile fields populated if user chose "Next"
- [ ] Profile fields empty if user chose "Skip"

### After Completion
- [ ] Field `onboardingStatus` = `'completed'`
- [ ] Field `hasCompletedOnboarding` = `true`
- [ ] Field `identity` is set (mission)
- [ ] Field `goal` is set
- [ ] Field `goalTargetDate` is set

## 🎨 UI/UX Verification

### Welcome Screen
- [ ] Gradient heading displays correctly
- [ ] Checklist items render properly
- [ ] Yellow "Let's Crush It!" button styled correctly
- [ ] Responsive on mobile and desktop
- [ ] Matches Figma design

### Create Profile Intro
- [ ] Heading and text render properly
- [ ] Two buttons display correctly:
  - [ ] Dark "Next" button (primary)
  - [ ] Light "I'll do it later" button (secondary)
- [ ] Responsive on mobile and desktop
- [ ] Matches Figma design

### Profile Edit (Onboarding Mode)
- [ ] Form displays all fields
- [ ] Avatar edit button works
- [ ] Save button triggers onboarding flow
- [ ] Cancel button returns to create-profile-intro
- [ ] No visual difference from normal edit mode

## 🐛 Edge Cases

- [ ] User refreshes page mid-onboarding → stays on same step
- [ ] User manually navigates to home → redirects back to onboarding
- [ ] User manually navigates to a later onboarding step → allowed or redirected?
- [ ] Network error during save → error message displays
- [ ] Empty form submission → validation works
- [ ] Special characters in profile fields → saves properly

## 🚨 Error Scenarios

- [ ] Firebase connection fails → appropriate error message
- [ ] API endpoint fails → user sees error, can retry
- [ ] Clerk authentication issues → handled gracefully
- [ ] Missing required data → form validation prevents submit

## 📱 Responsive Design

Test on different screen sizes:
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1440px)
- [ ] Large desktop (1920px)

Verify:
- [ ] Buttons remain full width and properly sized
- [ ] Text remains readable
- [ ] Spacing looks correct
- [ ] No horizontal scroll
- [ ] CTA buttons stay at bottom

## ⚡ Performance

- [ ] Pages load quickly (< 1s)
- [ ] No unnecessary re-renders
- [ ] Smooth transitions between pages
- [ ] No console errors
- [ ] No console warnings

## 🔐 Security

- [ ] Unauthenticated users redirected to home/login
- [ ] Users can only update their own onboarding status
- [ ] API endpoints require authentication
- [ ] No sensitive data exposed in URLs or client-side

## 📊 Analytics (Future)

Consider tracking:
- [ ] Onboarding start rate
- [ ] Completion rate per step
- [ ] Drop-off points
- [ ] Time to complete
- [ ] Profile skip rate vs complete rate

## ✨ Final Checks

- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] No console errors in browser
- [ ] All TODOs completed
- [ ] Documentation is clear and accurate
- [ ] Code is commented where necessary
- [ ] Git status shows expected changes

## 🚀 Ready for Deployment

Once all checks pass:
- [ ] Create a git commit with descriptive message
- [ ] Test in staging environment
- [ ] Get code review approval
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Verify with a real test user

---

## 📝 Notes Section

Use this space to document any issues found during testing:

### Issues Found:
1. 
2. 
3. 

### Fixes Applied:
1. 
2. 
3. 

### Known Limitations:
1. 
2. 
3. 

---

**Test Date**: _________________
**Tester**: _________________
**Status**: ⬜ Pass | ⬜ Fail | ⬜ Pass with Notes















