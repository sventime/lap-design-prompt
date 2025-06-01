import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, fileName } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Create public/temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'public', 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = join(tempDir, uniqueFileName);

    // Write file
    await writeFile(filePath, Buffer.from(base64Data, 'base64'));

    // Return public URL
    const publicUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/temp/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl
    });

  } catch (error) {
    console.error('Upload for Midjourney error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}