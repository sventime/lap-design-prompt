import { NextRequest, NextResponse } from 'next/server';
import { generateMidjourneyPrompt } from '@/lib/openai';
import { sendProgressUpdate } from '../progress/route';

interface BatchItem {
  id: string;
  imageBase64: string;
  clothingPart: string;
  customClothingPart?: string;
  promptType: 'outfit' | 'texture';
  description: string;
  fileName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { items, sessionId } = await request.json() as { items: BatchItem[], sessionId?: string };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided for batch processing' },
        { status: 400 }
      );
    }

    if (items.length > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 items allowed per batch' },
        { status: 400 }
      );
    }

    // Send initial progress update
    if (sessionId) {
      sendProgressUpdate(sessionId, {
        type: 'batch_started',
        total: items.length,
        completed: 0,
        processing: 0,
        status: 'Starting batch processing...'
      });
    }

    // Process items sequentially to provide real-time progress
    const results = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Update progress - mark current item as processing
      if (sessionId) {
        sendProgressUpdate(sessionId, {
          type: 'progress_update',
          total: items.length,
          completed: i,
          processing: 1,
          currentItem: {
            id: item.id,
            fileName: item.fileName || `Image ${i + 1}`,
            clothingPart: item.clothingPart === 'other' && item.customClothingPart 
              ? item.customClothingPart 
              : item.clothingPart,
            promptType: item.promptType
          },
          status: `Processing image ${i + 1} of ${items.length}...`
        });
      }

      try {
        // Remove data URL prefix if present
        const base64Data = item.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        
        const clothingPartToUse = item.clothingPart === 'other' && item.customClothingPart 
          ? item.customClothingPart 
          : item.clothingPart;

        const result = await generateMidjourneyPrompt(
          base64Data,
          clothingPartToUse,
          item.description || '',
          item.promptType
        );

        const itemResult = {
          id: item.id,
          success: true,
          ...result
        };
        
        results.push(itemResult);

        // Send progress update after successful completion
        if (sessionId) {
          sendProgressUpdate(sessionId, {
            type: 'item_completed',
            total: items.length,
            completed: i + 1,
            processing: 0,
            itemResult,
            status: `Completed ${i + 1} of ${items.length} images`
          });
        }

      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        
        const itemResult = {
          id: item.id,
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        };
        
        results.push(itemResult);

        // Send progress update for failed item
        if (sessionId) {
          sendProgressUpdate(sessionId, {
            type: 'item_failed',
            total: items.length,
            completed: i + 1,
            processing: 0,
            itemResult,
            status: `Failed to process image ${i + 1} of ${items.length}`
          });
        }
      }

      // Add small delay between items to respect rate limits
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Send final completion update
    if (sessionId) {
      sendProgressUpdate(sessionId, {
        type: 'batch_completed',
        total: items.length,
        completed: items.length,
        processing: 0,
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length,
        status: 'Batch processing completed!'
      });
    }

    return NextResponse.json({
      success: true,
      results,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Batch processing failed' 
      },
      { status: 500 }
    );
  }
}