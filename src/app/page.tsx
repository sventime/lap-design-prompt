"use client";

import React, { useState, useEffect } from "react";
import { Wand2, Upload, Zap, Download, List } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import ProcessingProgress from "@/components/ProcessingProgress";
import ResultsModal from "@/components/ResultsModal";
import CompletedResultsModal from "@/components/CompletedResultsModal";
import { UploadedImage, formatFileSize } from "@/types";
import { getVersionDisplay } from "@/lib/version";
import { sessionStorageManager } from "@/lib/sessionStorage";

export default function Home() {
  const { version, buildTime } = getVersionDisplay();
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(
    null
  );
  const [showResults, setShowResults] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [sendToMidjourney, setSendToMidjourney] = useState(true);

  // Initialize state from session storage or defaults
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [completedImages, setCompletedImages] = useState<UploadedImage[]>([]);
  const [completedIdCounter, setCompletedIdCounter] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAborted, setProcessingAborted] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [progressData, setProgressData] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    status: "",
    currentItem: null as any,
    midjourneyProgress: undefined as any,
  });
  const [serverUpdates, setServerUpdates] = useState<Array<{
    timestamp: number;
    type: string;
    message: string;
    details?: any;
  }>>([]);

  // Restore state from session storage on mount
  useEffect(() => {
    const restoredState = sessionStorageManager.restoreState();
    setImages(restoredState.images);
    setCompletedImages(restoredState.completedImages);
    setCompletedIdCounter(restoredState.completedIdCounter);
    setIsProcessing(restoredState.isProcessing);
    setProcessingAborted(restoredState.processingAborted);
    setIsStopping(restoredState.isStopping);
    setSessionId(restoredState.sessionId);
    setProgressData(restoredState.progressData);
    setServerUpdates(restoredState.serverUpdates);

    // If we were processing when the page was reloaded, try to reconnect to SSE
    if (restoredState.isProcessing && restoredState.sessionId) {
      console.log('[SESSION] Restored processing session, reconnecting to SSE:', restoredState.sessionId);
      setupSSEConnection(restoredState.sessionId);
    }
  }, []);

  // Save state to session storage whenever important state changes
  useEffect(() => {
    sessionStorageManager.saveProcessingState(
      images,
      isProcessing,
      sessionId,
      progressData,
      serverUpdates,
      processingAborted,
      isStopping
    );
  }, [images, isProcessing, sessionId, progressData, serverUpdates, processingAborted, isStopping]);

  // Save completed results separately
  useEffect(() => {
    sessionStorageManager.saveCompletedResults(completedImages, completedIdCounter);
  }, [completedImages, completedIdCounter]);

  // Cleanup session storage and event source on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  // Setup SSE connection
  const setupSSEConnection = (sessionId: string) => {
    console.log(`[SSE] Setting up connection for session: ${sessionId}`);
    const es = new EventSource(`/api/progress?sessionId=${sessionId}`);

    es.onopen = () => {
      console.log("[SSE] Connection opened successfully");
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Received message:", data);

        // Add all server updates to the log (except pings)
        if (data.type !== 'ping' && data.type !== 'connected') {
          setServerUpdates(prev => [...prev, {
            timestamp: data.timestamp || Date.now(),
            type: data.type,
            message: data.status || `${data.type.replace('_', ' ')} event`,
            details: data.midjourneyProgress || data.currentItem
          }]);
        }

        switch (data.type) {
          case "connected":
            console.log("[SSE] Connected to progress stream");
            break;

          case "batch_started":
            setProgressData({
              total: data.total,
              completed: 0,
              processing: 0,
              status: data.status,
              currentItem: null,
            });
            break;

          case "progress_update":
          case "midjourney_progress":
            console.log("[SSE] Progress update:", {
              total: data.total,
              completed: data.completed,
              processing: data.processing,
              status: data.status,
              midjourneyProgress: data.midjourneyProgress,
            });
            setProgressData({
              total: data.total,
              completed: data.completed,
              processing: data.processing,
              status: data.status,
              currentItem: data.currentItem,
              midjourneyProgress: data.midjourneyProgress,
            });
            break;

          case "item_completed":
          case "item_failed":
            console.log("[SSE] Item completed/failed:", {
              type: data.type,
              total: data.total,
              completed: data.completed,
              processing: data.processing,
              itemId: data.itemResult?.id,
            });
            setProgressData({
              total: data.total,
              completed: data.completed,
              processing: data.processing,
              status: data.status,
              currentItem: null,
              midjourneyProgress: undefined,
            });

            // Update individual image status
            if (data.itemResult) {
              setImages((prevImages) => {
                const updatedImages = prevImages.map((img) =>
                  img.id === data.itemResult.id
                    ? {
                        ...img,
                        status: data.itemResult.success ? "completed" : "error",
                        prompt: data.itemResult.prompt,
                        midjourneyPrompts: data.itemResult.midjourneyPrompts,
                        outfitNames: data.itemResult.outfitNames,
                        error: data.itemResult.error,
                        // Update preview with CDN link if provided by server
                        preview: data.itemResult.cdnImageUrl || img.preview,
                      }
                    : img
                );

                // Move completed/error image to completed list immediately
                const completedImage = updatedImages.find(
                  (img) =>
                    img.id === data.itemResult.id &&
                    (img.status === "completed" || img.status === "error")
                );

                if (completedImage) {
                  console.log(
                    "[SSE] Adding completed image to results:",
                    completedImage.id
                  );
                  setCompletedImages((prev) => {
                    // Check if this specific item result was already processed in this session
                    const itemResultId = `${data.itemResult.id}_${
                      data.itemResult.success ? "success" : "error"
                    }_${sessionId}`;
                    const alreadyExists = prev.some((img) =>
                      img.processingId?.includes(itemResultId)
                    );

                    if (alreadyExists) {
                      console.log(
                        "[SSE] Duplicate item result detected, skipping:",
                        itemResultId
                      );
                      return prev;
                    }

                    // Always add as new record - each processing should create separate entry
                    const newCompletedId = prev.length + 1;
                    setCompletedIdCounter(newCompletedId);

                    const newCompletedImage = {
                      ...completedImage,
                      completedId: newCompletedId,
                      generatedAt: new Date(),
                      processingId: itemResultId, // Use the consistent ID to prevent duplicates
                    };

                    console.log(
                      "[SSE] Created completed image with ID:",
                      newCompletedImage.completedId,
                      "processingId:",
                      newCompletedImage.processingId
                    );

                    return [...prev, newCompletedImage];
                  });

                  // Remove from active images
                  return updatedImages.filter(
                    (img) => img.id !== data.itemResult.id
                  );
                }

                return updatedImages;
              });
            }
            break;

          case "batch_completed":
          case "batch_aborted":
            console.log(`[SSE] Batch ${data.type === 'batch_aborted' ? 'aborted' : 'completed'} - cleaning up`);
            setProgressData({
              total: data.total,
              completed: data.completed,
              processing: 0,
              status: data.status,
              currentItem: null,
              midjourneyProgress: undefined,
            });

            // Mark processing as complete
            setIsProcessing(false);
            
            // Reset abort and stopping flags
            setProcessingAborted(false);
            setIsStopping(false);

            // Clean up SSE connection after a brief delay
            setTimeout(() => {
              es.close();
              setEventSource(null);
            }, 1000);

            // Clear processing session data (keep completed results)
            setTimeout(() => {
              const currentCompleted = sessionStorageManager.load()?.completedImages || [];
              const currentCounter = sessionStorageManager.load()?.completedIdCounter || 1;
              sessionStorageManager.clear();
              // Restore only completed data
              sessionStorageManager.saveCompletedResults(currentCompleted, currentCounter);
            }, 2000);

            // Smooth scroll to top when all images are processed
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
            break;

          case "ping":
            // Keep-alive ping, do nothing
            break;

          default:
            console.log("[SSE] Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("[SSE] Error parsing progress data:", error);
      }
    };

    es.onerror = (error) => {
      console.error("[SSE] Connection error:", error);
      console.log("[SSE] EventSource readyState:", es.readyState);
      // Fallback: Enable basic progress tracking
      setProgressData((prev) => ({
        ...prev,
        status: "Connection error - using fallback tracking",
      }));
      // Don't close the connection here, let it retry
    };

    setEventSource(es);
    return es;
  };

  // Cleanup SSE connection
  const cleanupSSEConnection = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
  };

  // Stop processing function
  const handleStopProcessing = () => {
    console.log("[STOP] User requested to stop processing");
    setIsStopping(true);
    setProcessingAborted(true);
    
    // Send abort signal to server
    if (sessionId) {
      fetch('/api/abort-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }).catch(err => console.warn('[STOP] Failed to notify server:', err));
    }
    
    // Update progress to show stopping status
    setProgressData(prev => ({
      ...prev,
      status: "Stopping processing... Waiting for current Discord image generation to complete",
      midjourneyProgress: prev.midjourneyProgress ? {
        ...prev.midjourneyProgress,
        status: "Stopping after current prompt completes..."
      } : undefined
    }));
    
    // Add stop message to server updates
    setServerUpdates(prev => [...prev, {
      timestamp: Date.now(),
      type: 'processing_stopping',
      message: 'Stop requested - waiting for current Discord image generation to complete',
      details: { sessionId }
    }]);
  };

  const handleProcessAll = async () => {
    if (images.length === 0) {
      alert("Please upload some images first");
      return;
    }

    // Reset abort and stopping flags
    setProcessingAborted(false);
    setIsStopping(false);

    // Generate unique session ID for this batch
    const newSessionId = `batch_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    setSessionId(newSessionId);

    // Clean up any existing SSE connection before starting new one
    cleanupSSEConnection();

    // Setup SSE connection for real-time progress
    const es = setupSSEConnection(newSessionId);

    setIsProcessing(true);

    // Wait a moment for SSE connection to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Initialize progress data
    setProgressData({
      total: images.length,
      completed: 0,
      processing: 0,
      status: `Starting batch processing${sendToMidjourney ? ' with Midjourney' : ' (prompts only)'}...`,
      currentItem: null,
      midjourneyProgress: undefined,
    });
    
    // Clear previous server updates
    setServerUpdates([]);

    // Update all images to pending status initially
    const pendingImages = images.map((img) => ({
      ...img,
      status: "pending" as const,
    }));
    setImages(pendingImages);

    try {
      // Prepare batch items
      const batchItems = images.map((image) => {
        const clothingPartDisplay =
          image.clothingPart === "other" && image.customClothingPart
            ? image.customClothingPart
            : image.clothingPart;

        return {
          id: image.id,
          imageBase64: image.preview,
          clothingPart: image.clothingPart,
          customClothingPart: image.customClothingPart,
          promptType: image.promptType,
          genderType: image.genderType,
          guidance: image.guidance,
          description: `Generate ${image.promptType} Midjourney prompts for ${clothingPartDisplay} clothing piece`,
          fileName: image.file.name,
        };
      });

      console.log(
        "[PROCESSING] Starting batch processing with sessionId:",
        newSessionId
      );
      console.log("[PROCESSING] Batch items count:", batchItems.length);

      const response = await fetch("/api/process-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: batchItems,
          sessionId: newSessionId,
          sendToMidjourney: sendToMidjourney,
        }),
      });

      console.log("[PROCESSING] Batch response status:", response.status);

      if (!response.ok) {
        throw new Error("Batch processing failed");
      }

      const data = await response.json();

      console.log(
        "[PROCESSING] Batch HTTP request completed, waiting for SSE batch_completed message..."
      );
    } catch (error) {
      console.error("Processing error:", error);
      alert("Processing failed. Please try again.");

      // Reset status to pending on error
      const resetImages = images.map((img) => ({
        ...img,
        status: "pending" as const,
      }));
      setImages(resetImages);

      // Cleanup SSE connection on error
      es.close();
      setEventSource(null);
      setIsProcessing(false);
    }
  };

  const handleViewResults = (image: UploadedImage) => {
    setSelectedImage(image);
    setShowResults(true);
  };

  const downloadAllResults = () => {
    const successfulImages = completedImages.filter(
      (img) => img.status === "completed" && img.midjourneyPrompts
    );

    if (successfulImages.length === 0) {
      alert("No completed results to download");
      return;
    }

    const content = successfulImages
      .map((image) => {
        const header = `\n=== ${image.file.name} (${image.clothingPart}) ===\n`;
        const prompts = image.midjourneyPrompts?.join("\n\n") || "";
        return header + prompts;
      })
      .join("\n\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `midjourney-prompts-batch-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearSessionData = () => {
    if (confirm("Are you sure you want to clear all session data? This will remove all completed results and processing history.")) {
      sessionStorageManager.clear();
      setImages([]);
      setCompletedImages([]);
      setCompletedIdCounter(1);
      setIsProcessing(false);
      setProcessingAborted(false);
      setIsStopping(false);
      setSessionId("");
      setProgressData({
        total: 0,
        completed: 0,
        processing: 0,
        status: "",
        currentItem: null,
        midjourneyProgress: undefined,
      });
      setServerUpdates([]);
      console.log("[SESSION] All session data cleared");
    }
  };

  const clearProcessingData = () => {
    if (confirm("Clear stuck processing data? This will remove current processing images and progress but keep your completed results.")) {
      // Clear processing data from session storage
      sessionStorageManager.clearProcessingData();
      
      // Reset processing state
      setImages([]);
      setIsProcessing(false);
      setProcessingAborted(false);
      setIsStopping(false);
      setSessionId("");
      setProgressData({
        total: 0,
        completed: 0,
        processing: 0,
        status: "",
        currentItem: null,
        midjourneyProgress: undefined,
      });
      setServerUpdates([]);
      
      // Close any existing SSE connections
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      
      console.log("[SESSION] Processing data cleared, completed results preserved");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Header */}
      <header className="relative glass border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <Wand2 className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-400 animate-pulse-glow" />
                <div className="absolute inset-0 h-6 w-6 sm:h-8 sm:w-8 text-indigo-400 animate-ping opacity-20"></div>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg md:text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent truncate">
                  3D Clothing Design Automation
                </h1>
                <div className="hidden sm:flex items-center space-x-2 md:space-x-3 text-xs text-gray-400 font-medium">
                  <span>Powered by AI</span>
                  <span>•</span>
                  <span>v{version}</span>
                  <span>•</span>
                  <span className="hidden md:inline">{buildTime}</span>
                </div>
                {/* Mobile version info */}
                <div className="sm:hidden text-xs text-gray-400 font-medium truncate">
                  AI Powered • v{version}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 flex-shrink-0 ml-2 sm:ml-4">
              <div className="text-xs sm:text-sm text-indigo-300 font-medium px-2 sm:px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <span className="hidden sm:inline">Pinterest → AI</span>
                <span className="sm:hidden">AI</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <h2 className="text-4xl leading-[2] md:text-5xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
                Automate Your Fashion Design Process
              </h2>
              <div className="h-1 w-32 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Upload Pinterest images, select clothing parts, and get 3 detailed
              Midjourney prompts for each design. Perfect for 3D clothing
              visualization and fashion prototyping.
            </p>
          </div>

          {/* Completed Results Section */}
          {completedImages.length > 0 && (
            <div className="glass rounded-2xl border border-emerald-700/50 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-emerald-700/50 bg-emerald-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-bold text-emerald-300">
                      Completed Results
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-400/80 mt-1">
                      {
                        completedImages.filter(
                          (img) => img.status === "completed"
                        ).length
                      }{" "}
                      successful •{" "}
                      {
                        completedImages.filter((img) => img.status === "error")
                          .length
                      }{" "}
                      failed
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <button
                      onClick={() => setShowCompletedModal(true)}
                      className="flex items-center space-x-2 px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer text-sm sm:text-base"
                    >
                      <List className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="hidden sm:inline">View All</span>
                      <span className="sm:hidden">All</span>
                    </button>
                    {completedImages.some(
                      (img) => img.status === "completed"
                    ) && (
                      <button
                        onClick={downloadAllResults}
                        className="flex items-center space-x-2 px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer text-sm sm:text-base"
                      >
                        <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Download All</span>
                        <span className="sm:hidden">Download</span>
                      </button>
                    )}
                    <button
                      onClick={clearSessionData}
                      className="flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-400 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer text-sm sm:text-base"
                      title="Clear all session data including completed results"
                    >
                      <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-700/30 max-h-96 overflow-y-auto">
                {completedImages
                  .sort((a, b) => {
                    const aId = a.completedId || 0;
                    const bId = b.completedId || 0;
                    return bId - aId;
                  })
                  .map((image) => (
                    <div
                      key={`completed-${
                        image.processingId || image.completedId || image.id
                      }`}
                      className="p-4 sm:p-6 flex items-center space-x-3 sm:space-x-6 hover:bg-gray-800/20 transition-colors"
                    >
                      {/* Image Thumbnail */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={image.preview}
                          alt={image.file.name}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-gray-700/50"
                        />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                      </div>

                      {/* Image Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-1">
                          <div className="text-sm sm:text-lg font-medium text-white">
                            #{image.completedId}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            {image.generatedAt
                              ? image.generatedAt.toLocaleDateString() +
                                " " +
                                image.generatedAt.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-300 truncate mb-2">
                          {image.file.name}
                        </div>
                        {image.genderType && (
                          <div className="text-xs text-gray-400 mb-1">
                            {image.genderType} • {image.promptType}
                            {image.guidance && ` • "${image.guidance}"`}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs sm:text-sm text-gray-300">
                            {image.clothingPart === "other" &&
                            image.customClothingPart
                              ? image.customClothingPart
                              : image.clothingPart}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              image.promptType === "outfit"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            }`}
                          >
                            {image.promptType === "outfit"
                              ? "Outfit"
                              : "Texture"}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-300">
                            {formatFileSize(image.fileSize || image.file?.size)}
                          </span>
                        </div>
                        {image.error && (
                          <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                            {image.error}
                          </div>
                        )}
                      </div>

                      {/* Status Icon */}
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                        {image.status === "completed" && (
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400">
                              <svg
                                className="w-full h-full"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <button
                              onClick={() => handleViewResults(image)}
                              className="px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer text-xs sm:text-sm"
                            >
                              <span className="hidden sm:inline">View Results</span>
                              <span className="sm:hidden">View</span>
                            </button>
                          </div>
                        )}
                        {image.status === "error" && (
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <div className="h-5 w-5 sm:h-6 sm:w-6 text-red-400">
                              <svg
                                className="w-full h-full"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <span className="text-xs sm:text-sm text-red-400 font-medium hidden sm:inline">
                              Failed
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <div className="glass rounded-2xl border border-gray-700/50 p-8">
            <FileUpload onFilesUpload={setImages} disabled={isProcessing} />
          </div>

          {/* Action Buttons */}
          {images.length > 0 && (
            <div className="space-y-4">
              {/* Processing Mode Toggle */}
              <div className="flex items-center justify-center">
                <div className="glass rounded-xl px-6 py-4 border border-gray-700/50">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-300 font-medium">
                      Processing Mode:
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <button
                          onClick={() => setSendToMidjourney(!sendToMidjourney)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            sendToMidjourney ? 'bg-indigo-600' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              sendToMidjourney ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="text-sm text-gray-300 font-medium min-w-[120px]">
                        {sendToMidjourney ? 'Send to Midjourney' : 'Prompts Only'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 text-center">
                    {sendToMidjourney 
                      ? 'Generate prompts and automatically send to Midjourney' 
                      : 'Generate prompts only (no Midjourney sending)'}
                  </div>
                </div>
              </div>
              
              {/* Generate Button */}
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={handleProcessAll}
                  disabled={isProcessing || images.length === 0}
                  className="group btn-premium flex items-center space-x-3 px-8 py-4 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl cursor-pointer"
                >
                  <Wand2
                    className={`h-6 w-6 ${
                      isProcessing ? "animate-spin" : "group-hover:rotate-12"
                    } transition-transform`}
                  />
                  <span className="text-lg">
                    {isProcessing
                      ? (sendToMidjourney ? "Generating & Sending..." : "Generating Prompts...")
                      : (sendToMidjourney 
                          ? `Generate & Send ${images.length} Images` 
                          : `Generate Prompts for ${images.length} Images`)}
                  </span>
                </button>
                
                {/* Stop Processing Button */}
                {isProcessing && (
                  <button
                    onClick={handleStopProcessing}
                    disabled={isStopping}
                    className={`group flex items-center space-x-3 px-6 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all ${
                      isStopping 
                        ? 'bg-gradient-to-r from-orange-600 to-orange-500 cursor-not-allowed opacity-75' 
                        : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:scale-105 cursor-pointer'
                    }`}
                  >
                    <div className="h-6 w-6 flex items-center justify-center">
                      {isStopping ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <div className="h-3 w-3 bg-white rounded-sm"></div>
                      )}
                    </div>
                    <span className="text-lg">
                      {isStopping ? 'Stopping...' : 'Stop Processing'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Processing Progress */}
          <ProcessingProgress
            images={images}
            isProcessing={isProcessing}
            onViewResults={handleViewResults}
            progressData={progressData}
            serverUpdates={serverUpdates}
            isStopping={isStopping}
            onClearProcessing={clearProcessingData}
          />
        </div>
      </main>

      {/* Results Modal */}
      <ResultsModal
        image={selectedImage}
        isOpen={showResults}
        onClose={() => setShowResults(false)}
      />

      {/* Completed Results Modal */}
      <CompletedResultsModal
        isOpen={showCompletedModal}
        onClose={() => setShowCompletedModal(false)}
        completedImages={completedImages}
        onViewResults={handleViewResults}
        onDownloadAll={downloadAllResults}
      />
    </div>
  );
}
