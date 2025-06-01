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

async function uploadImageToDiscord(imageBase64: string): Promise<string> {
  try {
    console.log(`[Discord] Uploading image to Discord using REST API...`);
    
    // Create FormData with the image
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const formData = new FormData();
    
    // Create a File-like object from buffer
    const imageFile = new File([imageBuffer], 'reference.jpg', { type: 'image/jpeg' });
    formData.append('files[0]', imageFile);
    formData.append('payload_json', JSON.stringify({
      content: "Reference image for Midjourney"
    }));
    
    // Send to Discord REST API
    const response = await fetch(
      `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': process.env.DISCORD_TOKEN,
        },
        body: formData
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const messageData = await response.json();
    
    if (!messageData.attachments || messageData.attachments.length === 0) {
      throw new Error("No attachments found in Discord message response");
    }
    
    const discordImageUrl = messageData.attachments[0].url;
    console.log(`[Discord] Image uploaded successfully: ${discordImageUrl}`);
    
    // Optionally delete the message after getting the URL
    setTimeout(async () => {
      try {
        const deleteResponse = await fetch(
          `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages/${messageData.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': process.env.DISCORD_TOKEN,
            }
          }
        );
        
        if (deleteResponse.ok) {
          console.log(`[Discord] Cleanup: Deleted temporary message`);
        } else {
          console.warn(`[Discord] Could not delete temporary message: ${deleteResponse.status}`);
        }
      } catch (deleteError) {
        console.warn(`[Discord] Could not delete temporary message:`, deleteError);
      }
    }, 5000); // Delete after 5 seconds
    
    return discordImageUrl;
  } catch (error) {
    console.error("[Discord] Error uploading image:", error);
    throw error;
  }
}

export async function sendPromptToMidjourney(
  prompt: string, 
  imageBase64?: string, 
  onProgress?: (status: string) => void
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
    console.log(`[Midjourney] Image base64 provided: ${!!imageBase64}`);
    
    let finalPrompt = prompt;
    
    // Upload image to Discord first if provided
    if (imageBase64) {
      try {
        onProgress?.("Uploading reference image to Discord...");
        console.log(`[Midjourney] Uploading image to Discord first...`);
        const discordImageUrl = await uploadImageToDiscord(imageBase64);
        finalPrompt = `${discordImageUrl} ${prompt}`;
        console.log(`[Midjourney] Final prompt with Discord image: ${finalPrompt}`);
      } catch (uploadError) {
        console.warn(`[Midjourney] Failed to upload image to Discord, proceeding without image:`, uploadError);
      }
    }
    
    onProgress?.("Sending prompt to Midjourney...");
    console.log(`[Midjourney] Sending prompt: ${finalPrompt}`);
    const message = await midjourneyClient.Imagine(finalPrompt);
    
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

export async function sendMultiplePromptsToMidjourney(
  prompts: string[], 
  imageBase64?: string, 
  onProgress?: (promptIndex: number, total: number, status: string) => void
): Promise<{
  success: boolean;
  results: Array<{ prompt: string; messageId?: string; error?: string }>;
}> {
  try {
    await midjourneyClient.Connect();
    
    const results = [];
    
    // Upload image to Discord once for all prompts if provided
    let discordImageUrl: string | null = null;
    if (imageBase64) {
      try {
        onProgress?.(0, prompts.length, "Uploading reference image to Discord...");
        console.log(`[Midjourney] Uploading image to Discord for batch processing...`);
        discordImageUrl = await uploadImageToDiscord(imageBase64);
        console.log(`[Midjourney] Image uploaded for batch: ${discordImageUrl}`);
      } catch (uploadError) {
        console.warn(`[Midjourney] Failed to upload image to Discord for batch, proceeding without image:`, uploadError);
      }
    }
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      try {
        onProgress?.(i + 1, prompts.length, `Processing prompt ${i + 1}/${prompts.length}...`);
        console.log(`[Midjourney] Sending prompt ${i + 1}/${prompts.length}: ${prompt}`);
        console.log(`[Midjourney] Discord image URL available: ${!!discordImageUrl}`);
        
        let finalPrompt = prompt;
        if (discordImageUrl) {
          finalPrompt = `${discordImageUrl} ${prompt}`;
          console.log(`[Midjourney] Final prompt with Discord image: ${finalPrompt}`);
        }
        
        const message = await midjourneyClient.Imagine(finalPrompt);
        
        if (message) {
          results.push({
            prompt,
            messageId: message.id,
          });
          onProgress?.(i + 1, prompts.length, `Prompt ${i + 1}/${prompts.length} sent successfully`);
          console.log(`[Midjourney] Prompt ${i + 1}/${prompts.length} sent successfully. Message ID: ${message.id}`);
        } else {
          results.push({
            prompt,
            error: "Failed to send prompt",
          });
          onProgress?.(i + 1, prompts.length, `Prompt ${i + 1}/${prompts.length} failed`);
        }
        
        // Add delay between requests to avoid rate limiting
        if (i < prompts.length - 1) {
          onProgress?.(i + 1, prompts.length, `Waiting before next prompt... (${i + 2}/${prompts.length})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`[Midjourney] Error sending prompt "${prompt}":`, error);
        onProgress?.(i + 1, prompts.length, `Prompt ${i + 1}/${prompts.length} failed with error`);
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