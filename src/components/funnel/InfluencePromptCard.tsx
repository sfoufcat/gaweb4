'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  Star,
  Shield,
  Clock,
  Flame,
  Gift,
  CheckCircle2,
  Quote,
  Award,
  Users,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { InfluencePromptConfig, InfluencePromptType } from '@/types';

// CSS variable helpers - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';

// Icon mapping
const INFLUENCE_ICONS: Record<InfluencePromptType, LucideIcon> = {
  social_proof: Star,
  authority: Shield,
  urgency: Clock,
  scarcity: Flame,
  reciprocity: Gift,
  commitment: CheckCircle2,
};

// Default headlines for each type
const DEFAULT_HEADLINES: Record<InfluencePromptType, string> = {
  social_proof: 'What others are saying',
  authority: 'Trusted by experts',
  urgency: 'Limited time offer',
  scarcity: 'Spots filling fast',
  reciprocity: 'Free bonus included',
  commitment: 'You\'re making progress',
};

interface InfluencePromptCardProps {
  config: InfluencePromptConfig;
  className?: string;
  stepIndex?: number;
  totalSteps?: number;
}

export function InfluencePromptCard({ 
  config, 
  className = '',
  stepIndex = 0,
  totalSteps = 1,
}: InfluencePromptCardProps) {
  if (!config.enabled) return null;

  const Icon = INFLUENCE_ICONS[config.type];
  const headline = config.headline || DEFAULT_HEADLINES[config.type];
  const accentColor = config.accentColor || primaryVar;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
      className={`mt-8 ${className}`}
    >
      <div 
        className="relative overflow-hidden rounded-2xl border backdrop-blur-sm"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 5%, white) 0%, color-mix(in srgb, ${accentColor} 10%, white) 100%)`,
          borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
        }}
      >
        {/* Decorative gradient orb */}
        <div 
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: accentColor }}
        />
        
        <div className="relative p-5">
          {/* Header with icon and headline */}
          <div className="flex items-center gap-2.5 mb-4">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ 
                background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))`,
              }}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            <span 
              className="font-albert font-semibold text-sm uppercase tracking-wide"
              style={{ color: accentColor }}
            >
              {headline}
            </span>
          </div>

          {/* Render type-specific content */}
          {config.type === 'social_proof' && config.testimonial && (
            <SocialProofContent testimonial={config.testimonial} accentColor={accentColor} />
          )}
          
          {config.type === 'authority' && config.authority && (
            <AuthorityContent authority={config.authority} accentColor={accentColor} />
          )}
          
          {config.type === 'urgency' && config.urgency && (
            <UrgencyContent urgency={config.urgency} accentColor={accentColor} />
          )}
          
          {config.type === 'scarcity' && config.scarcity && (
            <ScarcityContent scarcity={config.scarcity} accentColor={accentColor} />
          )}
          
          {config.type === 'reciprocity' && config.reciprocity && (
            <ReciprocityContent reciprocity={config.reciprocity} accentColor={accentColor} />
          )}
          
          {config.type === 'commitment' && (
            <CommitmentContent 
              commitment={config.commitment} 
              accentColor={accentColor}
              stepIndex={stepIndex}
              totalSteps={totalSteps}
            />
          )}

          {/* Subtext */}
          {config.subtext && (
            <p className="mt-3 text-sm text-text-secondary font-albert">{config.subtext}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// SOCIAL PROOF CONTENT
// ============================================================================

function SocialProofContent({ 
  testimonial, 
  accentColor 
}: { 
  testimonial: NonNullable<InfluencePromptConfig['testimonial']>;
  accentColor: string;
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {testimonial.avatarUrl ? (
          <div className="relative">
            <Image
              src={testimonial.avatarUrl}
              alt={testimonial.name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-lg"
              unoptimized={testimonial.avatarUrl.startsWith('http')}
            />
            <div 
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
              style={{ background: accentColor }}
            >
              <Quote className="w-3 h-3 text-white" />
            </div>
          </div>
        ) : (
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white"
            style={{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, black))` }}
          >
            {testimonial.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Quote and attribution */}
      <div className="flex-1 min-w-0">
        <blockquote className="text-text-primary font-albert text-base leading-relaxed">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-text-primary font-albert text-sm">
            {testimonial.name}
          </span>
          {testimonial.role && (
            <>
              <span className="text-text-muted">•</span>
              <span className="text-text-secondary text-sm font-albert">{testimonial.role}</span>
            </>
          )}
        </div>
        {testimonial.result && (
          <div 
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ 
              background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              color: accentColor,
            }}
          >
            <Sparkles className="w-3 h-3" />
            {testimonial.result}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AUTHORITY CONTENT
// ============================================================================

function AuthorityContent({ 
  authority, 
  accentColor 
}: { 
  authority: NonNullable<InfluencePromptConfig['authority']>;
  accentColor: string;
}) {
  return (
    <div className="space-y-4">
      {/* Logo and credentials */}
      <div className="flex items-center gap-4">
        {authority.logoUrl && (
          <div className="flex-shrink-0">
            <Image
              src={authority.logoUrl}
              alt={authority.name || 'Authority logo'}
              width={64}
              height={64}
              className="w-16 h-16 object-contain rounded-xl bg-white p-2 shadow-sm"
              unoptimized={authority.logoUrl.startsWith('http')}
            />
          </div>
        )}
        <div className="flex-1">
          {authority.name && (
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" style={{ color: accentColor }} />
              <span className="font-semibold text-text-primary font-albert">{authority.name}</span>
            </div>
          )}
          {authority.title && (
            <p className="text-sm text-text-secondary font-albert mt-0.5">{authority.title}</p>
          )}
        </div>
      </div>

      {/* Credential text (e.g., "Featured in Forbes, Inc.") */}
      {authority.credentialText && (
        <div 
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: `color-mix(in srgb, ${accentColor} 8%, transparent)` }}
        >
          <Shield className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="text-sm text-text-primary font-albert font-medium">
            {authority.credentialText}
          </span>
        </div>
      )}

      {/* Endorsement quote */}
      {authority.endorsement && (
        <blockquote 
          className="pl-4 border-l-2 text-text-secondary font-albert text-sm italic"
          style={{ borderColor: accentColor }}
        >
          &ldquo;{authority.endorsement}&rdquo;
        </blockquote>
      )}
    </div>
  );
}

// ============================================================================
// URGENCY CONTENT
// ============================================================================

function UrgencyContent({ 
  urgency, 
  accentColor 
}: { 
  urgency: NonNullable<InfluencePromptConfig['urgency']>;
  accentColor: string;
}) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Initialize and run countdown
  useEffect(() => {
    if (!urgency.countdownMinutes) return;

    // Check localStorage for existing timer start
    const storageKey = `urgency_timer_${urgency.countdownMinutes}`;
    let startTime = localStorage.getItem(storageKey);
    
    if (!startTime) {
      startTime = Date.now().toString();
      localStorage.setItem(storageKey, startTime);
    }

    const endTime = parseInt(startTime) + (urgency.countdownMinutes * 60 * 1000);
    
    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [urgency.countdownMinutes]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isExpired = timeLeft !== null && timeLeft <= 0;

  return (
    <div className="space-y-4">
      {/* Deadline text */}
      {urgency.deadlineText && (
        <p className="text-text-primary font-albert font-medium">
          {urgency.deadlineText}
        </p>
      )}

      {/* Countdown timer */}
      {urgency.countdownMinutes && timeLeft !== null && (
        <div className="flex items-center gap-3">
          <div 
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-mono text-xl font-bold ${
              urgency.showPulse && !isExpired ? 'animate-pulse' : ''
            }`}
            style={{ 
              background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))`,
              color: 'white',
            }}
          >
            <Clock className="w-5 h-5" />
            <span>{isExpired ? 'EXPIRED' : formatTime(timeLeft)}</span>
          </div>
          
          {!isExpired && (
            <div className="flex-1">
              <div className="relative h-2 rounded-full overflow-hidden bg-gray-200">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: accentColor }}
                  initial={{ width: '100%' }}
                  animate={{ 
                    width: `${Math.max(0, (timeLeft / (urgency.countdownMinutes * 60 * 1000)) * 100)}%` 
                  }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pulsing indicator without countdown */}
      {!urgency.countdownMinutes && urgency.showPulse && (
        <div className="flex items-center gap-3">
          <motion.div
            className="w-3 h-3 rounded-full"
            style={{ background: accentColor }}
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-text-secondary font-albert text-sm">Limited time remaining</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCARCITY CONTENT
// ============================================================================

function ScarcityContent({ 
  scarcity, 
  accentColor 
}: { 
  scarcity: NonNullable<InfluencePromptConfig['scarcity']>;
  accentColor: string;
}) {
  const remaining = scarcity.remainingSpots ?? 5;
  const total = scarcity.totalSpots ?? 20;
  const filledPercent = Math.round(((total - remaining) / total) * 100);
  const displayText = scarcity.customText?.replace('{remaining}', String(remaining)) 
    ?? `Only ${remaining} spots remaining`;

  return (
    <div className="space-y-4">
      {/* Main message with fire effect */}
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          <Flame className="w-6 h-6" style={{ color: accentColor }} />
        </motion.div>
        <span className="text-text-primary font-albert font-semibold text-lg">
          {displayText}
        </span>
      </div>

      {/* Progress bar */}
      {scarcity.showProgressBar && (
        <div className="space-y-2">
          <div className="relative h-3 rounded-full overflow-hidden bg-gray-200">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ 
                background: `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, orange))`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${filledPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-xs font-albert">
            <span className="text-text-muted">{filledPercent}% filled</span>
            <span style={{ color: accentColor }} className="font-medium">
              {remaining} left
            </span>
          </div>
        </div>
      )}

      {/* People icons showing scarcity */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {Array.from({ length: Math.min(5, total - remaining) }).map((_, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium shadow-sm"
              style={{ 
                background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, black))`,
                color: 'white',
              }}
            >
              <Users className="w-3.5 h-3.5" />
            </div>
          ))}
          {total - remaining > 5 && (
            <div
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium bg-gray-100 text-text-secondary shadow-sm"
            >
              +{total - remaining - 5}
            </div>
          )}
        </div>
        <span className="text-sm text-text-secondary font-albert">
          {total - remaining} people already joined
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// RECIPROCITY CONTENT
// ============================================================================

function ReciprocityContent({ 
  reciprocity, 
  accentColor 
}: { 
  reciprocity: NonNullable<InfluencePromptConfig['reciprocity']>;
  accentColor: string;
}) {
  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-xl"
      style={{ background: `color-mix(in srgb, ${accentColor} 8%, white)` }}
    >
      {/* Bonus image */}
      {reciprocity.bonusImageUrl ? (
        <div className="flex-shrink-0">
          <Image
            src={reciprocity.bonusImageUrl}
            alt={reciprocity.bonusName || 'Bonus'}
            width={80}
            height={80}
            className="w-20 h-20 object-cover rounded-xl shadow-lg ring-2 ring-white"
            unoptimized={reciprocity.bonusImageUrl.startsWith('http')}
          />
        </div>
      ) : (
        <div 
          className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, black))`,
          }}
        >
          <Gift className="w-8 h-8 text-white" />
        </div>
      )}

      {/* Bonus details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span 
            className="px-2 py-0.5 rounded text-xs font-bold uppercase"
            style={{ background: accentColor, color: 'white' }}
          >
            FREE
          </span>
          {reciprocity.bonusValue && (
            <span className="text-xs font-albert text-text-muted line-through">
              {reciprocity.bonusValue}
            </span>
          )}
        </div>
        {reciprocity.bonusName && (
          <h4 className="font-albert font-semibold text-text-primary mt-1.5">
            {reciprocity.bonusName}
          </h4>
        )}
        {reciprocity.bonusDescription && (
          <p className="text-sm text-text-secondary font-albert mt-1">
            {reciprocity.bonusDescription}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMMITMENT CONTENT
// ============================================================================

function CommitmentContent({ 
  commitment, 
  accentColor,
  stepIndex,
  totalSteps,
}: { 
  commitment?: InfluencePromptConfig['commitment'];
  accentColor: string;
  stepIndex: number;
  totalSteps: number;
}) {
  // Calculate progress automatically if not provided
  const progressPercent = useMemo(() => {
    if (commitment?.progressPercent !== undefined) {
      return commitment.progressPercent;
    }
    // Auto-calculate based on step position
    return Math.round(((stepIndex + 1) / totalSteps) * 100);
  }, [commitment?.progressPercent, stepIndex, totalSteps]);

  const milestoneText = commitment?.milestoneText ?? 
    `You're ${progressPercent}% of the way there!`;

  const stepsCompleted = stepIndex + 1;
  const stepsRemaining = totalSteps - stepsCompleted;

  return (
    <div className="space-y-4">
      {/* Milestone text */}
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <CheckCircle2 className="w-6 h-6" style={{ color: accentColor }} />
        </motion.div>
        <span className="text-text-primary font-albert font-semibold">
          {milestoneText}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="relative h-3 rounded-full overflow-hidden bg-gray-200">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ 
              background: `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 60%, green), ${accentColor})`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs font-albert text-text-muted">
          <span>{stepsCompleted} step{stepsCompleted !== 1 ? 's' : ''} completed</span>
          <span style={{ color: accentColor }} className="font-medium">
            {stepsRemaining > 0 ? `${stepsRemaining} to go` : 'Almost done!'}
          </span>
        </div>
      </div>

      {/* Step checkmarks */}
      {commitment?.showCheckmarks && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                i <= stepIndex 
                  ? 'text-white' 
                  : 'bg-gray-200 text-text-muted'
              }`}
              style={i <= stepIndex ? { 
                background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, black))`,
              } : undefined}
            >
              {i <= stepIndex ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}







