'use client';

interface SectionHeaderProps {
  title: string;
  viewAllHref?: string;
}

export function SectionHeader({ title, viewAllHref }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
        {title}
      </h2>
      {viewAllHref && (
        <a 
          href={viewAllHref}
          className="font-sans text-sm text-text-secondary leading-[1.2] hover:text-text-primary transition-colors"
        >
          View all
        </a>
      )}
    </div>
  );
}

