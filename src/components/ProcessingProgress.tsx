'use client';

import React from 'react';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { UploadedImage, formatFileSize } from '@/types';

interface ProcessingProgressProps {
  images: UploadedImage[];
  isProcessing: boolean;
  onViewResults: (image: UploadedImage) => void;
  progressData?: {
    total: number;
    completed: number;
    processing: number;
    status: string;
    currentItem: any;
    midjourneyProgress?: {
      promptIndex: number;
      totalPrompts: number;
      status: string;
    };
  };
  serverUpdates?: Array<{
    timestamp: number;
    type: string;
    message: string;
    details?: any;
  }>;
  isStopping?: boolean;
}

export default function ProcessingProgress({ images, isProcessing, onViewResults, progressData, serverUpdates, isStopping }: ProcessingProgressProps) {
  const activeImages = images; // images array now only contains pending/processing
  
  // Use real-time progress data if available, otherwise fallback to local calculation
  const totalActiveImages = progressData?.total || images.length;
  const completedImages = progressData?.completed || images.filter(img => img.status === 'completed').length;
  const processingImages = progressData?.processing || images.filter(img => img.status === 'processing').length;
  const pendingImages = totalActiveImages - completedImages - processingImages;

  // Enhanced progress calculation including Midjourney prompt progress
  const calculateDetailedProgress = () => {
    if (totalActiveImages === 0) return 0;
    
    let totalProgress = completedImages; // Each completed image = 1 full unit
    
    // Add partial progress for currently processing image
    if (progressData?.midjourneyProgress && processingImages > 0) {
      const { promptIndex, totalPrompts } = progressData.midjourneyProgress;
      const currentImageProgress = promptIndex / totalPrompts;
      totalProgress += currentImageProgress;
    }
    
    return Math.min((totalProgress / totalActiveImages) * 100, 100);
  };

  const progress = calculateDetailedProgress();
  
  // Debug logging
  console.log('Progress Debug:', {
    totalActiveImages,
    completedImages,
    processingImages,
    pendingImages,
    progress: `${progress.toFixed(1)}%`,
    midjourneyProgress: progressData?.midjourneyProgress,
    isProcessing,
    progressData
  });

  // Show component if we're processing OR if there's progress data OR if there are active images
  if (!isProcessing && totalActiveImages === 0 && !progressData?.total) return null;

  return (
    <div className={`w-full space-y-8 transition-opacity duration-500 ${isStopping ? 'opacity-60' : 'opacity-100'}`}>
      {/* Overall Progress */}
      <div className="glass rounded-2xl border border-gray-700/50 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Processing Progress</h3>
          <div className="text-lg text-indigo-300 font-medium">
            {progressData?.status || (totalActiveImages > 0 ? `${totalActiveImages} in queue` : 'All processing complete')}
          </div>
        </div>
        
        {/* Current Item Being Processed */}
        <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {progressData?.currentItem ? (
                <>
                  <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                  <div className="text-indigo-300">
                    <span className="font-medium">Currently processing:</span>{' '}
                    <span className="text-white font-semibold">{progressData.currentItem.fileName}</span>{' '}
                    <span className="text-indigo-200">{progressData.currentItem.clothingPart}</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium border ${
                      progressData.currentItem.promptType === 'outfit' 
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                        : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    }`}>
                      {progressData.currentItem.promptType === 'outfit' ? 'Outfit' : 'Texture'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-5 w-5 rounded-full bg-indigo-400/20 border border-indigo-400/30"></div>
                  <div className="text-indigo-300">
                    <span className="font-medium">Preparing batch processing...</span>
                    <span className="text-indigo-200 ml-2">Please wait while we initialize</span>
                  </div>
                </>
              )}
            </div>
            
            {/* Midjourney Progress */}
            {progressData?.midjourneyProgress && (
              <div className={`ml-8 pl-4 border-l-2 transition-all duration-500 ${
                isStopping ? 'border-orange-500/50' : 'border-indigo-500/30'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`h-3 w-3 rounded-full transition-colors duration-500 ${
                    isStopping ? 'bg-orange-400 animate-pulse' : 'bg-indigo-400 animate-pulse'
                  }`}></div>
                  <div className="text-sm text-indigo-200">
                    <span className="font-medium">Midjourney:</span>{' '}
                    <span className="text-white">
                      Prompt {progressData.midjourneyProgress.promptIndex}/{progressData.midjourneyProgress.totalPrompts}
                    </span>{' '}
                    <span className={`transition-colors duration-500 ${
                      isStopping ? 'text-orange-300' : 'text-indigo-300'
                    }`}>• {progressData.midjourneyProgress.status}</span>
                    {isStopping && (
                      <span className="text-orange-400 ml-2 font-medium">(Stopping after completion)</span>
                    )}
                  </div>
                </div>
                
                {/* Midjourney Progress Bar */}
                <div className="mt-2 w-full bg-gray-700/30 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isStopping 
                        ? 'bg-gradient-to-r from-orange-400 to-red-400' 
                        : 'bg-gradient-to-r from-indigo-400 to-purple-400'
                    }`}
                    style={{ 
                      width: `${(progressData.midjourneyProgress.promptIndex / progressData.midjourneyProgress.totalPrompts) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-gray-700/50 rounded-full h-4 mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-700/30 to-gray-600/30 rounded-full"></div>
          <div 
            className="relative h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
            style={{ 
              width: `${Math.max(progress, isProcessing && totalActiveImages > 0 ? 2 : 0)}%`,
              minWidth: isProcessing && totalActiveImages > 0 ? '8px' : '0px'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full animate-shimmer"></div>
          </div>
          <div className="absolute inset-0 rounded-full shadow-inner"></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 text-center">
          <div className="group space-y-2 p-4 rounded-xl hover:bg-gray-800/30 transition-all cursor-default">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
              <span className="text-sm text-gray-300 font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{completedImages}</div>
          </div>
          <div className="group space-y-2 p-4 rounded-xl hover:bg-gray-800/30 transition-all cursor-default">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className={`h-5 w-5 text-indigo-400 ${processingImages > 0 ? 'animate-spin' : ''} transition-colors`} />
              <span className="text-sm text-gray-300 font-medium">Processing</span>
            </div>
            <div className="text-2xl font-bold text-indigo-400">{processingImages}</div>
          </div>
          <div className="group space-y-2 p-4 rounded-xl hover:bg-gray-800/30 transition-all cursor-default">
            <div className="flex items-center justify-center space-x-2">
              <Clock className="h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
              <span className="text-sm text-gray-300 font-medium">Remaining</span>
            </div>
            <div className="text-2xl font-bold text-white">{pendingImages}</div>
          </div>
        </div>
      </div>

      {/* Active Processing Images */}
      {totalActiveImages > 0 && (
        <div className="glass rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="p-6 border-b border-gray-700/50">
            <h4 className="text-xl font-semibold text-white">Current Processing Queue</h4>
            <p className="text-sm text-gray-400 mt-1">Images being processed or waiting to be processed</p>
          </div>
          <div className="divide-y divide-gray-700/30 max-h-96 overflow-y-auto">
            {activeImages.map((image) => (
            <div key={image.id} className="p-6 flex items-center space-x-6 hover:bg-gray-800/20 transition-colors">
              {/* Image Thumbnail */}
              <div className="relative">
                <img
                  src={image.preview}
                  alt={image.file.name}
                  className="w-20 h-20 object-cover rounded-xl border border-gray-700/50"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>

              {/* Image Info */}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-medium text-white truncate mb-1">
                  {image.file.name}
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm text-gray-300">
                    {image.clothingPart === 'other' && image.customClothingPart 
                      ? image.customClothingPart 
                      : image.clothingPart}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    image.promptType === 'outfit' 
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}>
                    {image.promptType === 'outfit' ? 'Outfit' : 'Texture'}
                  </span>
                  <span className="text-sm text-gray-300">
                    {formatFileSize(image.file.size)}
                  </span>
                </div>
                {image.error && (
                  <div className="text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                    {image.error}
                  </div>
                )}
              </div>

              {/* Status Icon */}
              <div className="flex items-center space-x-3">
                {image.status === 'pending' && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-6 w-6 text-gray-400" />
                    <span className="text-sm text-gray-400 font-medium">Pending</span>
                  </div>
                )}
                {image.status === 'processing' && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                    <span className="text-sm text-indigo-400 font-medium">Processing</span>
                  </div>
                )}
                {image.status === 'completed' && (
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                    <button
                      onClick={() => onViewResults(image)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
                    >
                      View Results
                    </button>
                  </div>
                )}
                {image.status === 'error' && (
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-6 w-6 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">Failed</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}


      {/* Server Updates Log */}
      {(serverUpdates && serverUpdates.length > 0) && (
        <div className="glass rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="p-6 border-b border-gray-700/50">
            <h4 className="text-xl font-semibold text-white">Server Updates</h4>
            <p className="text-sm text-gray-400 mt-1">Real-time processing status from server</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <div className="divide-y divide-gray-700/30">
              {serverUpdates.slice(-10).reverse().map((update, index) => {
                const isRecent = Date.now() - update.timestamp < 5000; // Highlight updates from last 5 seconds
                const typeColors = {
                  'batch_started': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                  'progress_update': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                  'midjourney_progress': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                  'item_completed': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  'item_failed': 'text-red-400 bg-red-500/10 border-red-500/20',
                  'batch_completed': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  'processing_stopping': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                  'processing_stopped': 'text-red-400 bg-red-500/10 border-red-500/20',
                  'batch_aborted': 'text-red-400 bg-red-500/10 border-red-500/20',
                  'default': 'text-gray-400 bg-gray-500/10 border-gray-500/20'
                };
                
                const colorClass = typeColors[update.type as keyof typeof typeColors] || typeColors.default;
                
                return (
                  <div 
                    key={`${update.timestamp}-${index}`} 
                    className={`p-4 hover:bg-gray-800/20 transition-all ${isRecent ? 'bg-indigo-500/5 border-l-2 border-indigo-400' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium border ${colorClass} mt-0.5`}>
                        {update.type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium mb-1">
                          {update.message}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(update.timestamp).toLocaleTimeString()}
                          {update.details && (
                            <span className="ml-2 text-gray-500">
                              • {JSON.stringify(update.details).slice(0, 100)}
                              {JSON.stringify(update.details).length > 100 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {isRecent && (
                        <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="text-center py-8">
          <div className="inline-flex items-center space-x-4 glass rounded-full px-8 py-4 border border-gray-700/50">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-lg text-indigo-300 font-medium">Generating Midjourney prompts...</span>
          </div>
        </div>
      )}
    </div>
  );
}