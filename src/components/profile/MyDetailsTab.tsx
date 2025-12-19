'use client';

import type { FirebaseUser } from '@/types';

interface MyDetailsTabProps {
  user: FirebaseUser;
}

export function MyDetailsTab({ user }: MyDetailsTabProps) {
  return (
    <div className="flex flex-col gap-6 py-5">
      {/* About Me */}
      {user.bio && (
        <div className="space-y-3">
          <h3 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
            About me
          </h3>
          <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
            {user.bio}
          </p>
        </div>
      )}

      {/* My Interests */}
      {user.interests && (
        <div className="space-y-3">
          <h3 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
            My interests
          </h3>
          <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
            {user.interests}
          </p>
        </div>
      )}

      {/* My Contacts and Social */}
      <div className="space-y-3">
        <h3 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
          My contacts and social
        </h3>

        <div className="space-y-3">
          {/* Phone */}
          {user.phoneNumber && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {user.phoneNumber}
              </p>
            </div>
          )}

          {/* Email */}
          {user.email && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {user.email}
              </p>
            </div>
          )}

          {/* Instagram */}
          {user.instagramHandle && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {user.instagramHandle}
              </p>
            </div>
          )}

          {/* LinkedIn */}
          {user.linkedinHandle && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {user.linkedinHandle}
              </p>
            </div>
          )}

          {/* Twitter/X */}
          {user.twitterHandle && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {user.twitterHandle}
              </p>
            </div>
          )}

          {/* Website */}
          {user.websiteUrl && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {user.websiteUrl}
              </p>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!user.phoneNumber && !user.email && !user.instagramHandle && !user.linkedinHandle && !user.twitterHandle && !user.websiteUrl && (
          <p className="font-sans text-sm text-text-muted italic py-4">
            No contact information available
          </p>
        )}
      </div>
    </div>
  );
}

