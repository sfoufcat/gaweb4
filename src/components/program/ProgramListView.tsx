'use client';

import Image from 'next/image';
import { ArrowRight, Users, User } from 'lucide-react';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';

/**
 * ProgramListView Component
 * 
 * Shows when user has 2 programs (group + individual).
 * Displays program cards with overview info and "View details" CTA.
 */

interface ProgramListViewProps {
  enrollments: EnrolledProgramWithDetails[];
  onSelectProgram: (programId: string) => void;
}

export function ProgramListView({ enrollments, onSelectProgram }: ProgramListViewProps) {
  return (
    <div className="space-y-4">
      <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
        Your Programs
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
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
  const { program, progress, cohort } = enrolled;
  const isGroup = program.type === 'group';

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden text-left hover:shadow-lg dark:hover:shadow-black/30 transition-all group"
    >
      {/* Cover Image */}
      <div className="relative h-[140px] w-full bg-[#f3f1ef] dark:bg-[#262b35]">
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
            {isGroup ? (
              <Users className="w-12 h-12 text-[#d4cfc9] dark:text-[#7d8190]" />
            ) : (
              <User className="w-12 h-12 text-[#d4cfc9] dark:text-[#7d8190]" />
            )}
          </div>
        )}

        {/* Program type badge */}
        <div className="absolute top-3 left-3">
          <div
            className={`rounded-full px-3 py-1 flex items-center gap-1.5 ${
              isGroup
                ? 'bg-blue-500/90 backdrop-blur-sm'
                : 'bg-purple-500/90 backdrop-blur-sm'
            }`}
          >
            {isGroup ? (
              <Users className="w-3.5 h-3.5 text-white" />
            ) : (
              <User className="w-3.5 h-3.5 text-white" />
            )}
            <span className="font-sans text-[12px] font-medium text-white">
              {isGroup ? 'Group' : '1:1'}
            </span>
          </div>
        </div>

        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
          <div
            className="h-full bg-white dark:bg-[#f5f5f8] transition-all"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] mb-1 line-clamp-1">
          {program.name}
        </h3>

        {/* Coach name */}
        <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] mb-3">
          with {program.coachName}
        </p>

        {/* Progress info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8]">
              Day {progress.currentDay}
            </span>
            <span className="text-text-secondary dark:text-[#7d8190]">/</span>
            <span className="font-albert text-[14px] text-text-secondary dark:text-[#7d8190]">
              {progress.totalDays}
            </span>
          </div>

          {/* View details arrow */}
          <div className="flex items-center gap-1 text-text-secondary dark:text-[#7d8190] group-hover:text-text-primary dark:group-hover:text-[#f5f5f8] transition-colors">
            <span className="font-albert text-[14px] font-medium">View</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Cohort info if applicable */}
        {cohort && (
          <p className="mt-2 font-sans text-[12px] text-text-secondary/70 dark:text-[#7d8190]/70">
            {cohort.name}
          </p>
        )}
      </div>
    </button>
  );
}

