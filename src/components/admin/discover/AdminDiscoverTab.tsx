'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, FileText, BookOpen, Download, Link, ClipboardList, ChevronDown } from 'lucide-react';
import { AdminEventsSection } from './AdminEventsSection';
import { AdminArticlesSection } from './AdminArticlesSection';
import { AdminCoursesSection } from './AdminCoursesSection';
import { AdminDownloadsSection } from './AdminDownloadsSection';
import { AdminLinksSection } from './AdminLinksSection';
import { AdminQuestionnairesSection } from './AdminQuestionnairesSection';

type DiscoverSubTab = 'events' | 'articles' | 'courses' | 'downloads' | 'links' | 'questionnaires';

interface AdminDiscoverTabProps {
  /** Base API path for multi-tenancy (e.g., '/api/coach/org-discover' for coaches) */
  apiBasePath?: string;
  /** Optional sub-tab to restore selection from URL */
  initialSubTab?: string | null;
  /** Callback when sub-tab selection changes (for URL persistence) */
  onSubTabChange?: (subTab: string | null) => void;
  /** Optional initial course ID for URL persistence */
  initialCourseId?: string | null;
  /** Callback when course selection changes (for URL persistence) */
  onCourseSelect?: (courseId: string | null) => void;
}

export function AdminDiscoverTab({
  apiBasePath = '/api/admin/discover',
  initialSubTab,
  onSubTabChange,
  initialCourseId,
  onCourseSelect,
}: AdminDiscoverTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<DiscoverSubTab>('courses');
  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Restore sub-tab selection from URL param on mount
  useEffect(() => {
    if (initialSubTab && ['courses', 'events', 'articles', 'questionnaires', 'downloads', 'links'].includes(initialSubTab)) {
      setActiveSubTab(initialSubTab as DiscoverSubTab);
    }
  }, [initialSubTab]);

  // Notify parent when sub-tab selection changes (for URL persistence)
  useEffect(() => {
    onSubTabChange?.(activeSubTab);
  }, [activeSubTab, onSubTabChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabs: { id: DiscoverSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'courses', label: 'Courses', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'events', label: 'Events', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'articles', label: 'Articles', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'questionnaires', label: 'Questionnaires', icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: 'downloads', label: 'Downloads', icon: <Download className="w-3.5 h-3.5" /> },
    { id: 'links', label: 'Links', icon: <Link className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Section Header with Mobile Dropdown - hidden when course editor is open */}
      {!isCourseEditorOpen && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Resources</h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              Manage content for programs
            </p>
          </div>

          {/* Mobile Dropdown */}
          <div className="relative sm:hidden" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg text-sm font-medium font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            >
              {tabs.find(t => t.id === activeSubTab)?.icon}
              {tabs.find(t => t.id === activeSubTab)?.label}
              <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#262b35] rounded-xl shadow-lg border border-[#e5e2df] dark:border-[#3a3f4b] py-1 z-50">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveSubTab(tab.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm font-medium font-albert flex items-center gap-2 ${
                      activeSubTab === tab.id
                        ? 'bg-[#f3f1ef] dark:bg-[#1e222a] text-[#1a1a1a] dark:text-[#f5f5f8]'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pill Selector Tabs - Desktop only, hidden when course editor is open */}
      {!isCourseEditorOpen && (
        <div className="hidden sm:block">
          <div className="flex items-center gap-1 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium font-albert transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div key={activeSubTab} className={isCourseEditorOpen ? '' : 'animate-fadeIn'}>
        {activeSubTab === 'events' && <AdminEventsSection apiEndpoint={`${apiBasePath}/events`} />}
        {activeSubTab === 'articles' && <AdminArticlesSection apiEndpoint={`${apiBasePath}/articles`} />}
        {activeSubTab === 'courses' && (
          <AdminCoursesSection
            apiEndpoint={`${apiBasePath}/courses`}
            initialCourseId={initialCourseId}
            onCourseSelect={onCourseSelect}
            onEditorModeChange={setIsCourseEditorOpen}
          />
        )}
        {activeSubTab === 'downloads' && <AdminDownloadsSection apiEndpoint={`${apiBasePath}/downloads`} />}
        {activeSubTab === 'links' && <AdminLinksSection apiEndpoint={`${apiBasePath}/links`} />}
        {activeSubTab === 'questionnaires' && <AdminQuestionnairesSection apiEndpoint="/api/coach/questionnaires" />}
      </div>
    </div>
  );
}
