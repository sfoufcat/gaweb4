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
    if (!answer) return <span className="text-[#b2b6c2]">—</span>;

    if (answer.value === null || answer.value === undefined) {
      // File upload
      if (answer.fileUrls?.length) {
        return (
          <div className="flex items-center gap-1">
            {answer.fileUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-brand-accent hover:underline"
              >
                {question.type === 'media_upload' ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <File className="w-4 h-4" />
                )}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        );
      }
      return <span className="text-[#b2b6c2]">—</span>;
    }

    if (Array.isArray(answer.value)) {
      // Multi-choice
      const options = question.options || [];
      const labels = answer.value.map(v => options.find(o => o.value === v)?.label || v);
      return (
        <div className="flex flex-wrap gap-1">
          {labels.map((label, i) => (
            <span
              key={i}
              className="inline-block px-2 py-0.5 text-xs bg-[#f3f1ef] dark:bg-[#262b35] rounded"
            >
              {label}
            </span>
          ))}
        </div>
      );
    }

    if (typeof answer.value === 'number') {
      // Scale
      if (question.type === 'scale') {
        const min = question.minValue ?? 1;
        const max = question.maxValue ?? 5;
        const percentage = ((answer.value - min) / (max - min)) * 100;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-accent rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm">{answer.value}</span>
          </div>
        );
      }
      return <span>{answer.value}</span>;
    }

    // Single choice
    if (question.type === 'single_choice') {
      const option = question.options?.find(o => o.value === answer.value);
      return <span>{option?.label || answer.value}</span>;
    }

    // Text - truncate long responses
    const text = String(answer.value);
    if (text.length > 100) {
      return (
        <span title={text} className="cursor-help">
          {text.substring(0, 100)}...
        </span>
      );
    }

    return <span>{text}</span>;
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
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Loading responses...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#f9f8f6]/80 dark:bg-[#11141b]/80 backdrop-blur-xl border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {questionnaireName} Responses
              </h1>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {data?.totalCount || 0} response{data?.totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-64 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              />
            </div>

            {/* Export */}
            <Button
              onClick={handleExportCSV}
              disabled={!data?.responses.length}
              variant="outline"
              className="font-albert"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {!data?.responses.length ? (
          <div className="rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              No responses yet. Share your questionnaire link to start collecting responses.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e1ddd8] dark:border-[#262b35]/50 bg-[#f9f8f6] dark:bg-[#11141b]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert sticky left-0 bg-[#f9f8f6] dark:bg-[#11141b] z-10 min-w-[150px]">
                      Respondent
                    </th>
                    {data.questionnaire.questions.map(q => (
                      <th
                        key={q.id}
                        className="px-4 py-3 text-left text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert min-w-[200px]"
                        title={q.title}
                      >
                        {q.title?.length > 30 ? `${q.title.substring(0, 30)}...` : q.title || 'Untitled'}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert min-w-[150px]">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResponses.map(response => {
                    const answerMap = new Map(
                      response.answers.map(a => [a.questionId, a])
                    );

                    return (
                      <tr
                        key={response.id}
                        className="border-b border-[#e1ddd8] dark:border-[#262b35]/50 hover:bg-[#f9f8f6] dark:hover:bg-[#11141b]/50"
                      >
                        {/* Respondent */}
                        <td className="px-4 py-3 sticky left-0 bg-[#f9f8f6] dark:bg-[#11141b] z-10">
                          <div className="flex items-center gap-3">
                            {response.userAvatarUrl ? (
                              <img
                                src={response.userAvatarUrl}
                                alt=""
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center">
                                <span className="text-sm font-medium text-brand-accent">
                                  {response.userName?.[0]?.toUpperCase() || '?'}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                {response.userName || 'Unknown'}
                              </p>
                              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                                {response.userEmail}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Answers */}
                        {data.questionnaire.questions.map(q => (
                          <td
                            key={q.id}
                            className="px-4 py-3 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                          >
                            {formatAnswerDisplay(answerMap.get(q.id), q)}
                          </td>
                        ))}

                        {/* Submitted */}
                        <td className="px-4 py-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">
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
