import { UploadedImage } from '@/types';

interface ProcessingSession {
  images: UploadedImage[];
  completedImages: UploadedImage[];
  isProcessing: boolean;
  sessionId: string;
  progressData: {
    total: number;
    completed: number;
    processing: number;
    status: string;
    currentItem: any;
    midjourneyProgress?: any;
  };
  serverUpdates: Array<{
    timestamp: number;
    type: string;
    message: string;
    details?: any;
  }>;
  processingAborted: boolean;
  isStopping: boolean;
  completedIdCounter: number;
  timestamp: number;
}

const SESSION_STORAGE_KEY = 'clothing-design-processing-session';
const SESSION_EXPIRY_HOURS = 24; // Sessions expire after 24 hours

export const sessionStorageManager = {
  save: (data: Partial<ProcessingSession>) => {
    try {
      const existing = sessionStorageManager.load();
      const updated = {
        ...existing,
        ...data,
        timestamp: Date.now(),
      };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to save to session storage:', error);
    }
  },

  load: (): ProcessingSession | null => {
    try {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as ProcessingSession;
      
      // Check if session has expired
      const now = Date.now();
      const sessionAge = now - (data.timestamp || 0);
      const expiryTime = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
      
      if (sessionAge > expiryTime) {
        sessionStorageManager.clear();
        return null;
      }

      // Convert date strings back to Date objects for completedImages
      if (data.completedImages) {
        data.completedImages = data.completedImages.map(img => ({
          ...img,
          generatedAt: img.generatedAt ? new Date(img.generatedAt) : undefined,
        }));
      }

      return data;
    } catch (error) {
      console.warn('Failed to load from session storage:', error);
      return null;
    }
  },

  clear: () => {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear session storage:', error);
    }
  },

  // Save only processing-related data
  saveProcessingState: (
    images: UploadedImage[],
    isProcessing: boolean,
    sessionId: string,
    progressData: any,
    serverUpdates: any[],
    processingAborted: boolean,
    isStopping: boolean
  ) => {
    // Preserve file metadata for processing images
    const processedImages = images.map(img => {
      return {
        ...img,
        // Preserve file metadata
        fileName: img.fileName || img.file?.name,
        fileSize: img.fileSize || img.file?.size,
        fileType: img.fileType || img.file?.type,
      };
    });

    sessionStorageManager.save({
      images: processedImages,
      isProcessing,
      sessionId,
      progressData,
      serverUpdates,
      processingAborted,
      isStopping,
    });
  },

  // Save completed results with CDN links
  saveCompletedResults: (completedImages: UploadedImage[], completedIdCounter: number) => {
    // Convert images to preserve file metadata for session storage
    const processedImages = completedImages.map(img => {
      return {
        ...img,
        // Preserve file metadata
        fileName: img.fileName || img.file?.name,
        fileSize: img.fileSize || img.file?.size,
        fileType: img.fileType || img.file?.type,
        // Keep the original preview for display, but server should provide CDN links
        preview: img.preview, // This could be updated to CDN link when received from server
      };
    });

    sessionStorageManager.save({
      completedImages: processedImages,
      completedIdCounter,
    });
  },

  // Clear only processing data, keep completed results
  clearProcessingData: () => {
    try {
      const data = sessionStorageManager.load();
      if (data) {
        // Keep only completed data
        const cleanedData = {
          completedImages: data.completedImages || [],
          completedIdCounter: data.completedIdCounter || 1,
          timestamp: Date.now(),
        };
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cleanedData));
        console.log('[SESSION] Processing data cleared, completed results preserved');
      }
    } catch (error) {
      console.warn('Failed to clear processing data from session storage:', error);
    }
  },

  // Restore state for components
  restoreState: () => {
    const data = sessionStorageManager.load();
    if (!data) {
      return {
        images: [],
        completedImages: [],
        isProcessing: false,
        sessionId: '',
        progressData: {
          total: 0,
          completed: 0,
          processing: 0,
          status: '',
          currentItem: null,
          midjourneyProgress: undefined,
        },
        serverUpdates: [],
        processingAborted: false,
        isStopping: false,
        completedIdCounter: 1,
      };
    }

    return {
      images: data.images || [],
      completedImages: data.completedImages || [],
      isProcessing: data.isProcessing || false,
      sessionId: data.sessionId || '',
      progressData: data.progressData || {
        total: 0,
        completed: 0,
        processing: 0,
        status: '',
        currentItem: null,
        midjourneyProgress: undefined,
      },
      serverUpdates: data.serverUpdates || [],
      processingAborted: data.processingAborted || false,
      isStopping: data.isStopping || false,
      completedIdCounter: data.completedIdCounter || 1,
    };
  },
};