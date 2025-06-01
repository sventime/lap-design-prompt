'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface PromptCardProps {
  prompt: string;
  index: number;
  onCopy: (prompt: string, index: number) => void;
  copied: boolean;
}

export default function PromptCard({ prompt, index, onCopy, copied }: PromptCardProps) {

  const openInMidjourney = () => {
    // Open Midjourney website
    window.open(`https://www.midjourney.com/imagine`, '_blank');
  };

  return (
    <div
      className="group glass border border-gray-700/30 rounded-2xl p-6 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer card-hover"
      onClick={() => onCopy(prompt, index)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-lg font-semibold text-white">
              Prompt {index + 1}
            </span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 font-medium">
              {prompt.length} chars
            </span>
          </div>
          <p className="text-base text-gray-200 leading-relaxed break-words">
            {prompt}
          </p>
        </div>
        <div className="ml-6 flex flex-col space-y-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(prompt, index);
            }}
            className="p-3 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/50 transition-all hover:scale-110"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-5 w-5 text-emerald-400" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openInMidjourney();
            }}
            className="p-3 text-gray-400 hover:text-indigo-400 rounded-xl hover:bg-gray-800/50 transition-all hover:scale-110"
            title="Open Midjourney"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>
      </div>
      
    </div>
  );
}