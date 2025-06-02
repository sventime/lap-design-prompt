"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronDown, ChevronRight, AlertTriangle, Activity, Clock } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

interface ServerUpdate {
  timestamp: number;
  type: string;
  message: string;
  details?: any;
}

interface ServerUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUpdates: ServerUpdate[];
}

export default function ServerUpdatesModal({
  isOpen,
  onClose,
  serverUpdates,
}: ServerUpdatesModalProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  useScrollLock(isOpen);

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  const expandAll = () => {
    const allKeys = serverUpdates.map((_, index) => `${serverUpdates[index].timestamp}-${index}`);
    setExpandedItems(new Set(allKeys));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const errorCount = serverUpdates.filter(update => 
    update.type.includes('failed') || update.type.includes('error') || 
    (update.details?.errorType && update.details.errorType.includes('failed'))
  ).length;

  const recentCount = serverUpdates.filter(update => 
    Date.now() - update.timestamp < 30000 // Last 30 seconds
  ).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl h-full max-h-[90vh] bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl border border-gray-700/50 shadow-2xl transform transition-all duration-300 ease-out animate-in slide-in-from-bottom-4 fade-in-0">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Activity className="h-6 w-6 text-indigo-400" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-indigo-400 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Server Updates</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {serverUpdates.length} total updates • {errorCount} errors • {recentCount} recent
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Expand/Collapse All */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-300 rounded-lg hover:bg-indigo-600/30 transition-colors border border-indigo-500/30"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1.5 text-xs bg-gray-600/20 text-gray-300 rounded-lg hover:bg-gray-600/30 transition-colors border border-gray-500/30"
                >
                  Collapse All
                </button>
              </div>
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="h-full overflow-y-auto p-6">
            <div className="space-y-4">
              {serverUpdates.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No server updates yet</p>
                </div>
              ) : (
                serverUpdates.map((update, index) => {
                  const isRecent = Date.now() - update.timestamp < 5000;
                  const updateKey = `${update.timestamp}-${index}`;
                  const isExpanded = expandedItems.has(updateKey);
                  const hasDetails = update.details && Object.keys(update.details).length > 0;
                  const isError = update.type.includes('failed') || update.type.includes('error') || 
                                 (update.details?.errorType && update.details.errorType.includes('failed'));
                  const isTimeout = update.details?.errorType === 'midjourney_timeout';
                  
                  const typeColors = {
                    batch_started: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                    progress_update: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                    midjourney_progress: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                    midjourney_prompt_failed: "text-red-400 bg-red-500/10 border-red-500/20",
                    midjourney_timeout: "text-orange-400 bg-orange-500/10 border-orange-500/20",
                    item_completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    item_failed: "text-red-400 bg-red-500/10 border-red-500/20",
                    batch_completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    processing_stopping: "text-orange-400 bg-orange-500/10 border-orange-500/20",
                    processing_stopped: "text-red-400 bg-red-500/10 border-red-500/20",
                    batch_aborted: "text-red-400 bg-red-500/10 border-red-500/20",
                    default: "text-gray-400 bg-gray-500/10 border-gray-500/20",
                  };

                  const colorClass = typeColors[update.type as keyof typeof typeColors] || typeColors.default;

                  return (
                    <div
                      key={updateKey}
                      className={`glass rounded-xl border transition-all duration-200 hover:border-gray-600/50 ${
                        isRecent ? "border-indigo-500/40 bg-indigo-500/5" : "border-gray-700/50"
                      } ${isError ? "border-l-4 border-l-red-500/60" : ""} ${isTimeout ? "border-l-4 border-l-orange-500/60" : ""}`}
                    >
                      <div className="p-4">
                        <div className="flex items-start space-x-3">
                          {/* Error Badge or Type Badge */}
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {isTimeout && (
                              <div className="px-3 py-1.5 rounded-full text-xs font-medium border bg-orange-500/20 text-orange-300 border-orange-500/30 flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>TIMEOUT</span>
                              </div>
                            )}
                            {isError && !isTimeout && (
                              <div className="px-3 py-1.5 rounded-full text-xs font-medium border bg-red-500/20 text-red-300 border-red-500/30 flex items-center space-x-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>ERROR</span>
                              </div>
                            )}
                            <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${colorClass}`}>
                              {update.type.replace("_", " ").toUpperCase()}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white font-medium mb-2">
                                  {update.message}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center space-x-3">
                                  <span>
                                    {new Date(update.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {new Date(update.timestamp).toLocaleDateString()}
                                  </span>
                                  {isRecent && (
                                    <>
                                      <span>•</span>
                                      <span className="text-indigo-400 font-medium animate-pulse">Recent</span>
                                    </>
                                  )}
                                </div>
                                {hasDetails && !isExpanded && (
                                  <div className="mt-2 text-xs text-gray-500">
                                    <span className="break-all">
                                      {JSON.stringify(update.details).slice(0, 100)}...
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Expand/Collapse Button */}
                              {hasDetails && (
                                <button
                                  onClick={() => toggleExpanded(updateKey)}
                                  className="ml-3 p-2 rounded-lg hover:bg-gray-700/30 transition-colors flex-shrink-0 group"
                                  title={isExpanded ? "Collapse details" : "Expand details"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Expanded Details */}
                            {hasDetails && isExpanded && (
                              <div className="mt-4 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                                <div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-4">
                                  <div className="space-y-4">
                                    {/* Structured Information */}
                                    <div className="space-y-3">
                                      {update.details.promptIndex && (
                                        <div className="flex items-start space-x-3">
                                          <span className="font-medium text-purple-300 text-sm min-w-0">Prompt:</span>
                                          <span className="text-white text-sm">{update.details.promptIndex}/{update.details.totalPrompts}</span>
                                        </div>
                                      )}
                                      {update.details.failedPrompt && (
                                        <div className="space-y-2">
                                          <span className="font-medium text-red-300 text-sm">Failed Prompt:</span>
                                          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 font-mono text-xs break-all text-red-200">
                                            {update.details.failedPrompt}
                                          </div>
                                        </div>
                                      )}
                                      {update.details.error && (
                                        <div className="space-y-2">
                                          <span className="font-medium text-red-300 text-sm">Error Message:</span>
                                          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-200 text-sm">
                                            {update.details.error}
                                          </div>
                                        </div>
                                      )}
                                      {update.details.errorType && (
                                        <div className="flex items-center space-x-3">
                                          <span className="font-medium text-orange-300 text-sm">Error Type:</span>
                                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                            update.details.errorType === 'midjourney_timeout' 
                                              ? 'bg-orange-500/20 text-orange-200' 
                                              : 'bg-orange-500/20 text-orange-200'
                                          }`}>
                                            {update.details.errorType}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* Timeout-specific details */}
                                      {update.details.timeoutDuration && (
                                        <div className="flex items-start space-x-3">
                                          <span className="font-medium text-orange-300 text-sm min-w-0">Timeout Duration:</span>
                                          <span className="text-orange-200 text-sm">{update.details.timeoutDuration}</span>
                                        </div>
                                      )}
                                      
                                      {update.details.recoveryInstructions && (
                                        <div className="space-y-2">
                                          <span className="font-medium text-yellow-300 text-sm">Recovery Instructions:</span>
                                          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                            <div className="flex items-start space-x-2">
                                              <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                              <div className="text-yellow-200 text-sm leading-relaxed">
                                                {update.details.recoveryInstructions}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Other details */}
                                      {Object.entries(update.details)
                                        .filter(([key]) => !['promptIndex', 'totalPrompts', 'failedPrompt', 'error', 'errorType', 'timeoutDuration', 'recoveryInstructions'].includes(key))
                                        .map(([key, value]) => (
                                          <div key={key} className="flex items-start space-x-3">
                                            <span className="font-medium text-gray-300 capitalize text-sm min-w-0">
                                              {key.replace(/([A-Z])/g, ' $1')}:
                                            </span>
                                            <span className="text-gray-400 text-sm break-all">{JSON.stringify(value)}</span>
                                          </div>
                                        ))}
                                    </div>
                                    
                                    {/* Raw JSON Object */}
                                    <div className="pt-4 border-t border-gray-700/30">
                                      <div className="space-y-2">
                                        <span className="font-medium text-blue-300 text-sm">Raw Details JSON:</span>
                                        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-600/30 font-mono text-xs overflow-x-auto">
                                          <pre className="text-gray-300 whitespace-pre-wrap break-all leading-relaxed">
                                            {JSON.stringify(update.details, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}