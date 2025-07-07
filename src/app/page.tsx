"use client";

import React, { useState, useEffect } from "react";
import { Wand2, Upload, Zap, Download, List } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import ProcessingProgress from "@/components/ProcessingProgress";
import ResultsModal from "@/components/ResultsModal";
import CompletedResultsModal from "@/components/CompletedResultsModal";
import DiscordTokenInput from "@/components/DiscordTokenInput";
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
  const [fastMode, setFastMode] = useState(false);
  const [discordUser, setDiscordUser] = useState<{
    id: string;
    username: string;
    avatar: string;
    accessToken: string;
  } | null>(null);
  const [userToken, setUserToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

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
  const [serverUpdates, setServerUpdates] = useState<
    Array<{
      timestamp: number;
      type: string;
      message: string;
      details?: any;
    }>
  >([]);

  // Restore Discord user from localStorage and state from session storage on mount
  useEffect(() => {
    const storedDiscordUser = localStorage.getItem("discordUser");
    const storedUserToken = localStorage.getItem("discordUserToken");
    
    if (storedDiscordUser) {
      try {
        setDiscordUser(JSON.parse(storedDiscordUser));
      } catch (error) {
        console.error("Error parsing stored Discord user:", error);
        localStorage.removeItem("discordUser");
      }
    }
    
    if (storedUserToken) {
      setUserToken(storedUserToken);
      console.log("Found stored Discord user token");
    } else if (storedDiscordUser) {
      // If user is already logged in but no token stored, show token input
      setShowTokenInput(true);
    }

    // Handle Discord OAuth success/error from callback
    const urlParams = new URLSearchParams(window.location.search);
    const discordSuccess = urlParams.get("discord_success");
    const discordError = urlParams.get("discord_error");

    if (discordSuccess) {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // User data should already be in localStorage from callback
      const freshUser = localStorage.getItem("discordUser");
      if (freshUser) {
        setDiscordUser(JSON.parse(freshUser));
        // Always show token input after fresh login unless token already exists
        const storedToken = localStorage.getItem("discordUserToken");
        if (!storedToken) {
          setShowTokenInput(true);
        }
      }
    }

    if (discordError) {
      console.error("Discord OAuth error:", discordError);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Show error to user if needed
    }

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
      console.log(
        "[SESSION] Restored processing session, reconnecting to SSE:",
        restoredState.sessionId
      );
      setupSSEConnection(restoredState.sessionId);
    }
  }, []);

  // Discord OAuth functions
  const handleDiscordLogin = () => {
    const clientId =
      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1234567890123456789";
    const redirectUri = encodeURIComponent(
      window.location.origin + "/auth/discord/callback"
    );
    const scope = encodeURIComponent("identify");

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.href = discordAuthUrl;
  };

  const handleDiscordLogout = () => {
    localStorage.removeItem("discordUser");
    localStorage.removeItem("discordUserToken");
    setDiscordUser(null);
    setUserToken("");
    setShowTokenInput(false);
  };

  const handleTokenSubmit = (token: string) => {
    setUserToken(token);
    setShowTokenInput(false);
    console.log("Discord user token saved and ready");
  };

  const handleSkipToken = () => {
    setUserToken("disabled");
    setShowTokenInput(false);
  };

  const handleRequestToken = () => {
    setShowTokenInput(true);
  };

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
  }, [
    images,
    isProcessing,
    sessionId,
    progressData,
    serverUpdates,
    processingAborted,
    isStopping,
  ]);

  // Save completed results separately
  useEffect(() => {
    sessionStorageManager.saveCompletedResults(
      completedImages,
      completedIdCounter
    );
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
        if (data.type !== "ping" && data.type !== "connected") {
          setServerUpdates((prev) => [
            ...prev,
            {
              timestamp: data.timestamp || Date.now(),
              type: data.type,
              message: data.status || `${data.type.replace("_", " ")} event`,
              details: data.midjourneyProgress || data.currentItem,
            },
          ]);
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

          case "openai_processing_complete":
            console.log("[SSE] OpenAI processing complete:", data);
            // Immediately move image to completed results when OpenAI finishes
            if (data.details && data.details.id) {
              setImages((prevImages) => {
                const targetImage = prevImages.find(img => img.id === data.details.id);
                if (!targetImage) return prevImages;

                const updatedImage = {
                  ...targetImage,
                  status: "completed" as const,
                  prompt: data.details.prompt,
                  midjourneyPrompts: data.details.midjourneyPrompts,
                  outfitNames: data.details.outfitNames,
                };

                console.log("[SSE] Moving image to completed results after OpenAI:", updatedImage.id);
                
                // Add to completed results immediately
                setCompletedImages((prev) => {
                  const itemResultId = `${data.details.id}_openai_complete_${sessionId}`;
                  const alreadyExists = prev.some((img) =>
                    img.processingId?.includes(itemResultId)
                  );

                  if (alreadyExists) {
                    console.log("[SSE] OpenAI result already exists, skipping:", itemResultId);
                    return prev;
                  }

                  const newCompletedId = prev.length + 1;
                  setCompletedIdCounter(newCompletedId);

                  const newCompletedImage = {
                    ...updatedImage,
                    completedId: newCompletedId,
                    generatedAt: new Date(),
                    processingId: itemResultId,
                  };

                  console.log("[SSE] Added OpenAI completed image:", newCompletedImage.completedId);
                  return [...prev, newCompletedImage];
                });

                // Remove from active processing images
                return prevImages.filter(img => img.id !== data.details.id);
              });
            }
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

            // Update completed images if they already exist from OpenAI phase, or handle failures
            if (data.itemResult) {
              // Check if image was already moved to completed results during OpenAI processing
              setCompletedImages((prev) => {
                const existingOpenAIResult = prev.find((img) =>
                  img.processingId?.includes(`${data.itemResult.id}_openai_complete_${sessionId}`)
                );

                if (existingOpenAIResult && data.itemResult.success) {
                  // Update the existing OpenAI result with Midjourney completion data
                  console.log("[SSE] Updating existing OpenAI result with Midjourney data:", data.itemResult.id);
                  return prev.map((img) =>
                    img.processingId?.includes(`${data.itemResult.id}_openai_complete_${sessionId}`)
                      ? {
                          ...img,
                          preview: data.itemResult.cdnImageUrl || img.preview, // Update with CDN link if available
                        }
                      : img
                  );
                } else if (!data.itemResult.success) {
                  // Handle failures - add to completed results as error
                  const itemResultId = `${data.itemResult.id}_error_${sessionId}`;
                  const alreadyExists = prev.some((img) =>
                    img.processingId?.includes(itemResultId)
                  );

                  if (!alreadyExists) {
                    const newCompletedId = prev.length + 1;
                    setCompletedIdCounter(newCompletedId);

                    const errorImage = {
                      id: data.itemResult.id,
                      status: "error" as const,
                      error: data.itemResult.error,
                      completedId: newCompletedId,
                      generatedAt: new Date(),
                      processingId: itemResultId,
                      file: { name: `Error: ${data.itemResult.id}` } as File,
                      preview: "",
                      clothingPart: "unknown",
                      promptType: "unknown" as const,
                      genderType: "unisex" as const,
                    };

                    console.log("[SSE] Added error result to completed:", errorImage);
                    return [...prev, errorImage];
                  }
                }

                return prev;
              });

              // Remove any remaining images from active processing
              setImages((prevImages) => 
                prevImages.filter(img => img.id !== data.itemResult.id)
              );
            }
            break;

          case "batch_completed":
          case "batch_aborted":
            console.log(
              `[SSE] Batch ${
                data.type === "batch_aborted" ? "aborted" : "completed"
              } - cleaning up`
            );
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
              const currentCompleted =
                sessionStorageManager.load()?.completedImages || [];
              const currentCounter =
                sessionStorageManager.load()?.completedIdCounter || 1;
              sessionStorageManager.clear();
              // Restore only completed data
              sessionStorageManager.saveCompletedResults(
                currentCompleted,
                currentCounter
              );
            }, 2000);
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
      fetch("/api/abort-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch((err) => console.warn("[STOP] Failed to notify server:", err));
    }

    // Update progress to show stopping status
    setProgressData((prev) => ({
      ...prev,
      status:
        "Stopping processing... Waiting for current Discord image generation to complete",
      midjourneyProgress: prev.midjourneyProgress
        ? {
            ...prev.midjourneyProgress,
            status: "Stopping after current prompt completes...",
          }
        : undefined,
    }));

    // Add stop message to server updates
    setServerUpdates((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        type: "processing_stopping",
        message:
          "Stop requested - waiting for current Discord image generation to complete",
        details: { sessionId },
      },
    ]);
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
      status: `Starting batch processing${
        sendToMidjourney ? " with Midjourney" : " (prompts only)"
      }...`,
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
          fastMode: fastMode,
          discordCredentials: userToken && userToken !== "disabled" ? {
            discordToken: userToken,
            discordServerId: undefined,
            discordChannelId: undefined,
          } : undefined,
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
    if (
      confirm(
        "Are you sure you want to clear all session data? This will remove all completed results and processing history."
      )
    ) {
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
    if (
      confirm(
        "Clear stuck processing data? This will remove current processing images and progress but keep your completed results."
      )
    ) {
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

      console.log(
        "[SESSION] Processing data cleared, completed results preserved"
      );
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
                <div className="sm:hidden text-xs text-gray-400 font-medium truncate">
                  AI Powered • v{version}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 flex-shrink-0 ml-2 sm:ml-4">
              {discordUser && (
                <div className="flex items-center space-x-2">
                  <img
                    src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=32`}
                    alt={discordUser.username}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                  />
                  <span className="text-xs sm:text-sm text-white font-medium">
                    {discordUser.username}
                  </span>
                  {userToken === "disabled" && (
                    <button
                      onClick={handleRequestToken}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Add Token
                    </button>
                  )}
                  <button
                    onClick={handleDiscordLogout}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!discordUser ? (
          // Step 1: Discord OAuth Login Screen
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="glass rounded-3xl border border-gray-700/50 p-12 text-center max-w-md mx-auto">
              <div className="space-y-6">
                
                <div className="relative">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.211.375-.445.865-.608 1.249a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.249.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.369a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-white">Sign in with Discord</h2>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Sign in with Discord to verify your identity and access the AI fashion design automation tool.
                  </p>
                </div>
                
                <button
                  onClick={handleDiscordLogin}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.211.375-.445.865-.608 1.249a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.249.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.369a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span>Sign in with Discord</span>
                </button>
                
                <div className="pt-4 border-t border-gray-700/50">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Secure authentication via Discord OAuth. Your credentials are never stored locally.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : showTokenInput && discordUser ? (
          // Manual token input screen
          <DiscordTokenInput
            discordUser={discordUser}
            onTokenSubmit={handleTokenSubmit}
            onSkip={handleSkipToken}
          />
        ) : discordUser ? (
          // Main App UI
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

            {/* File Upload Section */}
            <div className="glass rounded-2xl border border-gray-700/50 p-8">
              <FileUpload onFilesUpload={setImages} disabled={isProcessing} />
            </div>

            {/* Action Buttons */}
            {images.length > 0 && (
              <div className="space-y-4">
                {/* Midjourney Configuration Form */}
                <div className="flex items-center justify-center">
                  <div className="glass rounded-xl px-6 py-5 border border-gray-700/50 max-w-md w-full">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        Midjourney Settings
                      </h3>
                      <p className="text-xs text-gray-400">
                        Configure your generation preferences
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Send to Midjourney Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm text-gray-300 font-medium">
                            Send to Midjourney
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            {sendToMidjourney
                              ? userToken === "disabled" 
                                ? "Generate prompts only (no Discord token)"
                                : "Generate & automatically send to Discord"
                              : "Generate prompts only (no sending)"}
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() =>
                              setSendToMidjourney(!sendToMidjourney)
                            }
                            disabled={userToken === "disabled"}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              sendToMidjourney && userToken !== "disabled" ? "bg-indigo-600" : "bg-gray-600"
                            } ${userToken === "disabled" ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                sendToMidjourney && userToken !== "disabled"
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Fast Mode Toggle */}
                      <div className="flex items-center justify-between border-t border-gray-700/30 pt-4">
                        <div className="flex-1">
                          <label className="text-sm text-gray-300 font-medium">
                            Fast Mode
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            {fastMode
                              ? "Add --fast to generated prompts"
                              : "Generate prompts without --fast flag"}
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => setFastMode(!fastMode)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                              fastMode ? "bg-purple-600" : "bg-gray-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                fastMode ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
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
                        ? sendToMidjourney
                          ? "Generating & Sending..."
                          : "Generating Prompts..."
                        : sendToMidjourney
                        ? `Generate & Send ${images.length} Images`
                        : `Generate Prompts for ${images.length} Images`}
                    </span>
                  </button>

                  {/* Stop Processing Button */}
                  {isProcessing && (
                    <button
                      onClick={handleStopProcessing}
                      disabled={isStopping}
                      className={`group flex items-center space-x-3 px-6 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all ${
                        isStopping
                          ? "bg-gradient-to-r from-orange-600 to-orange-500 cursor-not-allowed opacity-75"
                          : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:scale-105 cursor-pointer"
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
                        {isStopping ? "Stopping..." : "Stop Processing"}
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
        ) : (
          // Fallback state
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Getting Started...</h2>
              <p className="text-gray-300">Please complete Discord authentication to continue.</p>
            </div>
          </div>
        )}
      </main>

      {/* Results Modal */}
      <ResultsModal
        image={selectedImage}
        isOpen={showResults}
        onClose={() => setShowResults(false)}
      />

      {/* Floating Action Button for Completed Results */}
      {completedImages.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowCompletedModal(true)}
            className="group bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110"
            title={`View ${completedImages.length} completed results`}
          >
            <div className="flex items-center space-x-3">
              <List className="h-6 w-6" />
              <span className="text-sm font-bold">Generated Prompts</span>
              <span className="bg-white text-indigo-600 text-sm font-bold px-2 py-1 rounded-full min-w-[28px] text-center">
                {completedImages.length}
              </span>
            </div>
          </button>
        </div>
      )}

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
