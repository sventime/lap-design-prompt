"use client";

import React, { useState } from "react";
import { Wand2, Upload, Zap, Download, List } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import ProcessingProgress from "@/components/ProcessingProgress";
import ResultsModal from "@/components/ResultsModal";
import CompletedResultsModal from "@/components/CompletedResultsModal";
import { UploadedImage, formatFileSize } from "@/types";

export default function Home() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [completedImages, setCompletedImages] = useState<UploadedImage[]>([]);
  const [completedIdCounter, setCompletedIdCounter] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(
    null
  );
  const [showResults, setShowResults] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  
  // Real-time progress state
  const [progressData, setProgressData] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    status: '',
    currentItem: null as any
  });
  const [sessionId, setSessionId] = useState('');
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  

  // Setup SSE connection
  const setupSSEConnection = (sessionId: string) => {
    console.log(`[SSE] Setting up connection for session: ${sessionId}`);
    const es = new EventSource(`/api/progress?sessionId=${sessionId}`);
    
    es.onopen = () => {
      console.log('[SSE] Connection opened');
    };
    
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received message:', data);
        
        switch (data.type) {
          case 'connected':
            console.log('[SSE] Connected to progress stream');
            break;
            
          case 'batch_started':
            setProgressData({
              total: data.total,
              completed: 0,
              processing: 0,
              status: data.status,
              currentItem: null
            });
            break;
            
          case 'progress_update':
            setProgressData({
              total: data.total,
              completed: data.completed,
              processing: data.processing,
              status: data.status,
              currentItem: data.currentItem
            });
            break;
            
          case 'item_completed':
          case 'item_failed':
            setProgressData({
              total: data.total,
              completed: data.completed,
              processing: data.processing,
              status: data.status,
              currentItem: null
            });
            
            // Update individual image status
            if (data.itemResult) {
              setImages(prevImages => {
                const updatedImages = prevImages.map(img => 
                  img.id === data.itemResult.id 
                    ? { 
                        ...img, 
                        status: data.itemResult.success ? 'completed' : 'error',
                        prompt: data.itemResult.prompt,
                        midjourneyPrompts: data.itemResult.midjourneyPrompts,
                        error: data.itemResult.error
                      }
                    : img
                );
                
                // Move completed/error image to completed list immediately
                const completedImage = updatedImages.find(img => 
                  img.id === data.itemResult.id && 
                  (img.status === 'completed' || img.status === 'error')
                );
                
                if (completedImage) {
                  setCompletedImages(prev => {
                    // Check if this image is already in completed list
                    if (!prev.some(img => img.id === completedImage.id)) {
                      setCompletedIdCounter(prevCounter => prevCounter + 1);
                      return [...prev, {
                        ...completedImage,
                        completedId: completedIdCounter,
                        generatedAt: new Date(),
                      }];
                    }
                    return prev;
                  });
                  
                  // Remove from active images
                  return updatedImages.filter(img => img.id !== data.itemResult.id);
                }
                
                return updatedImages;
              });
            }
            break;
            
          case 'batch_completed':
            setProgressData({
              total: data.total,
              completed: data.completed,
              processing: 0,
              status: data.status,
              currentItem: null
            });
            break;
            
          case 'ping':
            // Keep-alive ping, do nothing
            break;
            
          default:
            console.log('[SSE] Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('[SSE] Error parsing progress data:', error);
      }
    };
    
    es.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      // Fallback: Enable basic progress tracking
      setProgressData(prev => ({
        ...prev,
        status: 'Connection error - using fallback tracking'
      }));
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

  const handleProcessAll = async () => {
    if (images.length === 0) {
      alert("Please upload some images first");
      return;
    }

    // Generate unique session ID for this batch
    const newSessionId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);


    // Setup SSE connection for real-time progress
    const es = setupSSEConnection(newSessionId);

    setIsProcessing(true);
    
    // Initialize progress data
    setProgressData({
      total: images.length,
      completed: 0,
      processing: 0,
      status: 'Starting batch processing...',
      currentItem: null
    });

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
          description: `Generate ${image.promptType} Midjourney prompts for ${clothingPartDisplay} clothing piece`,
          fileName: image.file.name,
        };
      });

      const response = await fetch("/api/process-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          items: batchItems,
          sessionId: newSessionId
        }),
      });

      if (!response.ok) {
        throw new Error("Batch processing failed");
      }

      const data = await response.json();
      
      // Wait a moment for final SSE updates to arrive
      setTimeout(() => {
        setImages(currentImages => {
          // Move any remaining completed images to persistent completed list (fallback)
          const remainingCompletedImages = currentImages.filter(
            (img) => img.status === "completed" || img.status === "error"
          );
          
          if (remainingCompletedImages.length > 0) {
            setCompletedImages((prev) => {
              // Filter out any images that are already in the completed list
              const existingIds = prev.map(img => img.id);
              const newCompletedImages = remainingCompletedImages.filter(img => !existingIds.includes(img.id));
              
              if (newCompletedImages.length > 0) {
                const imagesWithNewIds = newCompletedImages.map((img, index) => ({
                  ...img,
                  completedId: completedIdCounter + index,
                  generatedAt: new Date(),
                }));
                setCompletedIdCounter((prevCounter) => prevCounter + newCompletedImages.length);
                return [...prev, ...imagesWithNewIds];
              }
              
              return prev;
            });
          }
          
          // Return empty array to clear any remaining active images
          return [];
        });
        
        // Cleanup SSE connection
        es.close();
        setEventSource(null);
        setIsProcessing(false);
      }, 1000);

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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Wand2 className="h-8 w-8 text-indigo-400 animate-pulse-glow" />
                <div className="absolute inset-0 h-8 w-8 text-indigo-400 animate-ping opacity-20"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  3D Clothing Design Automation
                </h1>
                <div className="text-xs text-gray-400 font-medium">
                  Powered by AI
                </div>
              </div>
            </div>
            <div className="text-sm text-indigo-300 font-medium px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              Pinterest → Midjourney
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
              <div className="p-6 border-b border-emerald-700/50 bg-emerald-500/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-emerald-300">
                      Completed Results
                    </h3>
                    <p className="text-sm text-emerald-400/80 mt-1">
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
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowCompletedModal(true)}
                      className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
                    >
                      <List className="h-5 w-5" />
                      <span>View All</span>
                    </button>
                    {completedImages.some(
                      (img) => img.status === "completed"
                    ) && (
                      <button
                        onClick={downloadAllResults}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
                      >
                        <Download className="h-5 w-5" />
                        <span>Download All</span>
                      </button>
                    )}
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
                    key={`completed-${image.completedId || image.id}`}
                    className="p-6 flex items-center space-x-6 hover:bg-gray-800/20 transition-colors"
                  >
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
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="text-lg font-medium text-white">
                          #{image.completedId}
                        </div>
                        <div className="text-sm text-gray-400">
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
                      <div className="text-sm text-gray-300 truncate mb-2">
                        {image.file.name}
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-300">
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
                          {image.promptType === "outfit" ? "Outfit" : "Texture"}
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
                      {image.status === "completed" && (
                        <div className="flex items-center space-x-3">
                          <div className="h-6 w-6 text-emerald-400">
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
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 font-medium transition-all hover:scale-105 shadow-lg cursor-pointer"
                          >
                            View Results
                          </button>
                        </div>
                      )}
                      {image.status === "error" && (
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 text-red-400">
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
                          <span className="text-sm text-red-400 font-medium">
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
            <FileUpload
              onFilesUpload={setImages}
              maxFiles={30}
              disabled={isProcessing}
            />
          </div>

          {/* Action Buttons */}
          {images.length > 0 && (
            <div className="flex items-center justify-center">
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
                    ? "Generating Magic..."
                    : `Generate Prompts for ${images.length} Images`}
                </span>
              </button>
            </div>
          )}

          {/* Processing Progress */}
          <ProcessingProgress
            images={images}
            isProcessing={isProcessing}
            onViewResults={handleViewResults}
            progressData={progressData}
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
