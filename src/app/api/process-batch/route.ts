import { NextRequest, NextResponse } from 'next/server';
import { generateMidjourneyPrompt } from '@/lib/openai';
import { sendProgressUpdate } from '../progress/route';
import { shouldAbortProcessing, clearAbortSignal } from '../abort-processing/route';

interface BatchItem {
  id: string;
  imageBase64: string;
  clothingPart: string;
  customClothingPart?: string;
  promptType: 'outfit' | 'texture';
  genderType?: 'male' | 'female';
  guidance?: string;
  description: string;
  fileName?: string;
  preview?: string; // Image URL for Midjourney
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
      
      // Check if processing should be aborted
      if (shouldAbortProcessing(sessionId || '')) {
        console.log(`[BATCH] Processing aborted by user for session: ${sessionId}`);
        
        // Send abort notification
        if (sessionId) {
          sendProgressUpdate(sessionId, {
            type: 'batch_aborted',
            total: items.length,
            completed: i,
            processing: 0,
            status: `Processing stopped by user after ${i} items`,
            abortedAt: i
          });
        }
        
        // Clear the abort signal
        clearAbortSignal(sessionId || '');
        
        // Return partial results
        return NextResponse.json({
          success: false,
          aborted: true,
          message: 'Processing stopped by user',
          results,
          totalProcessed: results.length,
          successCount: results.filter(r => r.success).length,
          errorCount: results.filter(r => !r.success).length,
          abortedAt: i
        });
      }
      
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
          item.promptType,
          item.genderType,
          item.guidance,
          true, // autoSendToMidjourney - will use base64Data directly for Discord attachment
          // Midjourney progress callback
          (promptIndex: number, total: number, status: string, details?: any) => {
            if (sessionId) {
              sendProgressUpdate(sessionId, {
                type: details?.errorType || 'midjourney_progress',
                total: items.length,
                completed: i,
                processing: 1,
                currentItem: {
                  id: item.id,
                  fileName: item.fileName || `Image ${i + 1}`,
                  clothingPart: clothingPartToUse,
                  promptType: item.promptType
                },
                midjourneyProgress: {
                  promptIndex,
                  totalPrompts: total,
                  status
                },
                status: `Processing image ${i + 1}/${items.length}: ${status}`,
                details: details // Pass through any additional details including error info
              });
            }
          },
          sessionId // Pass sessionId for abort checking
        );

        const itemResult = {
          id: item.id,
          success: true,
          ...result,
          // Include CDN URL if available
          cdnImageUrl: result.cdnImageUrl,
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