'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ResearchProgressProps {
  chatId: string;
  isVisible: boolean;
}

interface ProgressState {
  currentStep: number;
  totalSteps: number;
  status: 'starting' | 'generating-queries' | 'processing-query' | 'finalizing' | 'complete' | 'error';
  message: string;
  percent: number;
}

export function ResearchProgress({ chatId, isVisible }: ResearchProgressProps) {
  const [progress, setProgress] = useState<ProgressState>({
    currentStep: 0,
    totalSteps: 1, // Prevent division by zero
    status: 'starting',
    message: 'Initializing research...',
    percent: 0
  });

  useEffect(() => {
    if (!isVisible || !chatId) return;
    
    // Setup event source for progress updates
    const eventSource = new EventSource(`/api/research-progress?chatId=${chatId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Calculate percentage
        const percent = data.totalSteps > 0 
          ? Math.min(Math.round((data.currentStep / data.totalSteps) * 100), 99) 
          : 0;
        
        // For complete status, force 100%
        const adjustedPercent = data.status === 'complete' ? 100 : percent;
        
        setProgress({
          ...data,
          percent: adjustedPercent
        });
        
        // Close connection when complete or error
        if (data.status === 'complete' || data.status === 'error') {
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing progress event:', error);
      }
    };
    
    eventSource.onerror = () => {
      console.error('EventSource failed');
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  }, [chatId, isVisible]);

  if (!isVisible) return null;

  return (
    <Card className="w-full mb-4 bg-card border transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-md flex items-center gap-2">
          {progress.status !== 'complete' && progress.status !== 'error' && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          )}
          Deep Research in Progress
        </CardTitle>
        <CardDescription>
          {progress.status === 'complete' 
            ? 'Research complete!' 
            : progress.status === 'error'
            ? 'Research encountered an error'
            : `Step ${progress.currentStep} of ${progress.totalSteps}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={progress.percent} className="h-2 mb-2" />
        <p className="text-sm text-muted-foreground">{progress.message}</p>
      </CardContent>
    </Card>
  );
} 