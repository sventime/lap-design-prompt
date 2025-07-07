"use client";

import React, { useState } from "react";
import { Shield, Eye, EyeOff, AlertCircle } from "lucide-react";

interface DiscordTokenInputProps {
  onTokenSubmit: (token: string) => void;
  onSkip: () => void;
  discordUser: {
    id: string;
    username: string;
    avatar: string;
  };
}

export default function DiscordTokenInput({
  onTokenSubmit,
  onSkip,
  discordUser,
}: DiscordTokenInputProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError("Token cannot be empty");
      return;
    }
    
    // Store token in localStorage
    localStorage.setItem("discordUserToken", token);
    
    // Submit the token
    onTokenSubmit(token);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault(); // Prevent default paste behavior
    const pastedText = e.clipboardData.getData("text");
    setToken(pastedText.trim());
    setError("");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="glass rounded-3xl border border-gray-700/50 p-8 max-w-lg mx-auto">
        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center justify-center space-x-3">
            <img
              src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`}
              alt={discordUser.username}
              className="w-12 h-12 rounded-full"
            />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">
                Welcome, {discordUser.username}!
              </h3>
              <p className="text-sm text-gray-400">
                Manual Discord Token Setup
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Enter Discord User Token
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              To use Midjourney features, please provide your Discord user token. This token will be stored securely in your browser's local storage.
            </p>
          </div>

          {/* Token Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Discord User Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setError("");
                  }}
                  onPaste={handlePaste}
                  placeholder="Paste your Discord user token here..."
                  className="w-full px-4 py-3 pr-12 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showToken ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="text-sm text-blue-300 space-y-2">
                <p className="font-medium">How to get your Discord token:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Open Discord in your web browser: <a href="https://discord.com/app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">https://discord.com/app</a></li>
                  <li>Open Developer Tools:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                      <li><strong>Windows:</strong> F12 or Ctrl+Shift+I</li>
                      <li><strong>Mac:</strong> F12 or Cmd+Option+I</li>
                    </ul>
                  </li>
                  <li>Go to the "Network" tab</li>
                  <li>Refresh the page or send a message</li>
                  <li>Look for any request to "discord.com/api"</li>
                  <li>Click on the request and find the "Authorization" header</li>
                  <li>Copy the token value (without "Bearer " prefix)</li>
                </ol>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={!token.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Shield className="w-5 h-5" />
                <span>Save Token</span>
              </button>

              <button
                type="button"
                onClick={onSkip}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Skip - Continue Without Midjourney
              </button>
            </div>
          </form>

          {/* Security Note */}
          <div className="pt-4 border-t border-gray-700/50">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              🔒 Your token is stored locally in your browser and never sent to our servers. 
              It's only used to authenticate with Discord for Midjourney features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}