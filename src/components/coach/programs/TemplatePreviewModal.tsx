'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, X, Calendar, ListTodo, Target, DollarSign, Users, 
  ChevronDown, ChevronRight, CheckCircle2, Loader2, Star, Sparkles,
  MessageSquare, HelpCircle
} from 'lucide-react';
import type { ProgramTemplate, TemplateDay, TemplateCategory } from '@/types';

interface TemplatePreviewModalProps {
  template: ProgramTemplate;
  onUseTemplate: () => void;
  onBack: () => void;
  onClose: () => void;
  onLoaded: (days: TemplateDay[], stats: { totalDays: number; totalTasks: number; totalHabits: number }) => void;
}

// Category colors
const categoryStyles: Record<TemplateCategory, string> = {
  business: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  habits: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  mindset: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  health: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  productivity: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  relationships: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const categoryGradients: Record<TemplateCategory, string> = {
  business: 'from-blue-600 to-blue-400',
  habits: 'from-green-600 to-green-400',
  mindset: 'from-purple-600 to-purple-400',
  health: 'from-rose-600 to-rose-400',
  productivity: 'from-amber-600 to-amber-400',
  relationships: 'from-pink-600 to-pink-400',
};

type TabType = 'overview' | 'curriculum' | 'included';

export function TemplatePreviewModal({ 
  template, 
  onUseTemplate, 
  onBack, 
  onClose,
  onLoaded 
}: TemplatePreviewModalProps) {
  const [days, setDays] = useState<TemplateDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [stats, setStats] = useState<{ totalDays: number; totalTasks: number; totalHabits: number } | null>(null);

  // Fetch template details
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/templates/${template.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch template details');
        }
        
        const data = await response.json();
        setDays(data.days || []);
        setStats(data.stats);
        onLoaded(data.days || [], data.stats);
      } catch (err) {
        console.error('Error fetching template details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetails();
  }, [template.id, onLoaded]);

  // Group days into weeks
  const weekGroups = React.useMemo(() => {
    const weeks: Map<number, TemplateDay[]> = new Map();
    days.forEach(day => {
      const weekNum = Math.ceil(day.dayIndex / 7);
      if (!weeks.has(weekNum)) {
        weeks.set(weekNum, []);
      }
      weeks.get(weekNum)!.push(day);
    });
    return weeks;
  }, [days]);

  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNum)) {
        next.delete(weekNum);
      } else {
        next.add(weekNum);
      }
      return next;
    });
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <div className="flex flex-col h-[85vh] max-h-[900px]">
      {/* Header with Hero */}
      <div className="relative">
        {/* Hero Image */}
        <div className="relative h-48 overflow-hidden">
          {template.coverImageUrl ? (
            <>
              <Image
                src={template.coverImageUrl}
                alt={template.name}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${categoryGradients[template.category]}`}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}

          {/* Navigation */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Title and badges */}
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${categoryStyles[template.category]}`}>
                {template.category}
              </span>
              {template.featured && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#a07855] dark:bg-[#b8896a] text-white text-xs font-medium">
                  <Star className="w-3 h-3 fill-current" />
                  Featured
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white font-albert tracking-[-0.5px]">
              {template.name}
            </h2>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-[#faf8f6] dark:bg-[#11141b] border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex flex-wrap gap-3">
            <StatBadge icon={Calendar} label="Duration" value={`${template.lengthDays} days`} />
            <StatBadge icon={ListTodo} label="Tasks" value={loading ? '...' : `${stats?.totalTasks || 0}`} />
            <StatBadge icon={Target} label="Habits" value={`${template.defaultHabits?.length || 0}`} />
            <StatBadge icon={DollarSign} label="Suggested" value={formatPrice(template.suggestedPriceInCents)} />
            {template.usageCount > 0 && (
              <StatBadge icon={Users} label="Used by" value={`${template.usageCount} coaches`} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2 border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex gap-1">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'curriculum', label: 'Curriculum' },
            { id: 'included', label: "What's Included" },
          ] as { id: TabType; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium font-albert transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#a07855]/10 text-[#a07855] dark:bg-[#b8896a]/10 dark:text-[#b8896a]'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#a07855] dark:text-[#b8896a] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <button onClick={() => window.location.reload()} className="text-[#a07855] dark:text-[#b8896a] text-sm hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Description */}
                <div>
                  <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert leading-relaxed">
                    {template.description}
                  </p>
                </div>

                {/* Key Outcomes */}
                {template.keyOutcomes && template.keyOutcomes.length > 0 && (
                  <div className="bg-[#faf8f6] dark:bg-[#1d222b] rounded-xl p-5">
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                      What You'll Achieve
                    </h3>
                    <ul className="space-y-3">
                      {template.keyOutcomes.map((outcome, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* FAQs Preview */}
                {template.faqs && template.faqs.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                      Common Questions
                    </h3>
                    <div className="space-y-3">
                      {template.faqs.slice(0, 3).map((faq, i) => (
                        <FAQItem key={i} question={faq.question} answer={faq.answer} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'curriculum' && (
              <motion.div
                key="curriculum"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {Array.from(weekGroups.entries()).map(([weekNum, weekDays]) => (
                  <WeekAccordion
                    key={weekNum}
                    weekNum={weekNum}
                    days={weekDays}
                    isExpanded={expandedWeeks.has(weekNum)}
                    onToggle={() => toggleWeek(weekNum)}
                  />
                ))}
              </motion.div>
            )}

            {activeTab === 'included' && (
              <motion.div
                key="included"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Features */}
                {template.features && template.features.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {template.features.map((feature, i) => (
                      <div 
                        key={i}
                        className="flex items-start gap-4 p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#a07855]/10 dark:bg-[#b8896a]/10 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                            {feature.title}
                          </h4>
                          {feature.description && (
                            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                              {feature.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Default Habits */}
                {template.defaultHabits && template.defaultHabits.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                      Default Habits
                    </h3>
                    <div className="space-y-2">
                      {template.defaultHabits.map((habit, i) => (
                        <div 
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-lg bg-[#faf8f6] dark:bg-[#1d222b]"
                        >
                          <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {habit.title}
                            </span>
                            <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] ml-2">
                              {habit.frequency}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Testimonials */}
                {template.testimonials && template.testimonials.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                      Sample Testimonials
                    </h3>
                    <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] font-albert mb-3">
                      Replace these with your own client testimonials
                    </p>
                    <div className="space-y-3">
                      {template.testimonials.map((testimonial, i) => (
                        <div 
                          key={i}
                          className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-dashed border-[#e1ddd8] dark:border-[#262b35]"
                        >
                          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert italic mb-2">
                            "{testimonial.text}"
                          </p>
                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                            — {testimonial.author}
                            {testimonial.role && (
                              <span className="text-[#a7a39e] dark:text-[#7d8190] font-normal">, {testimonial.role}</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Sticky CTA Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Suggested price: <span className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{formatPrice(template.suggestedPriceInCents)}</span>
            </p>
          </div>
          <button
            onClick={onUseTemplate}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white font-semibold font-albert transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            Use This Template
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Stat Badge Component
interface StatBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function StatBadge({ icon: Icon, label, value }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35]">
      <Icon className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
      <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">{label}:</span>
      <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{value}</span>
    </div>
  );
}

// Week Accordion Component
interface WeekAccordionProps {
  weekNum: number;
  days: TemplateDay[];
  isExpanded: boolean;
  onToggle: () => void;
}

function WeekAccordion({ weekNum, days, isExpanded, onToggle }: WeekAccordionProps) {
  const totalTasks = days.reduce((sum, day) => sum + (day.tasks?.length || 0), 0);
  
  return (
    <div className="rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#171b22] hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#a07855]/10 dark:bg-[#b8896a]/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-[#a07855] dark:text-[#b8896a]">{weekNum}</span>
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Week {weekNum}
            </h4>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
              {days.length} days • {totalTasks} tasks
            </p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 bg-[#faf8f6] dark:bg-[#11141b]">
              {days.map((day) => (
                <div 
                  key={day.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-[#171b22]"
                >
                  <div className="w-6 h-6 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">{day.dayIndex}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm truncate">
                      {day.title || `Day ${day.dayIndex}`}
                    </h5>
                    {day.summary && (
                      <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] truncate mt-0.5">
                        {day.summary}
                      </p>
                    )}
                    <p className="text-xs text-[#a07855] dark:text-[#b8896a] mt-1">
                      {day.tasks?.length || 0} tasks
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// FAQ Item Component
interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#171b22] hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] transition-colors text-left"
      >
        <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert pr-4">
          {question}
        </span>
        <ChevronDown className={`w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 bg-[#faf8f6] dark:bg-[#11141b]">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

