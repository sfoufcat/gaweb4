/**
 * ProgramLandingSkeleton
 * 
 * Beautiful skeleton loader for the Program Landing page.
 * Matches the structure of the actual program detail page with:
 * - Hero section with cover image
 * - Two-column layout (Program Info + Pricing Card)
 * - Content sections (Benefits, Coach info, etc.)
 */

export function ProgramLandingSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Hero Section */}
      <div className="relative">
        <div className="h-[200px] sm:h-[260px] w-full bg-gradient-to-br from-[#e1ddd8]/40 to-[#d4cfc9]/30 dark:from-[#262b35]/60 dark:to-[#1d222b]/40 animate-pulse">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        </div>

        {/* Back button placeholder */}
        <div className="absolute top-4 left-4">
          <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-md animate-pulse" />
        </div>

        {/* Type badge placeholder */}
        <div className="absolute top-4 right-4">
          <div className="w-20 h-7 rounded-full bg-brand-accent/30 backdrop-blur-md animate-pulse" />
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-16">
          
          {/* Two Column Grid */}
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            
            {/* Left Column - Program Info */}
            <div className="lg:col-span-3">
              {/* Badge */}
              <div className="w-36 h-8 rounded-full bg-brand-accent/10 dark:bg-brand-accent/20 animate-pulse mb-4" />

              {/* Title */}
              <div className="space-y-3 mb-4">
                <div className="h-10 sm:h-12 w-full rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
                <div className="h-10 sm:h-12 w-3/4 rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
              </div>

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-4 mb-5">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                  <div className="w-16 h-4 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[0, 1, 2].map((i) => (
                      <div 
                        key={i} 
                        className="w-8 h-8 rounded-full border-2 border-white dark:border-[#171b22] bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse"
                      />
                    ))}
                  </div>
                  <div className="w-20 h-4 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2 mb-6">
                <div className="h-4 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                <div className="h-4 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
              </div>

              {/* Coach Info Card */}
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
                <div className="w-14 h-14 rounded-full bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
                <div>
                  <div className="h-5 w-32 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-2" />
                  <div className="h-3 w-20 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                </div>
              </div>

              {/* Coach Bio Section */}
              <div className="mt-6">
                <div className="h-5 w-36 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-3" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  <div className="h-4 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  <div className="h-4 w-4/5 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                </div>
              </div>

              {/* Benefits List */}
              <div className="mt-8">
                <div className="h-5 w-40 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-4" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-accent/10 dark:bg-brand-accent/20 animate-pulse flex-shrink-0 mt-0.5" />
                      <div 
                        className="h-5 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse"
                        style={{ width: `${70 + Math.random() * 25}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Testimonial Preview */}
              <div className="mt-8 bg-white dark:bg-[#171b22] rounded-2xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-1 mb-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-4 h-4 rounded bg-[#FFB800]/30 animate-pulse" />
                  ))}
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  <div className="h-4 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
                  <div>
                    <div className="h-4 w-24 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-1" />
                    <div className="h-3 w-16 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Pricing Card */}
            <div className="lg:col-span-2 lg:sticky lg:top-8">
              <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-8 shadow-lg border border-[#e1ddd8] dark:border-[#262b35]">
                {/* Program badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-32 h-8 rounded-full bg-brand-accent/10 dark:bg-brand-accent/20 animate-pulse" />
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="h-12 w-24 mx-auto rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
                  <div className="h-4 w-28 mx-auto mt-2 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                </div>

                {/* Duration callout */}
                <div className="rounded-xl p-3 mb-6 bg-brand-accent/5 dark:bg-brand-accent/10">
                  <div className="h-4 w-40 mx-auto rounded bg-brand-accent/20 animate-pulse" />
                </div>

                {/* Cohort Selection placeholder */}
                <div className="mb-6">
                  <div className="h-4 w-28 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-3" />
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div 
                        key={i} 
                        className="p-4 rounded-xl border-2 border-[#e1ddd8] dark:border-[#262b35]"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="h-4 w-24 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-2" />
                            <div className="h-3 w-36 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                          </div>
                          <div className="h-3 w-16 rounded bg-[#22c55e]/20 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="w-full h-14 rounded-2xl bg-gradient-to-r from-brand-accent/40 to-[#c9a07a]/40 animate-pulse" />

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                    <div className="w-24 h-3 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                    <div className="w-20 h-3 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* What's Included Section */}
          <div className="mt-12 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="h-7 w-44 mx-auto rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-8" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20 animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-28 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-2" />
                    <div className="h-3 w-full rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Curriculum Section */}
          <div className="mt-8 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="h-7 w-48 mx-auto rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-8" />
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/20 animate-pulse flex-shrink-0" />
                  <div 
                    className="h-4 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse"
                    style={{ width: `${50 + Math.random() * 40}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Section */}
      <div className="bg-[#1a1a1a] pt-12 pb-24 md:pb-12 rounded-[32px] mt-auto mx-4 sm:mx-6 lg:mx-10 mb-8">
        <div className="max-w-[600px] mx-auto px-4 text-center">
          <div className="h-8 w-80 mx-auto rounded-lg bg-white/10 animate-pulse mb-3" />
          <div className="h-4 w-64 mx-auto rounded bg-white/5 animate-pulse mb-6" />
          <div className="w-48 h-12 mx-auto rounded-3xl bg-gradient-to-r from-brand-accent/50 to-[#c9a07a]/50 animate-pulse" />
        </div>
      </div>
    </div>
  );
}






