'use client';

/**
 * MissionSuggestionCard Component - 2025 Design
 * 
 * Beautiful AI suggestion card with smooth animations
 */

interface MissionSuggestionCardProps {
  feedback: string;
  suggestion: string;
  onUseSuggestion: () => void;
  onKeepOriginal: () => void;
}

export function MissionSuggestionCard({
  feedback,
  suggestion,
  onUseSuggestion,
  onKeepOriginal,
}: MissionSuggestionCardProps) {
  return (
    <div className="relative group animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Animated gradient glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-nature-500 via-nature-100 to-earth-300 rounded-3xl opacity-20 group-hover:opacity-30 blur transition-opacity duration-500" />
      
      <div className="relative backdrop-blur-xl bg-white/90 rounded-3xl p-8 border border-nature-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
        {/* AI Badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nature-500 to-earth-600 flex items-center justify-center shadow-lg shadow-nature-500/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <span className="font-semibold text-earth-900">AI Suggestion</span>
        </div>
        
        {/* Feedback */}
        <p className="text-base text-earth-600 leading-relaxed mb-6">
          {feedback}
        </p>
        
        {/* Suggested Mission - Glassy card */}
        {suggestion && (
          <div className="bg-nature-50/50 backdrop-blur-sm rounded-2xl p-6 border border-nature-100 mb-6 shadow-sm">
            <p className="text-xs font-bold text-nature-900 uppercase tracking-wide mb-3">Refined version:</p>
            <p className="text-xl font-serif font-medium text-earth-900 leading-relaxed italic">
              &quot;{suggestion}&quot;
            </p>
          </div>
        )}
        
        {/* Action Buttons - Modern glass design */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onUseSuggestion}
            className="flex-1 group relative overflow-hidden px-6 py-3.5 bg-earth-900 text-white font-semibold rounded-xl shadow-lg shadow-earth-900/20 hover:shadow-xl hover:shadow-earth-900/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Use AI suggestion
            </span>
            {/* Hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-earth-800 to-earth-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
          
          <button
            onClick={onKeepOriginal}
            className="flex-1 px-6 py-3.5 bg-white text-earth-600 font-semibold rounded-xl border border-earth-200 hover:border-earth-300 hover:bg-earth-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            Keep my version
          </button>
        </div>
      </div>
    </div>
  );
}
