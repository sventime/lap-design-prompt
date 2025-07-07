import { Midjourney } from "midjourney";

console.log(`[Midjourney Init] Environment check:`, {
  DISCORD_SERVER_ID: process.env.DISCORD_SERVER_ID || "MISSING",
  DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || "MISSING",
  NODE_ENV: process.env.NODE_ENV,
  NOTE: "Discord token will be provided via OAuth authentication",
});

if (!process.env.DISCORD_SERVER_ID) {
  throw new Error("DISCORD_SERVER_ID is not defined in environment variables");
}

if (!process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_CHANNEL_ID is not defined in environment variables");
}

// For DM usage, use a proper server ID or null
const serverId =
  process.env.DISCORD_SERVER_ID === "@me"
    ? null
    : process.env.DISCORD_SERVER_ID;

// Create default client configuration (requires user token to be provided)
const defaultClientConfig = {
  ServerId: serverId || "1122334455667788",
  ChannelId: process.env.DISCORD_CHANNEL_ID || "1122334455667788",
  SalaiToken: "dummy_token", // Will be replaced with OAuth-extracted token
  Debug: process.env.NODE_ENV === "development",
  Ws: true,
  HuggingFaceToken: undefined,
};

console.log(
  `[Midjourney Init] Default client config prepared (requires OAuth token):`,
  {
    ServerId: defaultClientConfig.ServerId,
    ChannelId: defaultClientConfig.ChannelId,
    Debug: defaultClientConfig.Debug,
    Ws: defaultClientConfig.Ws,
    Note: "SalaiToken will be provided via OAuth-extracted user token",
  }
);

export const midjourneyClient = new Midjourney(defaultClientConfig);

console.log(
  `[Midjourney Init] Default client created (requires OAuth token for actual use)`
);

async function uploadImageToDiscord(
  imageBase64: string,
  discordToken?: string,
  channelId?: string
): Promise<string> {
  try {
    console.log(`[Discord] Uploading image to Discord using REST API...`);

    // Create FormData with the image
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const formData = new FormData();

    // Create a File-like object from buffer
    const imageFile = new File([imageBuffer], "reference.jpg", {
      type: "image/jpeg",
    });
    formData.append("files[0]", imageFile);
    formData.append(
      "payload_json",
      JSON.stringify({
        content: "Reference image for Midjourney",
      })
    );

    // Use provided user token (required - no environment fallback)
    const tokenToUse = discordToken;
    const channelToUse = channelId || process.env.DISCORD_CHANNEL_ID;

    if (!tokenToUse) {
      throw new Error(
        "No Discord user token provided. Please sign in with Discord to extract your user token."
      );
    }

    if (!channelToUse) {
      throw new Error("No Discord channel ID available");
    }

    // Send to Discord REST API
    console.log(
      `[Discord] Making request to: https://discord.com/api/v10/channels/${channelToUse}/messages`
    );
    console.log(`[Discord] Request headers:`, {
      Authorization: tokenToUse
        ? `${tokenToUse.substring(0, 10)}...`
        : "MISSING",
      "Content-Type": "multipart/form-data",
    });

    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelToUse}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: tokenToUse,
        },
        body: formData,
      }
    );

    console.log(
      `[Discord] Response status: ${response.status} ${response.statusText}`
    );
    console.log(
      `[Discord] Response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Discord] Error response body:`, errorText);
      throw new Error(
        `Discord API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const responseText = await response.text();
    console.log(`[Discord] Raw response text:`, responseText);
    console.log(`[Discord] Response text length:`, responseText.length);

    let messageData;
    try {
      messageData = JSON.parse(responseText);
      console.log(`[Discord] Parsed response data:`, messageData);
    } catch (parseError) {
      console.error(`[Discord] JSON parsing failed:`, parseError);
      console.error(
        `[Discord] Raw response that failed to parse:`,
        responseText
      );
      throw new Error(
        `Failed to parse Discord API response: ${parseError.message}`
      );
    }

    if (!messageData.attachments || messageData.attachments.length === 0) {
      throw new Error("No attachments found in Discord message response");
    }

    const discordImageUrl = messageData.attachments[0].url;
    console.log(`[Discord] Image uploaded successfully: ${discordImageUrl}`);

    return discordImageUrl;
  } catch (error) {
    console.error("[Discord] Error uploading image:", error);
    throw error;
  }
}

export async function sendPromptToMidjourney(
  prompt: string,
  imageBase64?: string,
  onProgress?: (status: string) => void,
  discordCredentials?: {
    discordToken?: string;
    discordServerId?: string;
    discordChannelId?: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`[Midjourney] Starting connection to Midjourney...`);
    console.log(`[Midjourney] Server ID: ${serverId || "DM mode"}`);
    console.log(`[Midjourney] Channel ID: ${process.env.DISCORD_CHANNEL_ID}`);
    console.log(`[Midjourney] Sending prompt: ${prompt}`);
    console.log(`[Midjourney] Note: Using OAuth-extracted Discord user token`);

    console.log(`[Midjourney] Connecting to Discord...`);
    console.log(`[Midjourney] Client configuration:`, {
      ServerId: midjourneyClient.config?.ServerId,
      ChannelId: midjourneyClient.config?.ChannelId,
      SalaiToken: midjourneyClient.config?.SalaiToken,
      Debug: midjourneyClient.config?.Debug,
      Ws: midjourneyClient.config?.Ws,
    });

    // Add timeout to connection (30 seconds)
    const connectPromise = midjourneyClient.Connect().catch((error) => {
      console.error(`[Midjourney] Connection error details:`, error);
      console.error(`[Midjourney] Error name:`, error.name);
      console.error(`[Midjourney] Error message:`, error.message);
      console.error(`[Midjourney] Error stack:`, error.stack);
      if (error.response) {
        console.error(
          `[Midjourney] Error response status:`,
          error.response.status
        );
        console.error(
          `[Midjourney] Error response headers:`,
          error.response.headers
        );
        console.error(`[Midjourney] Error response data:`, error.response.data);
      }
      throw error;
    });

    const connectTimeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Connection timeout after 30 seconds")),
        30000
      )
    );

    await Promise.race([connectPromise, connectTimeoutPromise]);
    console.log(`[Midjourney] Successfully connected to Discord`);

    console.log(`[Midjourney] Sending Imagine command...`);
    console.log(`[Midjourney] Image base64 provided: ${!!imageBase64}`);

    let finalPrompt = prompt;

    // Upload image to Discord first if provided
    if (imageBase64) {
      try {
        onProgress?.("Uploading reference image to Discord...");
        console.log(`[Midjourney] Uploading image to Discord first...`);
        const discordImageUrl = await uploadImageToDiscord(
          imageBase64,
          discordCredentials?.discordToken,
          discordCredentials?.discordChannelId
        );
        finalPrompt = `${discordImageUrl} ${prompt}`;
        console.log(
          `[Midjourney] Final prompt with Discord image: ${finalPrompt}`
        );
      } catch (uploadError) {
        console.warn(
          `[Midjourney] Failed to upload image to Discord, proceeding without image:`,
          uploadError
        );
      }
    }

    onProgress?.("Sending prompt to Midjourney...");
    console.log(`[Midjourney] Sending prompt: ${finalPrompt}`);

    // Add 4-minute timeout for Midjourney response (Discord anti-bot protection)
    const imaginePromise = midjourneyClient.Imagine(finalPrompt);
    const imagineTimeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("MIDJOURNEY_TIMEOUT")),
        240000 // 4 minutes
      )
    );

    onProgress?.("Waiting for Midjourney response (up to 4 minutes)...");
    const message = await Promise.race([imaginePromise, imagineTimeoutPromise]);

    if (!message) {
      console.error(`[Midjourney] No message returned from Imagine command`);
      throw new Error(
        "Failed to send prompt to Midjourney - no message returned"
      );
    }

    console.log(`[Midjourney] ✅ Prompt sent successfully!`);
    console.log(`[Midjourney] Message ID: ${message.id}`);
    console.log(
      `[Midjourney] Message content: ${JSON.stringify(message, null, 2)}`
    );

    return {
      success: true,
      messageId: message.id,
    };
  } catch (error) {
    console.error("[Midjourney] ❌ Error sending prompt:", error);
    console.error(
      "[Midjourney] Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // Check for specific error patterns
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle Midjourney timeout specifically
    if (errorMessage === "MIDJOURNEY_TIMEOUT") {
      console.error("[Midjourney] ⏰ Timeout waiting for Midjourney response");
      return {
        success: false,
        error: "MIDJOURNEY_TIMEOUT",
      };
    }

    if (
      errorMessage.includes("Invalid URL") ||
      errorMessage.includes("not valid JSON")
    ) {
      console.error(
        "[Midjourney] This appears to be an authentication/configuration issue"
      );
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
  discordCredentials?: {
    discordToken?: string;
    discordServerId?: string;
    discordChannelId?: string;
  },
  imageBase64?: string,
  onProgress?: (
    promptIndex: number,
    total: number,
    status: string,
    details?: any
  ) => void,
  sessionId?: string
): Promise<{
  success: boolean;
  results: Array<{ prompt: string; messageId?: string; error?: string }>;
  aborted?: boolean;
  cdnImageUrl?: string;
}> {
  try {
    console.log(
      `[Midjourney Batch] Starting connection for ${prompts.length} prompts`
    );
    console.log(`[Midjourney Batch] Session ID: ${sessionId || "none"}`);

    // Create a new client instance if custom credentials are provided
    let clientToUse = midjourneyClient;
    if (discordCredentials?.discordToken) {
      console.log(`[Midjourney Batch] Using provided Discord user token`);
      const { Midjourney } = await import("midjourney");

      const customServerId =
        discordCredentials.discordServerId || process.env.DISCORD_SERVER_ID;
      const finalServerId = customServerId === "@me" ? null : customServerId;

      clientToUse = new Midjourney({
        ServerId: finalServerId || "1122334455667788",
        ChannelId:
          discordCredentials.discordChannelId ||
          process.env.DISCORD_CHANNEL_ID!,
        SalaiToken: discordCredentials.discordToken,
        Debug: process.env.NODE_ENV === "development",
        Ws: true,
        HuggingFaceToken: undefined,
      });

      console.log(`[Midjourney Batch] Created client with user token:`, {
        ServerId: finalServerId || "1122334455667788",
        ChannelId:
          discordCredentials.discordChannelId || process.env.DISCORD_CHANNEL_ID,
        SalaiToken: discordCredentials.discordToken
          ? `${discordCredentials.discordToken.substring(0, 10)}...`
          : "MISSING",
        Debug: process.env.NODE_ENV === "development",
      });
    } else {
      throw new Error(
        "No Discord user token provided. Please sign in with Discord to extract your user token."
      );
    }

    console.log(
      `[Midjourney Batch] Attempting to connect with OAuth-extracted token:`,
      {
        tokenLength: discordCredentials?.discordToken?.length,
        tokenStart: discordCredentials?.discordToken?.substring(0, 20),
        serverId: process.env.DISCORD_SERVER_ID,
        channelId: process.env.DISCORD_CHANNEL_ID,
      }
    );

    const connectResult = await clientToUse.Connect().catch((error) => {
      console.error(`[Midjourney Batch] Connection failed:`, error);
      console.error(`[Midjourney Batch] Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        response: error.response,
        status: error.status,
        statusText: error.statusText,
        data: error.data,
      });

      // Try to log the actual HTTP response if available
      if (error.response) {
        console.error(
          `[Midjourney Batch] HTTP Response Status:`,
          error.response.status
        );
        console.error(
          `[Midjourney Batch] HTTP Response Headers:`,
          error.response.headers
        );
        console.error(
          `[Midjourney Batch] HTTP Response Data:`,
          error.response.data
        );
      }

      // Check if it's a Discord API authentication error
      if (error.message.includes("Unexpected end of JSON input")) {
        console.error(
          `[Midjourney Batch] This looks like a Discord API authentication error.`
        );
        console.error(
          `[Midjourney Batch] The token might be invalid or the bot lacks permissions.`
        );
        console.error(`[Midjourney Batch] Token format check:`, {
          hasToken: !!discordCredentials?.discordToken,
          tokenLength: discordCredentials?.discordToken?.length,
          hasThreeParts:
            discordCredentials?.discordToken?.split(".").length === 3,
          tokenPrefix: discordCredentials?.discordToken?.substring(0, 10),
        });
      }

      throw error;
    });

    console.log(`[Midjourney Batch] Connection successful:`, connectResult);
    const results = [];

    // Upload image to Discord once for all prompts if provided
    let discordImageUrl: string | null = null;
    if (imageBase64) {
      try {
        onProgress?.(
          0,
          prompts.length,
          "Uploading reference image to Discord..."
        );
        console.log(
          `[Midjourney] Uploading image to Discord for batch processing...`
        );
        discordImageUrl = await uploadImageToDiscord(
          imageBase64,
          discordCredentials?.discordToken,
          discordCredentials?.discordChannelId
        );
        console.log(
          `[Midjourney] Image uploaded for batch: ${discordImageUrl}`
        );
      } catch (uploadError) {
        console.warn(
          `[Midjourney] Failed to upload image to Discord for batch, proceeding without image:`,
          uploadError
        );
      }
    }

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      // Check for abort signal if sessionId is provided
      if (sessionId) {
        try {
          const { shouldAbortProcessing } = await import(
            "../app/api/abort-processing/route"
          );
          if (shouldAbortProcessing(sessionId)) {
            console.log(
              `[Midjourney] Processing aborted for session: ${sessionId}`
            );
            onProgress?.(
              i + 1,
              prompts.length,
              `Processing aborted by user at prompt ${i + 1}/${prompts.length}`
            );
            return {
              success: false,
              aborted: true,
              results,
              cdnImageUrl: discordImageUrl || undefined,
            };
          }
        } catch (importError) {
          console.warn(
            "[Midjourney] Could not check abort signal:",
            importError
          );
        }
      }

      try {
        onProgress?.(
          i + 1,
          prompts.length,
          `Processing prompt ${i + 1}/${prompts.length}...`
        );
        console.log(
          `[Midjourney] Sending prompt ${i + 1}/${prompts.length}: ${prompt}`
        );
        console.log(
          `[Midjourney] Discord image URL available: ${!!discordImageUrl}`
        );

        let finalPrompt = prompt;
        if (discordImageUrl) {
          finalPrompt = `${discordImageUrl} ${prompt}`;
          console.log(
            `[Midjourney] Final prompt with Discord image: ${finalPrompt}`
          );
        }

        // Add 4-minute timeout for each individual prompt
        const imaginePromise = clientToUse.Imagine(finalPrompt);
        const imagineTimeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("MIDJOURNEY_TIMEOUT")),
            240000 // 4 minutes
          )
        );

        onProgress?.(
          i + 1,
          prompts.length,
          `Waiting for Midjourney response (up to 4 minutes)... (${i + 1}/${
            prompts.length
          })`
        );

        const message = await Promise.race([
          imaginePromise,
          imagineTimeoutPromise,
        ]);

        if (message) {
          results.push({
            prompt,
            messageId: message.id,
          });
          onProgress?.(
            i + 1,
            prompts.length,
            `Prompt ${i + 1}/${prompts.length} sent successfully`
          );
          console.log(
            `[Midjourney] Prompt ${i + 1}/${
              prompts.length
            } sent successfully. Message ID: ${message.id}`
          );
        } else {
          results.push({
            prompt,
            error: "Failed to send prompt",
          });
          onProgress?.(
            i + 1,
            prompts.length,
            `Prompt ${i + 1}/${prompts.length} failed`
          );
        }

        // Add delay between requests to avoid rate limiting
        if (i < prompts.length - 1) {
          onProgress?.(
            i + 1,
            prompts.length,
            `Waiting before next prompt... (${i + 2}/${prompts.length})`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error(`[Midjourney] Error sending prompt "${prompt}":`, error);

        // Check if this is a timeout error and provide specific guidance
        if (errorMessage === "MIDJOURNEY_TIMEOUT") {
          console.error(
            `[Midjourney] ⏰ Timeout on prompt ${i + 1}/${prompts.length}`
          );
          onProgress?.(
            i + 1,
            prompts.length,
            `Prompt ${i + 1}/${prompts.length} timed out after 4 minutes`,
            {
              promptIndex: i + 1,
              totalPrompts: prompts.length,
              failedPrompt: prompt,
              error:
                "Midjourney response timeout - possible Discord anti-bot check",
              errorType: "midjourney_timeout",
              timeoutDuration: "4 minutes",
              recoveryInstructions:
                "Go to Discord and manually run /imagine to pass anti-bot verification, then restart processing",
            }
          );
        } else {
          onProgress?.(
            i + 1,
            prompts.length,
            `Prompt ${i + 1}/${
              prompts.length
            } failed with error: ${errorMessage}`,
            {
              promptIndex: i + 1,
              totalPrompts: prompts.length,
              failedPrompt: prompt,
              error: errorMessage,
              errorType: "midjourney_prompt_failed",
            }
          );
        }

        results.push({
          prompt,
          error: errorMessage,
        });
      }
    }

    return {
      success: true,
      results,
      cdnImageUrl: discordImageUrl || undefined,
    };
  } catch (error) {
    console.error("[Midjourney] Error connecting to Midjourney:", error);
    return {
      success: false,
      results: prompts.map((prompt) => ({
        prompt,
        error: error instanceof Error ? error.message : "Connection error",
      })),
    };
  }
}
