import { ProgramSkeleton } from '@/components/program/ProgramSkeleton';

export default function ProgramLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      <ProgramSkeleton />
    </div>
  );
}
