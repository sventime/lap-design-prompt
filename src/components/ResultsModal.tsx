'use client';

import React, { useState } from 'react';
import { X, Download, Zap } from 'lucide-react';
import { UploadedImage, formatFileSize } from '@/types';
import PromptCard from './PromptCard';

interface ResultsModalProps {
  image: UploadedImage | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ResultsModal({ image, isOpen, onClose }: ResultsModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen || !image) return null;

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const copyAllPrompts = async () => {
    if (!image.midjourneyPrompts) return;
    
    const allPrompts = image.midjourneyPrompts
      .map((prompt, index) => `${index + 1}. ${prompt}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(allPrompts);
      setCopiedIndex(-1); // Special index for "all copied"
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy all prompts: ', err);
    }
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = image.preview;
    link.download = image.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPrompts = () => {
    if (!image.midjourneyPrompts) return;

    const content = image.midjourneyPrompts
      .map((prompt, index) => `${index + 1}. ${prompt}`)
      .join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midjourney-prompts-${image.file.name.replace(/\.[^/.]+$/, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass border border-gray-700/50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-700/50">
          <div>
            <h2 className="text-2xl font-bold text-white">Midjourney Prompts</h2>
            <p className="text-lg text-gray-300 mt-2">
              {image.file.name} • {image.clothingPart === 'other' && image.customClothingPart 
                ? image.customClothingPart 
                : image.clothingPart} • {image.promptType} prompts
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={copyAllPrompts}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-500 hover:to-pink-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
            >
              <Zap className="h-5 w-5" />
              <span>{copiedIndex === -1 ? 'Copied!' : 'Copy All'}</span>
            </button>
            <button
              onClick={downloadPrompts}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:from-indigo-500 hover:to-blue-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
            >
              <Download className="h-5 w-5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-3 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/50 transition-all cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-120px)]">
          {/* Image Preview */}
          <div className="w-1/3 p-8 border-r border-gray-700/50 bg-gray-800/20">
            <div className="relative">
              <img
                src={image.preview}
                alt={image.file.name}
                className="w-full h-auto rounded-2xl shadow-2xl border border-gray-700/30"
              />
              <button
                onClick={downloadImage}
                className="absolute bottom-3 right-3 p-3 rounded-xl backdrop-blur-sm border transition-all hover:scale-110 bg-gray-800/80 text-gray-300 border-gray-600 hover:bg-gray-700/80 hover:text-white cursor-pointer"
                title="Download image"
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 text-sm text-gray-300 space-y-2">
              <p><strong className="text-white">Clothing Part:</strong> {image.clothingPart === 'other' && image.customClothingPart 
                ? image.customClothingPart 
                : image.clothingPart}</p>
              <p><strong className="text-white">Prompt Type:</strong> {image.promptType === 'outfit' ? 'Complete Outfit' : 'Material Texture'}</p>
              <p><strong className="text-white">Size:</strong> {formatFileSize(image.file.size)}</p>
            </div>
          </div>

          {/* Prompts List */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white">
                  Generated Prompts ({image.midjourneyPrompts?.length || 0})
                </h3>
                <span className="text-sm text-indigo-300 font-medium px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                  Ready for Midjourney v6
                </span>
              </div>

              {image.midjourneyPrompts?.map((prompt, index) => (
                <PromptCard
                  key={index}
                  prompt={prompt}
                  index={index}
                  onCopy={copyToClipboard}
                  copied={copiedIndex === index}
                />
              ))}

              {(!image.midjourneyPrompts || image.midjourneyPrompts.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No prompts generated yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}