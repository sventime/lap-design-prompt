'use client';

import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { UploadedImage, formatFileSize } from '@/types';
import { useScrollLock } from '@/hooks/useScrollLock';

interface CompletedResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedImages: UploadedImage[];
  onViewResults: (image: UploadedImage) => void;
  onDownloadAll: () => void;
}

export default function CompletedResultsModal({ 
  isOpen, 
  onClose, 
  completedImages, 
  onViewResults, 
  onDownloadAll 
}: CompletedResultsModalProps) {
  // Lock body scroll when modal is open
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const sortedImages = completedImages.sort((a, b) => {
    const aId = a.completedId || 0;
    const bId = b.completedId || 0;
    return bId - aId;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto animate-in fade-in duration-300">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass border border-emerald-700/50 rounded-2xl shadow-2xl w-full max-w-6xl my-8 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-emerald-700/50 bg-emerald-500/5">
          <div>
            <h2 className="text-3xl font-bold text-emerald-300">All Completed Results</h2>
            <p className="text-emerald-400/80 mt-1">
              {completedImages.filter(img => img.status === 'completed').length} successful • {completedImages.filter(img => img.status === 'error').length} failed
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {completedImages.some(img => img.status === 'completed') && (
              <button
                onClick={onDownloadAll}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
              >
                <Download className="h-5 w-5" />
                <span>Download All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-3 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/50 transition-all cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto">
          {sortedImages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-6xl mb-4">📋</div>
                <div className="text-xl">No completed results yet</div>
                <div className="text-sm mt-2">Upload images and generate prompts to see results here</div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/30">
              {sortedImages.map((image, index) => (
                <div 
                  key={`modal-completed-${image.completedId || image.id}`}
                  className="p-6 hover:bg-gray-800/20 transition-all duration-200 animate-in slide-in-from-left"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center space-x-6">
                    {/* Image Thumbnail */}
                    <div className="relative group">
                      <img
                        src={image.preview}
                        alt={image.file.name}
                        className="w-24 h-24 object-cover rounded-xl border border-gray-700/50 group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>

                    {/* Image Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="text-2xl font-bold text-emerald-400">
                          #{image.completedId}
                        </div>
                        <div className="text-sm text-gray-400 font-mono bg-gray-800/50 px-3 py-1 rounded-lg">
                          {image.generatedAt 
                            ? image.generatedAt.toLocaleDateString() + ' ' + image.generatedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            : 'No date'
                          }
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          image.promptType === 'outfit' 
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}>
                          {image.promptType === 'outfit' ? 'Outfit' : 'Texture'}
                        </div>
                      </div>

                      <div className="text-lg text-white font-medium mb-1 truncate">
                        {image.file.name}
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-300">
                        <span className="font-medium">
                          {image.clothingPart === 'other' && image.customClothingPart 
                            ? image.customClothingPart 
                            : image.clothingPart}
                        </span>
                        <span>{formatFileSize(image.file.size)}</span>
                        {image.midjourneyPrompts && (
                          <span className="text-emerald-400 font-medium">
                            {image.midjourneyPrompts.length} prompts generated
                          </span>
                        )}
                      </div>

                      {image.error && (
                        <div className="text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 mt-2">
                          {image.error}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2">
                      {image.status === 'completed' && (
                        <button
                          onClick={() => onViewResults(image)}
                          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
                        >
                          View Prompts
                        </button>
                      )}
                      {image.status === 'error' && (
                        <div className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                          <div className="h-5 w-5">
                            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium">Failed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}