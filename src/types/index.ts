export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  clothingPart: ClothingPart;
  customClothingPart?: string;
  promptType: PromptType;
  status: 'pending' | 'processing' | 'completed' | 'error';
  prompt?: string; // Original ChatGPT response
  midjourneyPrompts?: string[]; // Parsed Midjourney prompts
  error?: string;
  completedId?: number;
  generatedAt?: Date;
}

export type ClothingPart = 'top' | 'bottom' | 'shoes' | 'accessories' | 'dress' | 'outerwear' | 'hair' | 'features' | 'other';

export type PromptType = 'outfit' | 'texture';

export interface GeneratePromptRequest {
  imageId: string;
  clothingPart: ClothingPart;
  description: string;
}

export interface GeneratePromptResponse {
  prompt: string;
  midjourneyPrompts: string[];
}

export interface ProcessingJob {
  id: string;
  images: UploadedImage[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  results: ProcessingResult[];
}

export interface ProcessingResult {
  imageId: string;
  prompt: string;
  midjourneyPrompts: string[];
  status: 'success' | 'error';
  error?: string;
}

// Utility function to format file sizes
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }
}

