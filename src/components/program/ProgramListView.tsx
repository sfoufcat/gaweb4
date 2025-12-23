'use client';

import Image from 'next/image';
import { ArrowRight, Phone } from 'lucide-react';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';

/**
 * ProgramListView Component
 * 
 * Matches Figma design for program list screen.
 * Shows when user has 2 programs (group + individual).
 * Displays program cards with:
 * - Cover image with year overlay
 * - Program name and description
 * - Enrolled badge + progress pill (same height)
 * - Program overview row (real member avatars + coach info)
 * - "View program details" button
 */

interface ProgramListViewProps {
  enrollments: EnrolledProgramWithDetails[];
  onSelectProgram: (programId: string) => void;
}

export function ProgramListView({ enrollments, onSelectProgram }: ProgramListViewProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
        Your Programs
      </h2>

      <div className="space-y-4">
        {enrollments.map((enrolled) => (
          <ProgramListCard
            key={enrolled.program.id}
            enrolled={enrolled}
            onClick={() => onSelectProgram(enrolled.program.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ProgramListCardProps {
  enrolled: EnrolledProgramWithDetails;
  onClick: () => void;
}

function ProgramListCard({ enrolled, onClick }: ProgramListCardProps) {
  const { program, progress, squad, squadMembers } = enrolled;
  const isGroup = program.type === 'group';

  // Calculate week progress
  const weekProgress = Math.ceil(progress.currentDay / 7);
  const totalWeeks = Math.ceil(progress.totalDays / 7);

  // Member count from squad memberIds
  const memberCount = squad?.memberIds?.length || 0;

  return (
    <div className="bg-[#f3f1ef] dark:bg-[#171b22] rounded-[20px] overflow-hidden p-2">
      {/* Cover Image */}
      <div className="relative h-[220px] w-full rounded-[20px] overflow-hidden bg-gray-200 dark:bg-gray-800">
        {program.coverImageUrl ? (
          <Image
            src={program.coverImageUrl}
            alt={program.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-albert text-[72px] font-bold text-[#d4cfc9] dark:text-[#7d8190]">
              {program.name[0]}
            </span>
          </div>
        )}

        {/* Year badge overlay */}
        <div className="absolute bottom-3 right-3 bg-black/35 rounded-[20px] px-2 py-1">
          <span className="font-sans text-[12px] text-text-muted leading-[1.2]">
            {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-2 space-y-3">
        {/* Title */}
        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
          {program.name}
        </h3>

        {/* Description */}
        {program.description && (
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px] line-clamp-2">
            {program.description}
          </p>
        )}

        {/* Badges Row: Enrolled + Progress - same height */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Enrolled Badge */}
          <div className="bg-[rgba(76,175,80,0.15)] h-7 px-3 rounded-full flex items-center">
            <span className="font-sans text-[13px] font-medium text-[#4caf50] leading-none">
              Enrolled
            </span>
          </div>

          {/* Progress Pill */}
          <div className="bg-white dark:bg-[#11141b] h-7 px-3 rounded-full flex items-center gap-2">
            <svg className="w-4 h-4 text-text-secondary dark:text-[#7d8190]" viewBox="0 0 15 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M1 9.5V13h3.5V9.5H1zm5-4V13h3.5V5.5H6zm5-4V13h3V1.5h-3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-sans text-[13px] font-medium text-text-secondary dark:text-[#7d8190] leading-none">
              Week {weekProgress}/{totalWeeks}
            </span>
          </div>
        </div>

        {/* Program Overview Row */}
        <div className="flex items-center gap-2 py-2">
          {isGroup ? (
            /* Group: Real member avatars + members + coach */
            <>
              {/* Stacked Avatars - Real member photos */}
              <div className="flex items-center -space-x-2">
                {(squadMembers && squadMembers.length > 0 
                  ? squadMembers.slice(0, 3) 
                  : [null, null, null]
                ).map((member, i) => (
                  <div
                    key={member?.id || i}
                    className="w-8 h-8 rounded-full border-2 border-[#f3f1ef] dark:border-[#171b22] overflow-hidden bg-[#d4cfc9] dark:bg-[#7d8190]"
                  >
                    {member?.imageUrl ? (
                      <Image
                        src={member.imageUrl}
                        alt={`${member.firstName} ${member.lastName}`}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs font-medium text-white">
                          {member?.firstName?.[0] || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col ml-1">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  Group program
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  {memberCount > 0 ? `${memberCount} member${memberCount !== 1 ? 's' : ''}` : 'With peers'}
                </span>
              </div>

              <div className="flex-1" />

              {/* Coach */}
              <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-white dark:bg-[#262b35]">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={38}
                    height={38}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-albert font-semibold text-sm text-text-secondary dark:text-[#7d8190]">
                      {program.coachName[0]}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  {program.coachName}
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  Coach
                </span>
              </div>
            </>
          ) : (
            /* 1:1: Phone icon + session + coach */
            <>
              <Phone className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" />

              <div className="flex flex-col ml-1">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  1:1 Program
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  Private coaching
                </span>
              </div>

              <div className="flex-1" />

              {/* Coach */}
              <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-white dark:bg-[#262b35]">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={38}
                    height={38}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-albert font-semibold text-sm text-text-secondary dark:text-[#7d8190]">
                      {program.coachName[0]}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[20px] tracking-[0.1px]">
                  {program.coachName}
                </span>
                <span className="font-sans text-[11px] text-text-secondary dark:text-[#7d8190] leading-[16px] tracking-[0.5px]">
                  Coach
                </span>
              </div>
            </>
          )}
        </div>

        {/* View Program Details Button */}
        <button
          onClick={onClick}
          className="w-full bg-white dark:bg-[#11141b] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-[#2c2520] dark:text-[#f5f5f8] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.1)] hover:shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>View program details</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
