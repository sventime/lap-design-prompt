import { NextRequest, NextResponse } from 'next/server';

// Global map to store abort signals
const abortSignals = new Map<string, boolean>();

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    console.log(`[ABORT] Received abort request for session: ${sessionId}`);
    
    // Set abort signal for this session
    abortSignals.set(sessionId, true);

    return NextResponse.json({
      success: true,
      message: `Abort signal set for session ${sessionId}`,
      sessionId
    });

  } catch (error) {
    console.error('[ABORT] Error setting abort signal:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to set abort signal' 
      },
      { status: 500 }
    );
  }
}

// Helper function to check if processing should be aborted
export function shouldAbortProcessing(sessionId: string): boolean {
  const shouldAbort = abortSignals.get(sessionId) || false;
  if (shouldAbort) {
    console.log(`[ABORT] Processing should be aborted for session: ${sessionId}`);
  }
  return shouldAbort;
}

// Helper function to clear abort signal
export function clearAbortSignal(sessionId: string): void {
  abortSignals.delete(sessionId);
  console.log(`[ABORT] Cleared abort signal for session: ${sessionId}`);
}