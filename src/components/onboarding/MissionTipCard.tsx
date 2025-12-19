'use client';

/**
 * MissionTipCard Component - 2025 Design
 * 
 * Sleek, modern tip card with subtle animations
 */

export function MissionTipCard() {
  return (
    <div className="relative group">
      {/* Subtle glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-500" />
      
      <div className="relative backdrop-blur-xl bg-gradient-to-br from-amber-50/80 to-orange-50/60 rounded-2xl p-6 border border-amber-200/30 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-start gap-4">
          {/* Modern icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          
          <div className="flex-1 space-y-3">
            <p className="font-semibold text-gray-900 text-base">
              Your mission is your essence
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Not your job title—what you're here to do in this phase of your life.
            </p>
            
            <div className="pt-2 space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Try these:</p>
              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">→</span>
                  <span>I am someone who ___ so that ___</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">→</span>
                  <span>I am becoming a person who ___</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">→</span>
                  <span>I am here to ___ through ___</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
