import { NextRequest, NextResponse } from 'next/server';
import { sendMultiplePromptsToMidjourney } from '@/lib/midjourney';

export async function POST(request: NextRequest) {
  try {
    const { prompts, discordToken, discordServerId, discordChannelId } = await request.json();

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid prompts array' },
        { status: 400 }
      );
    }

    console.log(`[API] Sending ${prompts.length} prompts to Midjourney`);

    const result = await sendMultiplePromptsToMidjourney(prompts, {
      discordToken,
      discordServerId,
      discordChannelId,
    });

    return NextResponse.json({
      success: result.success,
      results: result.results,
      totalPrompts: prompts.length,
      successfulPrompts: result.results.filter(r => r.messageId).length,
      failedPrompts: result.results.filter(r => r.error).length,
    });

  } catch (error) {
    console.error('[API] Error sending prompts to Midjourney:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send prompts to Midjourney' 
      },
      { status: 500 }
    );
  }
}