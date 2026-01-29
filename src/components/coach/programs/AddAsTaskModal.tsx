'use client';

import {
  ListChecks,
  Video,
  FileText,
  Download,
  Link2,
  ClipboardList,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import type { ResourceDayTag, WeekResourceAssignment } from '@/types';
import { getResourceCadenceLabel } from './ResourceCadenceModal';

interface AddAsTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: WeekResourceAssignment['resourceType'];
  resourceTitle: string;
  dayTag: ResourceDayTag;
  calendarStartDate?: string;
  actualStartDayOfWeek?: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

// Get task label for a resource type
export function getTaskLabelForResource(
  resourceType: WeekResourceAssignment['resourceType'],
  title: string,
  lessonInfo?: { lessonNumber: number; lessonTitle: string }
): string {
  if (lessonInfo) {
    return `Watch Lesson ${lessonInfo.lessonNumber}: ${lessonInfo.lessonTitle}`;
  }
  switch (resourceType) {
    case 'course':
      return `Watch ${title}`;
    case 'video':
      return `Watch ${title}`;
    case 'questionnaire':
      return `Fill in ${title}`;
    case 'article':
      return `Read ${title}`;
    case 'download':
      return `Download ${title}`;
    case 'link':
      return `Visit ${title}`;
    default:
      return title;
  }
}

// Get icon component for resource type
function getResourceIcon(resourceType: WeekResourceAssignment['resourceType']) {
  switch (resourceType) {
    case 'course':
      return GraduationCap;
    case 'video':
      return Video;
    case 'article':
      return FileText;
    case 'questionnaire':
      return ClipboardList;
    case 'download':
      return Download;
    case 'link':
      return Link2;
    default:
      return FileText;
  }
}

export function AddAsTaskModal({
  open,
  onOpenChange,
  resourceType,
  resourceTitle,
  dayTag,
  calendarStartDate,
  actualStartDayOfWeek,
  enabled,
  onToggle,
}: AddAsTaskModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const ResourceIcon = getResourceIcon(resourceType);
  const taskLabel = getTaskLabelForResource(resourceType, resourceTitle);
  const cadenceLabel = getResourceCadenceLabel(dayTag, calendarStartDate, actualStartDayOfWeek);

  const content = (
    <div className="space-y-5 pt-2">
      {/* Preview of generated task */}
      <div className="p-4 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <ResourceIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              {taskLabel}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Calendar className="w-3 h-3 text-[#8c8c8c] dark:text-[#7d8190]" />
              <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                {cadenceLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle with explanation */}
      <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            Add as task
          </p>
          <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">
            Creates a task alongside this resource with the same schedule
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            onToggle(checked);
            onOpenChange(false);
          }}
          className="data-[state=checked]:bg-brand-accent"
        />
      </div>

      {/* Info note */}
      {enabled && (
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] text-center px-2">
          Task will be synced to clients on their scheduled days
        </p>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1a1a1a] dark:text-[#f5f5f8]">
              <ListChecks className="w-5 h-5 text-brand-accent" />
              Add as Task
            </DialogTitle>
            <DialogDescription className="text-[#6b6560] dark:text-[#9ca3af]">
              Create a task for this resource
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2 text-[#1a1a1a] dark:text-[#f5f5f8]">
            <ListChecks className="w-5 h-5 text-brand-accent" />
            Add as Task
          </DrawerTitle>
          <DrawerDescription className="text-[#6b6560] dark:text-[#9ca3af]">
            Create a task for this resource
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
