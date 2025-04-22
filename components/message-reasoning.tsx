'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, LoaderIcon, GlobeIcon, SparklesIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Markdown } from './markdown';
import { cn } from '@/lib/utils';

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
  isGoDeepMode?: boolean;
}

export function MessageReasoning({
  isLoading,
  reasoning,
  isGoDeepMode = false,
}: MessageReasoningProps) {
  // Set initial state based on the mode
  // In Go Deep mode, we expand by default; in Wander mode, we collapse by default
  const [isExpanded, setIsExpanded] = useState(isGoDeepMode);

  // Update expanded state if mode changes
  useEffect(() => {
    setIsExpanded(isGoDeepMode);
  }, [isGoDeepMode]);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      marginTop: '1rem',
      marginBottom: '0.5rem',
    },
  };

  // Calculate stats about the reasoning
  const reasoningStats = !isLoading ? {
    wordCount: reasoning.split(/\s+/).length,
    stepCount: reasoning.split(/\n\n/).filter(s => s.trim().length > 0).length,
    duration: Math.max(Math.round(reasoning.length / 100), 1) // Rough estimate of seconds
  } : { wordCount: 0, stepCount: 0, duration: 0 };

  return (
    <div className={cn(
      "flex flex-col rounded-lg p-3", 
      isGoDeepMode ? "bg-blue-50 dark:bg-blue-950/20" : "bg-gray-50 dark:bg-gray-900/20"
    )}>
      {isLoading ? (
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">
            {isGoDeepMode ? "Deep Research in Progress" : "Thinking"} 
          </div>
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        </div>
      ) : (
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-row gap-2 items-center">
            <div className={isGoDeepMode ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}>
              {isGoDeepMode ? <GlobeIcon size={16} /> : <SparklesIcon size={16} />}
            </div>
            <div className="font-medium">
              {isGoDeepMode 
                ? `Deep Research (${reasoningStats.stepCount} steps, ${reasoningStats.duration}s)`
                : `Quick Reasoning (${reasoningStats.duration}s)`
              }
            </div>
          </div>
          <button
            data-testid="message-reasoning-toggle"
            type="button"
            className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? "Collapse reasoning" : "Expand reasoning"}
          >
            <div className={cn("transition-transform duration-200", isExpanded ? "rotate-180" : "")}>
              <ChevronDownIcon size={16} />
            </div>
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className="pl-4 text-zinc-600 dark:text-zinc-400 border-l flex flex-col gap-4 mt-2"
          >
            {isGoDeepMode && !isLoading && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {reasoningStats.wordCount} words, {reasoningStats.stepCount} reasoning steps
              </div>
            )}
            <Markdown>{reasoning}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
