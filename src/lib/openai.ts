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
  promptType: "outfit" | "texture" = "outfit"
): Promise<{ prompt: string; midjourneyPrompts: string[] }> {
  try {
    console.log(
      `[OpenAI Request] Starting generation for ${clothingPart} (${promptType})`
    );
    console.log(`[OpenAI Request] Description: ${description}`);
    console.log(
      `[OpenAI Request] Image size: ${Math.round(imageBase64.length / 1024)}KB`
    );

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert fashion designer and Midjourney prompt engineer. Your task is to analyze Pinterest fashion images and create detailed, professional Midjourney prompts for 3D clothing design.

PROMPT TYPE: ${promptType.toUpperCase()}

${
  promptType === "outfit"
    ? `
OUTFIT PROMPTS - Generate complete outfit visualizations:
1. Generate exactly 3 different variations of Midjourney prompts for the same clothing piece
2. Focus on the specific clothing part requested: ${clothingPart}
3. Include complete outfit styling, context, and fashion details
4. Add variety in styling contexts (runway, street style, editorial, etc.)
5. Include model, pose, setting, and overall aesthetic

OUTFIT EXAMPLE:
"runway fashion look, vintage graphic ringer t-shirt with distressed cotton fabric, oversized fit, neutral beige color, styled with high-waisted denim jeans, minimalist aesthetic, studio lighting, professional fashion photography --ar 2:3 --q 2 --s 250"
`
    : `
TEXTURE PROMPTS - Generate extreme close-up material texture studies:
1. Generate exactly 3 different variations focusing EXCLUSIVELY on material surface texture
2. EXTREME CLOSE-UP macro photography ONLY of the ${clothingPart} fabric/material
3. FILL THE ENTIRE FRAME with texture - no background, no context, no space around fabric
4. Focus on weave patterns, fiber details, surface irregularities, material grain
5. Perfect for seamless 3D texture mapping and material design workflows
6. MANDATORY: Always use --ar 1:1 for square format that tiles perfectly

CRITICAL TEXTURE REQUIREMENTS:
- ZOOMED IN so close that fabric fibers are visible
- NO negative space, NO background visible
- COVERS the complete square frame edge-to-edge
- Shows raw material properties for 3D rendering

TEXTURE EXAMPLE:
"extreme macro close-up photography of cotton denim fabric texture, individual fiber threads visible, indigo blue weave pattern filling entire frame, no background visible, raw textile surface detail for seamless 3D mapping, ultra-detailed fabric grain --ar 1:1 --q 2 --s 25"
`
}

MODERN PARAMETERS TO USE:
- --ar (aspect ratio): 1:1, 3:2, 16:9, 2:3, etc.
- --q (quality): 1 or 2 for higher quality 
- --s or --stylize: 50-1000 (50=low style, 100=default, 250=high, 750=very high)
- --chaos: 0-100 for variety (0=consistent, 100=very varied)
- --weird: 0-3000 for unconventional results

IMPORTANT:
- DO NOT include /imagine command - just the prompt text with parameters
- Ensure prompts are optimized for 3D fashion visualization`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze this Pinterest fashion image and create 3 detailed ${promptType.toUpperCase()} Midjourney prompts specifically for the ${clothingPart} part of the outfit. Additional context: ${description}

${
  promptType === "outfit"
    ? `
OUTFIT PROMPT Requirements:
- Focus on the ${clothingPart} as part of a complete outfit visualization
- Create 3 unique variations with different styling contexts (runway, street, editorial)
- Include model, pose, setting, lighting, and overall aesthetic
- Show how the ${clothingPart} fits into a complete fashion look
`
    : `
TEXTURE PROMPT Requirements:
- EXTREME CLOSE-UP macro photography ONLY of ${clothingPart} fabric surface
- FILL ENTIRE SQUARE FRAME edge-to-edge with texture (NO background visible)
- Create 3 unique ultra-zoomed material studies showing fiber-level detail
- Show weave patterns, thread structure, surface irregularities at microscopic level
- MANDATORY: Use --ar 1:1 for perfect square format that tiles seamlessly
- Perfect for high-resolution 3D texture mapping and PBR material workflows
`
}

General Requirements:
- Use modern Midjourney parameters appropriately (--ar, --q, --s, etc.)
- DO NOT include /imagine command - just prompt text with parameters
- Make prompts suitable for 3D fashion design and visualization`,
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
      max_tokens: 2000,
      temperature: 0.7,
    };

    console.log(`[OpenAI Request] Payload:`, {
      model: requestPayload.model,
      messageCount: requestPayload.messages.length,
      maxTokens: requestPayload.max_tokens,
      temperature: requestPayload.temperature,
      systemPromptLength: requestPayload.messages[0].content.length,
      userPromptLength: requestPayload.messages[1].content[0].text.length,
    });

    const startTime = Date.now();
    const response = await openai.chat.completions.create(requestPayload);
    const endTime = Date.now();

    console.log(`[OpenAI Response] Completed in ${endTime - startTime}ms`);
    console.log(`[OpenAI Response] Usage:`, response.usage);
    console.log(`[OpenAI Response] Model:`, response.model);
    console.log(
      `[OpenAI Response] Content length:`,
      response.choices[0]?.message?.content?.length || 0
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Extract individual prompts from the response
    const prompts = content
      .split('\n')
      .filter(line => line.trim() && (line.includes('--ar') || line.includes('--q') || line.includes('--s')))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(prompt => prompt.length > 0);

    return {
      prompt: content,
      midjourneyPrompts: prompts.slice(0, 3), // Ensure we have exactly 3 prompts
    };
  } catch (error) {
    console.error("Error generating Midjourney prompt:", error);
    throw new Error("Failed to generate Midjourney prompt");
  }
}
