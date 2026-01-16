'use client';

import React, { useState } from 'react';
import { GraduationCap, FileText, Download, Link2, FileQuestion, X, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DayCourseSelector } from './DayCourseSelector';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';
import type { DayCourseAssignment } from '@/types';
import type { DiscoverCourse } from '@/types/discover';

// Resource types
type ResourceType = 'courses' | 'articles' | 'downloads' | 'links' | 'questionnaires';

interface ResourceTabConfig {
  id: ResourceType;
  label: string;
  shortLabel: string; // For mobile
  icon: LucideIcon;
}

const TABS: ResourceTabConfig[] = [
  { id: 'courses', label: 'Courses', shortLabel: 'Courses', icon: GraduationCap },
  { id: 'articles', label: 'Articles', shortLabel: 'Articles', icon: FileText },
  { id: 'downloads', label: 'Downloads', shortLabel: 'Files', icon: Download },
  { id: 'links', label: 'Links', shortLabel: 'Links', icon: Link2 },
  { id: 'questionnaires', label: 'Forms', shortLabel: 'Forms', icon: FileQuestion },
];

// Generic resource item shape
interface ResourceItem {
  id: string;
  title: string;
  programId?: string;
}

interface ResourcesTabsProps {
  // Courses
  courseAssignments: DayCourseAssignment[];
  onCourseAssignmentsChange: (assignments: DayCourseAssignment[]) => void;
  availableCourses: DiscoverCourse[];

  // Articles
  linkedArticleIds: string[];
  availableArticles: ResourceItem[];
  onAddArticle: (id: string) => void;
  onRemoveArticle: (id: string) => void;

  // Downloads
  linkedDownloadIds: string[];
  availableDownloads: ResourceItem[];
  onAddDownload: (id: string) => void;
  onRemoveDownload: (id: string) => void;

  // Links
  linkedLinkIds: string[];
  availableLinks: ResourceItem[];
  onAddLink: (id: string) => void;
  onRemoveLink: (id: string) => void;

  // Questionnaires
  linkedQuestionnaireIds: string[];
  availableQuestionnaires: ResourceItem[];
  onAddQuestionnaire: (id: string) => void;
  onRemoveQuestionnaire: (id: string) => void;

  // Program ID for filtering program vs platform content
  programId?: string;
}

// Sub-component for linked items display
function LinkedItemsList({
  items,
  icon: Icon,
  onRemove,
}: {
  items: { id: string; title: string }[];
  icon: LucideIcon;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 bg-white dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] group"
        >
          <Icon className="w-4 h-4 text-brand-accent flex-shrink-0" />
          <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
            {item.title}
          </span>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="p-1.5 text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ResourcesTabs({
  courseAssignments,
  onCourseAssignmentsChange,
  availableCourses,
  linkedArticleIds,
  availableArticles,
  onAddArticle,
  onRemoveArticle,
  linkedDownloadIds,
  availableDownloads,
  onAddDownload,
  onRemoveDownload,
  linkedLinkIds,
  availableLinks,
  onAddLink,
  onRemoveLink,
  linkedQuestionnaireIds,
  availableQuestionnaires,
  onAddQuestionnaire,
  onRemoveQuestionnaire,
  programId,
}: ResourcesTabsProps) {
  const [activeTab, setActiveTab] = useState<ResourceType>('courses');

  // Get count for each resource type (for badge display)
  const getCounts = () => ({
    courses: courseAssignments.length,
    articles: linkedArticleIds.length,
    downloads: linkedDownloadIds.length,
    links: linkedLinkIds.length,
    questionnaires: linkedQuestionnaireIds.length,
  });

  const counts = getCounts();

  // Filter available items (exclude already linked)
  const availableArticlesToLink = availableArticles.filter(
    (a) => !linkedArticleIds.includes(a.id)
  );
  const availableDownloadsToLink = availableDownloads.filter(
    (d) => !linkedDownloadIds.includes(d.id)
  );
  const availableLinksToLink = availableLinks.filter(
    (l) => !linkedLinkIds.includes(l.id)
  );
  const availableQuestionnairesToLink = availableQuestionnaires.filter(
    (q) => !linkedQuestionnaireIds.includes(q.id)
  );

  // Split into program vs platform content
  const programArticles = availableArticlesToLink.filter((a) => a.programId === programId);
  const platformArticles = availableArticlesToLink.filter((a) => a.programId !== programId);
  const programDownloads = availableDownloadsToLink.filter((d) => d.programId === programId);
  const platformDownloads = availableDownloadsToLink.filter((d) => d.programId !== programId);
  const programLinks = availableLinksToLink.filter((l) => l.programId === programId);
  const platformLinks = availableLinksToLink.filter((l) => l.programId !== programId);

  // Get linked items with titles
  const getLinkedItems = (ids: string[], available: ResourceItem[]) =>
    ids.map((id) => {
      const item = available.find((a) => a.id === id);
      return { id, title: item?.title || `Item ${id.slice(0, 8)}...` };
    });

  const linkedArticles = getLinkedItems(linkedArticleIds, availableArticles);
  const linkedDownloads = getLinkedItems(linkedDownloadIds, availableDownloads);
  const linkedLinks = getLinkedItems(linkedLinkIds, availableLinks);
  const linkedQuestionnaires = getLinkedItems(linkedQuestionnaireIds, availableQuestionnaires);

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-2xl p-1.5 flex gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-white dark:bg-[#1e222a] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#8c8c8c] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2]'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-brand-accent')} />
              <span className="hidden sm:inline font-albert">{tab.label}</span>
              <span className="sm:hidden font-albert">{tab.shortLabel}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    isActive
                      ? 'bg-brand-accent/15 text-brand-accent'
                      : 'bg-[#e1ddd8]/60 dark:bg-[#262b35] text-[#8c8c8c] dark:text-[#7d8190]'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[120px]">
        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="space-y-3">
            <DayCourseSelector
              currentAssignments={courseAssignments}
              onChange={onCourseAssignmentsChange}
              availableCourses={availableCourses}
            />
          </div>
        )}

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <div>
            <LinkedItemsList
              items={linkedArticles}
              icon={FileText}
              onRemove={onRemoveArticle}
            />
            <ResourceLinkDropdown
              placeholder="Add an article..."
              icon={FileText}
              groups={[
                {
                  label: 'Program Content',
                  items: programArticles.map((a) => ({ id: a.id, title: a.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformArticles.map((a) => ({ id: a.id, title: a.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={onAddArticle}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new article"
            />
            {linkedArticleIds.length === 0 && availableArticlesToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No articles available
              </p>
            )}
          </div>
        )}

        {/* Downloads Tab */}
        {activeTab === 'downloads' && (
          <div>
            <LinkedItemsList
              items={linkedDownloads}
              icon={Download}
              onRemove={onRemoveDownload}
            />
            <ResourceLinkDropdown
              placeholder="Add a download..."
              icon={Download}
              groups={[
                {
                  label: 'Program Content',
                  items: programDownloads.map((d) => ({ id: d.id, title: d.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformDownloads.map((d) => ({ id: d.id, title: d.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={onAddDownload}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new download"
            />
            {linkedDownloadIds.length === 0 && availableDownloadsToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No downloads available
              </p>
            )}
          </div>
        )}

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div>
            <LinkedItemsList
              items={linkedLinks}
              icon={Link2}
              onRemove={onRemoveLink}
            />
            <ResourceLinkDropdown
              placeholder="Add a link..."
              icon={Link2}
              groups={[
                {
                  label: 'Program Content',
                  items: programLinks.map((l) => ({ id: l.id, title: l.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformLinks.map((l) => ({ id: l.id, title: l.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={onAddLink}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new link"
            />
            {linkedLinkIds.length === 0 && availableLinksToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No links available
              </p>
            )}
          </div>
        )}

        {/* Questionnaires Tab */}
        {activeTab === 'questionnaires' && (
          <div>
            <LinkedItemsList
              items={linkedQuestionnaires}
              icon={FileQuestion}
              onRemove={onRemoveQuestionnaire}
            />
            <ResourceLinkDropdown
              placeholder="Add a questionnaire..."
              icon={FileQuestion}
              groups={[
                {
                  label: 'Available Forms',
                  items: availableQuestionnairesToLink.map((q) => ({ id: q.id, title: q.title })),
                  iconClassName: 'text-brand-accent',
                },
              ]}
              onSelect={onAddQuestionnaire}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new questionnaire"
            />
            {linkedQuestionnaireIds.length === 0 && availableQuestionnairesToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No questionnaires available
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
