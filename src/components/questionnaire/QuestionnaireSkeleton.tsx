/**
 * QuestionnaireSkeleton
 *
 * Skeleton loader for the questionnaire page.
 * Matches the structure of QuestionnaireForm with:
 * - Segmented progress bar
 * - Back/counter row
 * - Title area with cover image placeholder
 * - Question with options
 * - CTA button
 */

export function QuestionnaireSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf9f7] to-[#f5f3f0] dark:from-[#0f1218] dark:to-[#0a0c10]">
      <div className="max-w-3xl px-4 sm:px-6 lg:ml-64 lg:mr-auto">
        {/* Progress bar and counter */}
        <div className="pt-4 pb-2">
          {/* Segmented progress bar */}
          <div className="flex gap-1 mb-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="flex-1 h-1 rounded-full bg-[#e8e4df] dark:bg-[#1e232d] animate-pulse"
                style={{ animationDelay: `${index * 100}ms` }}
              />
            ))}
          </div>

          {/* Back button and question counter */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-12 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-4 w-32 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
          </div>
        </div>

        {/* Main content area */}
        <div className="py-8">
          {/* Title area - mimics first page with cover image */}
          <div className="mb-8 text-center">
            {/* Cover image placeholder */}
            <div
              className="mb-6 h-40 sm:h-48 rounded-2xl bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse"
              style={{ animationDelay: '50ms' }}
            />
            {/* Title */}
            <div
              className="h-8 sm:h-9 w-3/4 mx-auto rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse"
              style={{ animationDelay: '100ms' }}
            />
            {/* Description */}
            <div
              className="mt-3 h-5 w-2/3 mx-auto rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse"
              style={{ animationDelay: '150ms' }}
            />
          </div>

          {/* Question area */}
          <div className="space-y-8">
            {/* Question label */}
            <div>
              <div
                className="h-6 w-4/5 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-4"
                style={{ animationDelay: '200ms' }}
              />

              {/* Options - like radio/checkbox choices */}
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-4 rounded-xl border border-[#e8e4df] dark:border-[#262b35] bg-white/50 dark:bg-[#171b22]/50"
                    style={{ animationDelay: `${250 + i * 50}ms` }}
                  >
                    <div className="w-5 h-5 rounded-full bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
                    <div
                      className="h-4 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse"
                      style={{ width: `${50 + Math.random() * 30}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with action button */}
        <div className="pt-4 pb-8">
          <div
            className="w-full h-14 rounded-2xl bg-brand-accent/30 animate-pulse"
            style={{ animationDelay: '400ms' }}
          />
        </div>
      </div>
    </div>
  );
}
