/**
 * Content Creator Quiz Page - Server Component
 * 
 * Fetches quiz data on the server for instant page load.
 * The data arrives with the HTML, so no loading spinner needed.
 */

import { getQuizStepsForUI } from '@/lib/quiz-server';
import QuizClient from './QuizClient';

export default async function ContentCreatorQuizPage() {
  // Fetch quiz data on the server
  const steps = await getQuizStepsForUI('content-creator');
  
  // Pass to client component - if null, it will use hardcoded fallback
  return <QuizClient initialSteps={steps || []} />;
}
