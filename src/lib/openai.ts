import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not defined in environment variables");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function detectMimeType(base64Data: string, fileName?: string): string {
  // First try to detect from base64 signatures
  if (base64Data.startsWith("/9j/")) {
    return "image/jpeg";
  }
  if (base64Data.startsWith("iVBORw0KGgo")) {
    return "image/png";
  }
  if (base64Data.startsWith("UklGR")) {
    return "image/webp";
  }

  // Fallback to file extension if provided
  if (fileName) {
    const ext = fileName.toLowerCase().split(".").pop();
    switch (ext) {
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "webp":
        return "image/webp";
      default:
        return "image/jpeg";
    }
  }

  // Default to JPEG if unknown
  return "image/jpeg";
}

export async function generateMidjourneyPrompt(
  imageBase64: string,
  clothingPart: string,
  description: string,
  promptType: "outfit" | "texture" = "outfit",
  genderType: "male" | "female" = "female",
  guidance?: string,
  autoSendToMidjourney: boolean = true,
  onMidjourneyProgress?: (
    promptIndex: number,
    total: number,
    status: string,
    details?: any
  ) => void,
  sessionId?: string,
  fileName?: string
): Promise<{
  prompt: string;
  midjourneyPrompts: string[];
  outfitNames?: string[];
  midjourneyResults?: Array<{
    prompt: string;
    messageId?: string;
    error?: string;
  }>;
  cdnImageUrl?: string;
}> {
  try {
    console.log(
      `[OpenAI Request] Starting generation for ${clothingPart} (${promptType})`
    );

    // Detect the correct MIME type from the base64 data and filename
    const mimeType = detectMimeType(imageBase64, fileName);
    console.log(
      `[OpenAI] Detected MIME type:`,
      mimeType,
      fileName ? `(from file: ${fileName})` : "(from base64 signature)"
    );

    // Log image data details
    console.log(`[OpenAI] Image base64 length:`, imageBase64.length);
    console.log(
      `[OpenAI] Image base64 starts with:`,
      imageBase64.substring(0, 50)
    );
    console.log(
      `[OpenAI] Image base64 ends with:`,
      imageBase64.substring(imageBase64.length - 50)
    );

    // Check if image data is valid base64
    try {
      const decoded = atob(imageBase64.substring(0, 100));
      console.log(`[OpenAI] Base64 decoding test successful`);
    } catch (decodeError) {
      console.error(`[OpenAI] Base64 decoding test failed:`, decodeError);
    }

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a fashion design expert with advanced vision capabilities. You can see and analyze images perfectly. You will be provided with an image that you MUST visually analyze to create detailed Midjourney prompts for ${clothingPart}.

${
  promptType === "outfit"
    ? `Create 3 prompts focusing on the ${clothingPart} worn by a ${genderType} model.
Requirements:
- Focus specifically on the ${clothingPart}
- Show detailed view of design and fit
- Professional fashion photography style
- Always add "on contrasting background" to highlight the ${clothingPart}
- Use parameters like --ar 2:3 --q 2 --s 250 --fast

IMPORTANT FORMATTING:
- Each prompt must be on a SINGLE LINE
- DO NOT use markdown formatting (no **, -, or other markdown)
- DO NOT wrap prompts in quotation marks
- Format: PROMPT1: [full prompt description] --ar 2:3 --q 2 --s 250 --fast
- Format: PROMPT2: [full prompt description] --ar 2:3 --q 2 --s 250 --fast
- Format: PROMPT3: [full prompt description] --ar 2:3 --q 2 --s 250 --fast
- Use plain text only, no bold or bullet points, no quotation marks

Also create 10 product names:
Format: "NAME1: English Name | Russian Translation"
Example: "NAME1: Navy Blue Jeans | Темно-синие джинсы"
- Always end with clothing item name
- Include descriptive details`
    : `Create 3 fabric texture prompts for ${clothingPart} material.
Requirements:
- Focus on fabric texture, weave pattern, and material properties
- Specify fabric type (cotton, silk, wool, denim, leather, etc.)
- Include technical fabric details (thread count, weave type, finish)
- Mention fabric behavior (drape, stretch, stiffness)
- Use macro photography perspective
- Add lighting that shows texture depth
- Force Midjourney to generate exatrly a texture, not an outfit or even zoomed-in part of it, but texture that I can apply on 3d model
- Use --ar 1:1 --q 2 --fast

IMPORTANT FORMATTING:
- Each prompt must be on a SINGLE LINE
- DO NOT use markdown formatting (no **, -, or other markdown)
- DO NOT wrap prompts in quotation marks
- Format: PROMPT1: [fabric type] fabric texture, [material properties], macro photography --ar 1:1 --q 2 --fast
- Format: PROMPT2: [fabric type] fabric texture, [material properties], macro photography --ar 1:1 --q 2 --fast
- Format: PROMPT3: [fabric type] fabric texture,  [material properties], macro photography --ar 1:1 --q 2 --fast
- Use plain text only, no bold or bullet points, no quotation marks

Examples of good fabric texture prompts:
- Cotton denim fabric texture, diagonal twill weave, indigo blue threads, raw selvedge edge, macro photography --ar 1:1 --q 2 --fast
- Wool herringbone fabric texture, chevron weave pattern, charcoal gray fibers, soft hand feel, macro photography --ar 1:1 --q 2 --fast
- Silk charmeuse fabric texture, satin weave, lustrous surface, fluid drape, ivory color, macro photography --ar 1:1 --q 2 --fast
`
}

Do not include /imagine command.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    };

    console.log(
      `[OpenAI Request] Request payload:`,
      JSON.stringify(requestPayload, null, 2)
    );

    const startTime = Date.now();
    console.log(
      `[OpenAI] Making API call to OpenAI with model: ${requestPayload.model}...`
    );

    let response;
    try {
      response = await openai.chat.completions.create(requestPayload);
    } catch (modelError) {
      console.warn(
        `[OpenAI] Model ${requestPayload.model} failed, trying fallback gpt-4o:`,
        modelError
      );
      requestPayload.model = "gpt-4o";
      // Also try with jpeg format again
      if (requestPayload.messages[1]?.content?.[1]?.image_url) {
        requestPayload.messages[1].content[1].image_url.url = `data:image/jpeg;base64,${imageBase64}`;
      }
      try {
        response = await openai.chat.completions.create(requestPayload);
      } catch (secondError) {
        console.warn(
          `[OpenAI] Second attempt failed, trying with different image format:`,
          secondError
        );
        // Try with auto-detection
        if (requestPayload.messages[1]?.content?.[1]?.image_url) {
          requestPayload.messages[1].content[1].image_url.url = `data:image/webp;base64,${imageBase64}`;
        }
        response = await openai.chat.completions.create(requestPayload);
      }
    }
    const endTime = Date.now();

    console.log(`[OpenAI Response] Completed in ${endTime - startTime}ms`);
    console.log(`[OpenAI Response] Full response structure:`, {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: response.choices.map((choice, idx) => ({
        choiceIndex: idx,
        finishReason: choice.finish_reason,
        messageRole: choice.message?.role,
        messageContentLength: choice.message?.content?.length || 0,
        messageContentStart:
          choice.message?.content?.substring(0, 200) || "NO_CONTENT",
      })),
      usage: response.usage,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log(`[OpenAI Response] Content length:`, content.length);
    console.log(
      `[OpenAI Response] Content preview:`,
      content.substring(0, 500)
    );

    // Extract individual prompts from the response with bulletproof parsing
    const prompts = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Remove markdown formatting
        line = line.replace(/^\*\*|\*\*$/g, ""); // Remove ** at start/end
        line = line.replace(/^-\s*/, ""); // Remove bullet points
        line = line.replace(/^\*\s*/, ""); // Remove asterisk bullets
        // Remove quotation marks that might wrap the entire prompt
        line = line.replace(/^["']|["']$/g, ""); // Remove quotes at start/end
        return line.trim();
      })
      .filter((line) => line.match(/^PROMPT\s*\d+\s*:/i))
      .map((line) => line.replace(/^PROMPT\s*\d+\s*:\s*/i, "").trim())
      .filter((prompt) => prompt.length > 0);

    // Extract outfit names (only for outfit type) with bulletproof parsing
    let outfitNames: string[] = [];
    if (promptType === "outfit") {
      outfitNames = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          // Remove markdown formatting
          line = line.replace(/^\*\*|\*\*$/g, ""); // Remove ** at start/end
          line = line.replace(/^-\s*/, ""); // Remove bullet points
          line = line.replace(/^\*\s*/, ""); // Remove asterisk bullets
          // Remove quotation marks that might wrap the content
          line = line.replace(/^["']|["']$/g, ""); // Remove quotes at start/end
          return line.trim();
        })
        .filter((line) => line.match(/^NAME\s*\d+\s*:/i))
        .map((line) => line.replace(/^NAME\s*\d+\s*:\s*/i, "").trim())
        .filter((name) => name.length > 0)
        .slice(0, 10);
    }

    const result = {
      prompt: content,
      midjourneyPrompts: prompts.slice(0, 3),
      outfitNames: promptType === "outfit" ? outfitNames : undefined,
    };

    // Auto-send to Midjourney if requested
    if (autoSendToMidjourney && result.midjourneyPrompts.length > 0) {
      try {
        console.log("[OpenAI] Auto-sending all prompts to Midjourney...");
        console.log(
          `[OpenAI] Sending ${result.midjourneyPrompts.length} prompts`
        );

        const { sendMultiplePromptsToMidjourney } = await import(
          "./midjourney"
        );
        const midjourneyResult = await sendMultiplePromptsToMidjourney(
          result.midjourneyPrompts,
          imageBase64,
          onMidjourneyProgress,
          sessionId
        );

        console.log("[OpenAI] Midjourney results:", midjourneyResult);

        return {
          ...result,
          midjourneyResults: midjourneyResult.results,
          cdnImageUrl: midjourneyResult.cdnImageUrl,
        };
      } catch (midjourneyError) {
        console.error(
          "[OpenAI] ❌ Error auto-sending to Midjourney:",
          midjourneyError
        );
        console.error(
          "[OpenAI] Error stack:",
          midjourneyError instanceof Error ? midjourneyError.stack : "No stack"
        );
        // Return the prompts even if Midjourney sending fails
        return {
          ...result,
          midjourneyResults: result.midjourneyPrompts.map((prompt) => ({
            prompt,
            error:
              midjourneyError instanceof Error
                ? midjourneyError.message
                : "Unknown error in auto-send",
          })),
        };
      }
    }

    return result;
  } catch (error) {
    console.error("Error generating Midjourney prompt:", error);
    throw new Error("Failed to generate Midjourney prompt");
  }
}
