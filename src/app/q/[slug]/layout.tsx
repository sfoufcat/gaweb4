import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Questionnaire',
  description: 'Complete the questionnaire',
};

export default function QuestionnaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout ensures the questionnaire page is rendered without
  // the main app shell (sidebar, bottom nav, etc.)
  return (
    <div className="questionnaire-layout">
      {children}
    </div>
  );
}
