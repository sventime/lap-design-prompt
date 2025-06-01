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
  autoSendToMidjourney: boolean = true,
  onMidjourneyProgress?: (promptIndex: number, total: number, status: string) => void
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
- DO NOT use markdown formatting (no **, -, or other markdown)
- Format: "PROMPT1: [full prompt description] --ar 2:3 --q 2 --s 250"
- Format: "PROMPT2: [full prompt description] --ar 2:3 --q 2 --s 250"
- Format: "PROMPT3: [full prompt description] --ar 2:3 --q 2 --s 250"
- Use plain text only, no bold or bullet points

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
- Use --ar 1:1 --q 2

IMPORTANT FORMATTING:
- Each prompt must be on a SINGLE LINE
- DO NOT use markdown formatting (no **, -, or other markdown)
- Format: "PROMPT1: [fabric type] fabric texture, [weave pattern], [material properties], macro photography --ar 1:1 --q 2"
- Format: "PROMPT2: [fabric type] fabric texture, [weave pattern], [material properties], macro photography --ar 1:1 --q 2"
- Format: "PROMPT3: [fabric type] fabric texture, [weave pattern], [material properties], macro photography --ar 1:1 --q 2"
- Use plain text only, no bold or bullet points

Examples of good fabric texture prompts:
- "Cotton denim fabric texture, diagonal twill weave, indigo blue threads, raw selvedge edge, macro photography --ar 1:1 --q 2"
- "Wool herringbone fabric texture, chevron weave pattern, charcoal gray fibers, soft hand feel, macro photography --ar 1:1 --q 2"
- "Silk charmeuse fabric texture, satin weave, lustrous surface, fluid drape, ivory color, macro photography --ar 1:1 --q 2"
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
    if (result.midjourneyPrompts.length > 0) {
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
          onMidjourneyProgress
        );

        console.log("[OpenAI] Midjourney results:", midjourneyResult);

        return {
          ...result,
          midjourneyResults: midjourneyResult.results,
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
