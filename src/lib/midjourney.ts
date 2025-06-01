import { Midjourney } from "midjourney";

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is not defined in environment variables");
}

if (!process.env.DISCORD_SERVER_ID) {
  throw new Error("DISCORD_SERVER_ID is not defined in environment variables");
}

if (!process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_CHANNEL_ID is not defined in environment variables");
}

// For DM usage, use a proper server ID or null
const serverId = process.env.DISCORD_SERVER_ID === "@me" ? null : process.env.DISCORD_SERVER_ID;

export const midjourneyClient = new Midjourney({
  ServerId: serverId || "1122334455667788", // Use a dummy server ID if null
  ChannelId: process.env.DISCORD_CHANNEL_ID,
  SalaiToken: process.env.DISCORD_TOKEN,
  Debug: process.env.NODE_ENV === "development",
  Ws: true,
  HuggingFaceToken: undefined, // Explicitly set to undefined
});

export async function sendPromptToMidjourney(prompt: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`[Midjourney] Starting connection to Midjourney...`);
    console.log(`[Midjourney] Server ID: ${serverId || "DM mode"}`);
    console.log(`[Midjourney] Channel ID: ${process.env.DISCORD_CHANNEL_ID}`);
    console.log(`[Midjourney] Token present: ${!!process.env.DISCORD_TOKEN}`);
    console.log(`[Midjourney] Token length: ${process.env.DISCORD_TOKEN?.length || 0}`);
    console.log(`[Midjourney] Sending prompt: ${prompt}`);
    
    // Validate token format
    if (!process.env.DISCORD_TOKEN?.includes('.')) {
      throw new Error("Invalid Discord token format - should contain dots");
    }
    
    console.log(`[Midjourney] Connecting to Discord...`);
    
    // Add timeout to connection
    const connectPromise = midjourneyClient.Connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Connection timeout after 30 seconds")), 30000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log(`[Midjourney] Successfully connected to Discord`);
    
    console.log(`[Midjourney] Sending Imagine command...`);
    const message = await midjourneyClient.Imagine(prompt);
    
    if (!message) {
      console.error(`[Midjourney] No message returned from Imagine command`);
      throw new Error("Failed to send prompt to Midjourney - no message returned");
    }

    console.log(`[Midjourney] ✅ Prompt sent successfully!`);
    console.log(`[Midjourney] Message ID: ${message.id}`);
    console.log(`[Midjourney] Message content: ${JSON.stringify(message, null, 2)}`);
    
    return {
      success: true,
      messageId: message.id,
    };
  } catch (error) {
    console.error("[Midjourney] ❌ Error sending prompt:", error);
    console.error("[Midjourney] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Check for specific error patterns
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("Invalid URL") || errorMessage.includes("not valid JSON")) {
      console.error("[Midjourney] This appears to be an authentication/configuration issue");
      console.error("[Midjourney] Check your Discord token and permissions");
    }
    
    console.error("[Midjourney] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: errorMessage,
      code: (error as any)?.code,
      status: (error as any)?.status,
    });
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendMultiplePromptsToMidjourney(prompts: string[]): Promise<{
  success: boolean;
  results: Array<{ prompt: string; messageId?: string; error?: string }>;
}> {
  try {
    await midjourneyClient.Connect();
    
    const results = [];
    
    for (const prompt of prompts) {
      try {
        console.log(`[Midjourney] Sending prompt: ${prompt}`);
        
        const message = await midjourneyClient.Imagine(prompt);
        
        if (message) {
          results.push({
            prompt,
            messageId: message.id,
          });
          console.log(`[Midjourney] Prompt sent successfully. Message ID: ${message.id}`);
        } else {
          results.push({
            prompt,
            error: "Failed to send prompt",
          });
        }
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`[Midjourney] Error sending prompt "${prompt}":`, error);
        results.push({
          prompt,
          error: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }
    
    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("[Midjourney] Error connecting to Midjourney:", error);
    return {
      success: false,
      results: prompts.map(prompt => ({
        prompt,
        error: error instanceof Error ? error.message : "Connection error",
      })),
    };
  }
}