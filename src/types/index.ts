export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  clothingPart: ClothingPart;
  customClothingPart?: string;
  promptType: PromptType;
  genderType?: GenderType;
  guidance?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  prompt?: string; // Original ChatGPT response
  midjourneyPrompts?: string[]; // Parsed Midjourney prompts
  outfitNames?: string[]; // Parsed outfit naming suggestions
  error?: string;
  completedId?: number;
  generatedAt?: Date;
  processingId?: string;
}

export type ClothingPart = 'top' | 'bottom' | 'shoes' | 'accessories' | 'dress' | 'outerwear' | 'hair' | 'features' | 'other';

export type PromptType = 'outfit' | 'texture';

export type GenderType = 'male' | 'female';

export interface GeneratePromptRequest {
  imageId: string;
  clothingPart: ClothingPart;
  description: string;
}

export interface GeneratePromptResponse {
  prompt: string;
  midjourneyPrompts: string[];
  outfitNames?: string[];
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
  outfitNames?: string[];
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

