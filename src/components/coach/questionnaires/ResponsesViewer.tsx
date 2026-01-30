'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, Search, ExternalLink, File, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  QuestionnaireResponse,
  QuestionnaireQuestion,
  QuestionnaireAnswer,
} from '@/types/questionnaire';

interface ResponsesViewerProps {
  questionnaireId: string;
  questionnaireName: string;
  onBack: () => void;
  apiEndpoint?: string;
}

interface ResponsesData {
  responses: QuestionnaireResponse[];
  totalCount: number;
  questionnaire: {
    id: string;
    title: string;
    questions: QuestionnaireQuestion[];
  };
}

export function ResponsesViewer({
  questionnaireId,
  questionnaireName,
  onBack,
  apiEndpoint = '/api/coach/questionnaires',
}: ResponsesViewerProps) {
  const [data, setData] = useState<ResponsesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch responses
  const fetchResponses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiEndpoint}/${questionnaireId}/responses`);
      if (!response.ok) throw new Error('Failed to fetch responses');
      const responseData = await response.json();
      setData(responseData);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, questionnaireId]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  // Filter responses by search
  const filteredResponses =
    data?.responses.filter(
      r =>
        r.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.userEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return;

    const headers = [
      'Respondent Name',
      'Email',
      ...data.questionnaire.questions.map(q => q.title || 'Untitled'),
      'Submitted At',
    ];

    const rows = data.responses.map(response => {
      const answerMap = new Map(
        response.answers.map(a => [a.questionId, a])
      );

      return [
        response.userName || 'Unknown',
        response.userEmail || '',
        ...data.questionnaire.questions.map(q => {
          const answer = answerMap.get(q.id);
          if (!answer) return '';
          return formatAnswerForCSV(answer, q);
        }),
        new Date(response.submittedAt).toLocaleString(),
      ];
    });

    const csv = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${questionnaireName.replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format answer for CSV
  const formatAnswerForCSV = (
    answer: QuestionnaireAnswer,
    question: QuestionnaireQuestion
  ): string => {
    if (answer.value === null || answer.value === undefined) {
      return answer.fileUrls?.join(', ') || '';
    }

    if (Array.isArray(answer.value)) {
      // Multi-choice: map values to labels
      const options = question.options || [];
      return answer.value
        .map(v => options.find(o => o.value === v)?.label || v)
        .join(', ');
    }

    if (typeof answer.value === 'number') {
      return String(answer.value);
    }

    // Single choice: map value to label
    if (question.type === 'single_choice') {
      const option = question.options?.find(o => o.value === answer.value);
      return option?.label || String(answer.value);
    }

    return String(answer.value);
  };

  // Format answer for display
  const formatAnswerDisplay = (
    answer: QuestionnaireAnswer | undefined,
    question: QuestionnaireQuestion
  ): React.ReactNode => {
    if (!answer) return <span className="text-[#c9cdd4] dark:text-[#4b5563]">—</span>;

    if (answer.value === null || answer.value === undefined) {
      // File upload
      if (answer.fileUrls?.length) {
        return (
          <div className="flex items-center gap-2">
            {answer.fileUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-brand-accent hover:underline font-medium"
              >
                {question.type === 'media_upload' ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <File className="w-4 h-4" />
                )}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        );
      }
      return <span className="text-[#c9cdd4] dark:text-[#4b5563]">—</span>;
    }

    if (Array.isArray(answer.value)) {
      // Multi-choice
      const options = question.options || [];
      const labels = answer.value.map(v => options.find(o => o.value === v)?.label || v);
      return <span className="text-[#5f5a55] dark:text-[#b2b6c2]">{labels.join(', ')}</span>;
    }

    if (typeof answer.value === 'number') {
      return <span className="text-[#5f5a55] dark:text-[#b2b6c2]">{answer.value}</span>;
    }

    // Single choice
    if (question.type === 'single_choice') {
      const option = question.options?.find(o => o.value === answer.value);
      return <span className="text-[#5f5a55] dark:text-[#b2b6c2]">{option?.label || answer.value}</span>;
    }

    // Text - truncate long responses
    const text = String(answer.value);
    if (text.length > 100) {
      return (
        <span title={text} className="cursor-help text-[#5f5a55] dark:text-[#b2b6c2]">
          {text.substring(0, 100)}...
        </span>
      );
    }

    return <span className="text-[#5f5a55] dark:text-[#b2b6c2]">{text}</span>;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b]">
        {/* Skeleton Header */}
        <div className="sticky top-0 z-10 bg-[#f9f8f6]/80 dark:bg-[#11141b]/80 backdrop-blur-xl border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse" />
              <div className="min-w-0 flex-1">
                <div className="h-5 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-9 w-full sm:w-64 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="h-9 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Skeleton Table */}
        <div className="p-4 sm:p-6">
          <div className="rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e1ddd8] dark:border-[#262b35]/50 bg-[#f9f8f6] dark:bg-[#11141b]">
                    <th className="px-4 py-3 text-left">
                      <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                    </th>
                    {[1, 2, 3].map(i => (
                      <th key={i} className="px-4 py-3 text-left">
                        <div className="h-4 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left">
                      <div className="h-4 w-20 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map(row => (
                    <tr key={row} className="border-b border-[#e1ddd8] dark:border-[#262b35]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse" />
                          <div>
                            <div className="h-4 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                            <div className="h-3 w-36 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mt-1" />
                          </div>
                        </div>
                      </td>
                      {[1, 2, 3].map(col => (
                        <td key={col} className="px-4 py-3">
                          <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="h-4 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#f9f8f6]/80 dark:bg-[#11141b]/80 backdrop-blur-xl border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                {questionnaireName}
              </h1>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {data?.totalCount || 0} response{data?.totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full sm:w-64 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]"
              />
            </div>

            {/* Export */}
            <Button
              onClick={handleExportCSV}
              disabled={!data?.responses.length}
              variant="outline"
              className="font-albert flex-shrink-0"
              size="sm"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {!data?.responses.length ? (
          <div className="rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 p-8 sm:p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-sm mx-auto">
              No responses yet. Share your questionnaire link to start collecting responses.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 overflow-hidden bg-white dark:bg-[#171b22]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#e1ddd8] dark:border-[#262b35]">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] font-albert sticky left-0 bg-white dark:bg-[#171b22] z-10 min-w-[220px]">
                      Respondent
                    </th>
                    {data.questionnaire.questions.map(q => (
                      <th
                        key={q.id}
                        className="px-6 py-4 text-left text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] font-albert min-w-[180px]"
                        title={q.title}
                      >
                        {q.title?.length > 25 ? `${q.title.substring(0, 25)}...` : q.title || 'Untitled'}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] font-albert min-w-[140px]">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResponses.map((response, idx) => {
                    const answerMap = new Map(
                      response.answers.map(a => [a.questionId, a])
                    );

                    return (
                      <tr
                        key={response.id}
                        className="group border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 bg-white dark:bg-[#171b22] hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f28] transition-colors"
                      >
                        {/* Respondent */}
                        <td className="px-6 py-4 sticky left-0 z-10 bg-white dark:bg-[#171b22] group-hover:bg-[#f5f3f0] dark:group-hover:bg-[#1a1f28] transition-colors">
                          <div className="flex items-center gap-4">
                            {response.userAvatarUrl ? (
                              <img
                                src={response.userAvatarUrl}
                                alt=""
                                className="w-10 h-10 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-base font-semibold text-brand-accent">
                                  {response.userName?.[0]?.toUpperCase() || '?'}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                                {response.userName || 'Unknown'}
                              </p>
                              <p className="text-sm text-[#6b6560] dark:text-[#9ca3af] font-albert truncate">
                                {response.userEmail}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Answers */}
                        {data.questionnaire.questions.map(q => (
                          <td
                            key={q.id}
                            className="px-6 py-4 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                          >
                            {formatAnswerDisplay(answerMap.get(q.id), q)}
                          </td>
                        ))}

                        {/* Submitted */}
                        <td className="px-6 py-4 text-sm text-[#6b6560] dark:text-[#9ca3af] font-albert whitespace-nowrap">
                          {formatDate(response.submittedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
