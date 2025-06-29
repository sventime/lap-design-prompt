'use client';

import React, { useState } from 'react';
import { X, Download, MessageSquare, Copy, Check } from 'lucide-react';
import { UploadedImage, formatFileSize } from '@/types';
import PromptCard from './PromptCard';
import { useScrollLock } from '@/hooks/useScrollLock';

interface ResultsModalProps {
  image: UploadedImage | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ResultsModal({ image, isOpen, onClose }: ResultsModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'prompts' | 'names' | 'raw'>('prompts');
  const [chatGPTResponseCopied, setChatGPTResponseCopied] = useState(false);

  // Lock body scroll when modal is open
  useScrollLock(isOpen);

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

  const copyChatGPTResponse = async () => {
    if (!image.prompt) return;
    
    try {
      await navigator.clipboard.writeText(image.prompt);
      setChatGPTResponseCopied(true);
      setTimeout(() => setChatGPTResponseCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ChatGPT response: ', err);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
        <div className="glass border border-gray-700/50 rounded-2xl shadow-2xl max-w-6xl w-full my-2 sm:my-8 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 lg:p-8 border-b border-gray-700/50 space-y-3 sm:space-y-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Midjourney Prompts</h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-300 mt-1 sm:mt-2 truncate">
              <span className="block sm:inline">{image.file.name}</span>
              <span className="hidden sm:inline"> • </span>
              <span className="block sm:inline">{image.clothingPart === 'other' && image.customClothingPart 
                ? image.customClothingPart 
                : image.clothingPart} • {image.promptType} prompts</span>
            </p>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <button
              onClick={downloadPrompts}
              className="flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-3 lg:px-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:from-indigo-500 hover:to-blue-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer text-sm sm:text-base"
            >
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 sm:p-3 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/50 transition-all cursor-pointer"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row min-h-[400px] sm:min-h-[500px] lg:min-h-[600px]">
          {/* Image Preview */}
          <div className="w-full lg:w-1/3 p-4 sm:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-700/50 bg-gray-800/20">
            <div className="relative max-w-sm mx-auto lg:max-w-none">
              <img
                src={image.preview}
                alt={image.file.name}
                className="w-full h-auto rounded-xl sm:rounded-2xl shadow-2xl border border-gray-700/30"
              />
              <button
                onClick={downloadImage}
                className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 p-2 sm:p-3 rounded-xl backdrop-blur-sm border transition-all hover:scale-110 bg-gray-800/80 text-gray-300 border-gray-600 hover:bg-gray-700/80 hover:text-white cursor-pointer"
                title="Download image"
              >
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="mt-4 sm:mt-6 text-xs sm:text-sm text-gray-300 space-y-2">
              <p><strong className="text-white">Clothing Part:</strong> {image.clothingPart === 'other' && image.customClothingPart 
                ? image.customClothingPart 
                : image.clothingPart}</p>
              <p><strong className="text-white">Prompt Type:</strong> {image.promptType === 'outfit' ? 'Complete Outfit' : 'Material Texture'}</p>
              <p><strong className="text-white">Size:</strong> {formatFileSize(image.fileSize || image.file?.size)}</p>
            </div>
          </div>

          {/* Tabs and Content */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="space-y-4 sm:space-y-6">
              {/* Tab Navigation */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-1 sm:space-y-0 sm:space-x-1 bg-gray-800/50 border border-gray-700/50 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('prompts')}
                  className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-medium text-xs sm:text-sm transition-all duration-300 cursor-pointer ${
                    activeTab === 'prompts'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
                >
                  <span className="hidden sm:inline">Prompts ({image.midjourneyPrompts?.length || 0})</span>
                  <span className="sm:hidden">Prompts</span>
                </button>
                {image.promptType === 'outfit' && image.outfitNames && image.outfitNames.length > 0 && (
                  <button
                    onClick={() => setActiveTab('names')}
                    className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-medium text-xs sm:text-sm transition-all duration-300 cursor-pointer ${
                      activeTab === 'names'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                    }`}
                  >
                    <span className="hidden sm:inline">Outfit Names ({image.outfitNames?.length || 0})</span>
                    <span className="sm:hidden">Names</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('raw')}
                  className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-medium text-xs sm:text-sm transition-all duration-300 cursor-pointer ${
                    activeTab === 'raw'
                      ? 'bg-gradient-to-r from-gray-600 to-slate-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
                >
                  <span className="hidden sm:inline">Raw Response</span>
                  <span className="sm:hidden">Raw</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="relative overflow-hidden">
                {/* Prompts Tab */}
                <div className={`transition-all duration-300 ease-in-out ${
                  activeTab === 'prompts' 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 translate-x-4 absolute inset-0 pointer-events-none'
                }`}>
                  {image.midjourneyPrompts && image.midjourneyPrompts.length > 0 ? (
                    <div className="space-y-6">
                      {image.midjourneyPrompts.map((prompt, index) => (
                        <PromptCard
                          key={index}
                          prompt={prompt}
                          index={index}
                          onCopy={copyToClipboard}
                          copied={copiedIndex === index}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 sm:p-6">
                      <div className="flex items-start space-x-3 mb-4">
                        <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <h4 className="text-base sm:text-lg font-semibold text-yellow-300">No Prompts Found</h4>
                          <p className="text-yellow-200/80 text-xs sm:text-sm mt-1">Could not extract Midjourney prompts from the response. Check the Raw Response tab for the original output.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Outfit Names Tab */}
                {image.promptType === 'outfit' && (
                  <div className={`transition-all duration-300 ease-in-out ${
                    activeTab === 'names' 
                      ? 'opacity-100 translate-x-0' 
                      : 'opacity-0 translate-x-4 absolute inset-0 pointer-events-none'
                  }`}>
                    {image.outfitNames && image.outfitNames.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                          <h4 className="text-base sm:text-lg font-semibold text-white">Outfit Naming Suggestions</h4>
                          <span className="text-xs sm:text-sm text-emerald-300 font-medium px-2 py-1 sm:px-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 self-start">
                            English + Russian
                          </span>
                        </div>
                        <div className="grid gap-3">
                          {image.outfitNames.map((name, index) => (
                            <div key={index} className="glass border border-gray-700/30 rounded-xl p-3 sm:p-4 hover:border-emerald-500/50 transition-all duration-300">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-medium text-sm sm:text-base break-words">
                                    {name}
                                  </div>
                                </div>
                                <button
                                  onClick={() => navigator.clipboard.writeText(name)}
                                  className="p-1.5 sm:p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-all hover:scale-110 cursor-pointer flex-shrink-0 ml-2"
                                  title="Copy outfit name"
                                >
                                  <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 sm:py-8 text-gray-500">
                        <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm sm:text-base">No outfit names available</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Raw Response Tab */}
                <div className={`transition-all duration-300 ease-in-out ${
                  activeTab === 'raw' 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 -translate-x-4 absolute inset-0 pointer-events-none'
                }`}>
                  {image.prompt ? (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                        <h4 className="text-base sm:text-lg font-semibold text-white">Original AI Response</h4>
                        <button
                          onClick={copyChatGPTResponse}
                          className="flex items-center space-x-2 px-3 py-2 sm:px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer text-sm sm:text-base self-start"
                        >
                          {chatGPTResponseCopied ? (
                            <>
                              <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 sm:p-6">
                        <pre className="text-gray-200 whitespace-pre-wrap break-words font-mono text-xs sm:text-sm leading-relaxed">
                          {image.prompt}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-gray-500">
                      <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">No AI response available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}