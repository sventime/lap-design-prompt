"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function DiscordCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('Discord OAuth error:', error);
        router.push('/?discord_error=' + encodeURIComponent(error));
        return;
      }

      if (!code) {
        console.error('No authorization code received');
        router.push('/?discord_error=no_code');
        return;
      }

      try {
        // Exchange code for access token
        const response = await fetch('/api/auth/discord/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error('Failed to exchange code for token');
        }

        const data = await response.json();
        
        // Store user data in localStorage
        const discordUser = {
          id: data.user.id,
          username: data.user.username,
          avatar: data.user.avatar,
          accessToken: data.access_token,
        };

        localStorage.setItem('discordUser', JSON.stringify(discordUser));

        // Redirect back to main app (removed automatic token extraction since route was deleted)
        router.push('/?discord_success=true');
      } catch (error) {
        console.error('Error during Discord OAuth:', error);
        router.push('/?discord_error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="glass rounded-3xl border border-gray-700/50 p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-white">Connecting to Discord...</p>
      </div>
    </div>
  );
}

export default function DiscordCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="glass rounded-3xl border border-gray-700/50 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <DiscordCallbackHandler />
    </Suspense>
  );
}