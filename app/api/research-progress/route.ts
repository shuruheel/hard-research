import { NextRequest, NextResponse } from 'next/server';
import { researchProgressEmitter } from '@/lib/ai/tools/deepResearch';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Get the chat ID from the query params
  const chatId = req.nextUrl.searchParams.get('chatId');
  
  if (!chatId) {
    return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
  }
  
  // Create a text event stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(data: any) {
        const eventData = JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
      }
      
      // Handle progress events for this specific chat
      const progressListener = (progress: any) => {
        if (progress.chatId === chatId) {
          sendEvent(progress);
          
          // If research is complete or errored, close the stream after a short delay
          if (progress.status === 'complete' || progress.status === 'error') {
            setTimeout(() => {
              controller.close();
            }, 1000);
          }
        }
      };
      
      // Register the event listener
      researchProgressEmitter.on('progress', progressListener);
      
      // Send an initial event
      sendEvent({
        chatId,
        currentStep: 0,
        totalSteps: 0,
        status: 'starting',
        message: 'Waiting for research to begin...'
      });
      
      // Clean up the event listener when the client disconnects
      req.signal.addEventListener('abort', () => {
        researchProgressEmitter.off('progress', progressListener);
        controller.close();
      });
    }
  });
  
  // Set the appropriate headers for SSE
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'text/event-stream');
  responseHeaders.set('Cache-Control', 'no-cache');
  responseHeaders.set('Connection', 'keep-alive');
  
  return new NextResponse(stream, {
    headers: responseHeaders
  });
} 