import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not defined in environment variables");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateMidjourneyPrompt(
  imageBase64: string,
  clothingPart: string,
  description: string,
  promptType: "outfit" | "texture" = "outfit",
  genderType: "male" | "female" = "female",
  guidance?: string,
  autoSendToMidjourney: boolean = true
): Promise<{
  prompt: string;
  midjourneyPrompts: string[];
  outfitNames?: string[];
  midjourneyResults?: Array<{
    prompt: string;
    messageId?: string;
    error?: string;
  }>;
}> {
  try {
    console.log(
      `[OpenAI Request] Starting generation for ${clothingPart} (${promptType})`
    );

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a fashion design expert. Create detailed Midjourney prompts for ${clothingPart}.

${
  promptType === "outfit"
    ? `Create 3 prompts focusing on the ${clothingPart} worn by a ${genderType} model.
Requirements:
- Focus specifically on the ${clothingPart}
- Show detailed view of design and fit
- Professional fashion photography style
- Use contrasting background to highlight the ${clothingPart}
- Use parameters like --ar 2:3 --q 2 --s 250

IMPORTANT FORMATTING:
- Each prompt must be on a SINGLE LINE
- Format: "PROMPT1: [full prompt description] --ar 2:3 --q 2 --s 250"
- Format: "PROMPT2: [full prompt description] --ar 2:3 --q 2 --s 250"
- Format: "PROMPT3: [full prompt description] --ar 2:3 --q 2 --s 250"

Also create 10 product names:
Format: "NAME1: English Name | Russian Translation"
Example: "NAME1: Navy Blue Jeans | Темно-синие джинсы"
- Always end with clothing item name
- Include descriptive details`
    : `Create 3 macro texture prompts for ${clothingPart} fabric.
Requirements:
- Extreme close-up of fabric only
- Fill entire frame with texture
- Use --ar 1:1 --q 2

IMPORTANT FORMATTING:
- Each prompt must be on a SINGLE LINE
- Format: "PROMPT1: [full prompt description] --ar 1:1 --q 2"
- Format: "PROMPT2: [full prompt description] --ar 1:1 --q 2"
- Format: "PROMPT3: [full prompt description] --ar 1:1 --q 2"
`
}

Do not include /imagine command.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and create ${promptType} prompts for ${clothingPart}.${
                guidance ? ` User guidance: ${guidance}` : ""
              }`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    };

    const startTime = Date.now();
    const response = await openai.chat.completions.create(requestPayload);
    const endTime = Date.now();

    console.log(`[OpenAI Response] Completed in ${endTime - startTime}ms`);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Extract individual prompts from the response
    const prompts = content
      .split("\n")
      .filter((line) => line.trim() && line.startsWith("PROMPT"))
      .map((line) => line.replace(/^PROMPT\d+:\s*/, "").trim())
      .filter((prompt) => prompt.length > 0);

    // Extract outfit names (only for outfit type)
    let outfitNames: string[] = [];
    if (promptType === "outfit") {
      outfitNames = content
        .split("\n")
        .filter((line) => line.trim() && line.startsWith("NAME"))
        .map((line) => line.replace(/^NAME\d+:\s*/, "").trim())
        .filter((name) => name.length > 0)
        .slice(0, 10);
    }

    const result = {
      prompt: content,
      midjourneyPrompts: prompts.slice(0, 3),
      outfitNames: promptType === "outfit" ? outfitNames : undefined,
    };

    // Auto-send to Midjourney if requested
    if (result.midjourneyPrompts.length > 0) {
      try {
        console.log("[OpenAI] Auto-sending first prompt to Midjourney...");
        console.log(`[OpenAI] First prompt: ${result.midjourneyPrompts[0]}`);

        const { sendPromptToMidjourney } = await import("./midjourney");
        const midjourneyResult = await sendPromptToMidjourney(
          result.midjourneyPrompts[0]
        );

        console.log("[OpenAI] Midjourney result:", midjourneyResult);

        return {
          ...result,
          midjourneyResults: [
            {
              prompt: result.midjourneyPrompts[0],
              messageId: midjourneyResult.messageId,
              error: midjourneyResult.error,
            },
          ],
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
          midjourneyResults: [
            {
              prompt: result.midjourneyPrompts[0],
              error:
                midjourneyError instanceof Error
                  ? midjourneyError.message
                  : "Unknown error in auto-send",
            },
          ],
        };
      }
    }

    return result;
  } catch (error) {
    console.error("Error generating Midjourney prompt:", error);
    throw new Error("Failed to generate Midjourney prompt");
  }
}
