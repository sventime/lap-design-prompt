import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (files.length > 30) {
      return NextResponse.json({ error: 'Maximum 30 files allowed' }, { status: 400 });
    }

    

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`Invalid file type: ${file.type}`);
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File too large: ${file.name}`);
        }

        // Process image with sharp for optimization
        const processedBuffer = await sharp(buffer)
          .resize(1024, 1024, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Convert to base64 for storage/processing
        const base64 = processedBuffer.toString('base64');

        return {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          base64,
          preview: `data:image/jpeg;base64,${base64}`
        };
      })
    );

    return NextResponse.json({
      success: true,
      files: processedFiles
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}