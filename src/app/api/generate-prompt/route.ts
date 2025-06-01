import { NextRequest, NextResponse } from 'next/server';
import { generateMidjourneyPrompt } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, clothingPart, description } = await request.json();

    if (!imageBase64 || !clothingPart) {
      return NextResponse.json(
        { error: 'Missing required fields: imageBase64 and clothingPart' },
        { status: 400 }
      );
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const result = await generateMidjourneyPrompt(
      base64Data,
      clothingPart,
      description || '',
      "outfit",
      "female",
      undefined,
      true
    );

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Prompt generation error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate prompt' 
      },
      { status: 500 }
    );
  }
}