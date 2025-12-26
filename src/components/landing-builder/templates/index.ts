import type { LandingPageTemplate } from '@/types';
import { basicTemplate } from './basic';
import { salesPageTemplate } from './sales-page';
import { webinarTemplate } from './webinar';
import { courseLaunchTemplate } from './course-launch';
import { coachingTemplate } from './coaching';

export const templates: LandingPageTemplate[] = [
  basicTemplate,
  salesPageTemplate,
  webinarTemplate,
  courseLaunchTemplate,
  coachingTemplate,
];

export const getTemplateById = (id: string): LandingPageTemplate | undefined => {
  return templates.find((t) => t.id === id);
};

export type { LandingPageTemplate };

