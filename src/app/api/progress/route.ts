import { NextRequest } from 'next/server';

// Global map to store SSE controllers
const progressControllers = new Map<string, ReadableStreamDefaultController>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    start(controller) {
      // Store the controller in the map for this session
      progressControllers.set(sessionId, controller);

      // Send initial connection message
      const data = encoder.encode(`data: ${JSON.stringify({ 
        type: 'connected', 
        sessionId,
        timestamp: Date.now()
      })}\n\n`);
      controller.enqueue(data);

      // Keep connection alive with periodic pings
      const keepAlive = setInterval(() => {
        try {
          const ping = encoder.encode(`data: ${JSON.stringify({ 
            type: 'ping', 
            timestamp: Date.now() 
          })}\n\n`);
          controller.enqueue(ping);
        } catch (error) {
          clearInterval(keepAlive);
        }
      }, 30000); // Send ping every 30 seconds

      // Clean up when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        progressControllers.delete(sessionId);
        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      });
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no'
    },
  });
}

// Helper function to send progress updates
export function sendProgressUpdate(sessionId: string, data: any) {
  const controller = progressControllers.get(sessionId);
  if (!controller) {
    console.warn(`[SSE] No controller found for session ${sessionId}`);
    return;
  }

  try {
    const encoder = new TextEncoder();
    const message = encoder.encode(`data: ${JSON.stringify({
      ...data,
      timestamp: Date.now()
    })}\n\n`);
    controller.enqueue(message);
    
    console.log(`[SSE] Sent progress update for session ${sessionId}:`, data);
  } catch (error) {
    console.error(`[SSE] Error sending progress update for session ${sessionId}:`, error);
    // Remove broken controller
    progressControllers.delete(sessionId);
  }
}