import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set - DEXA scan data extraction will not work");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "dummy-key"
});

export interface ExtractedDexaData {
  bodyFatPercent: number;
  leanMass: number;
  totalWeight: number;
  confidence: number;
}

export async function extractDexaScanData(base64Image: string): Promise<ExtractedDexaData> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical data extraction expert. Analyze DEXA scan reports and extract the following key metrics:
- Body Fat Percentage (as a number, e.g., 19.1)
- Lean Mass in pounds (as a number, e.g., 123.5)
- Total Weight in pounds (as a number, e.g., 162.1)

Return the data as JSON in this exact format:
{
  "bodyFatPercent": number,
  "leanMass": number, 
  "totalWeight": number,
  "confidence": number (0-1 scale indicating extraction confidence)
}

Look for common DEXA scan sections like "Body Composition", "Regional Analysis", or summary tables. Convert all weights to pounds if given in kg (multiply by 2.20462). Be precise with decimal places.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract the body fat percentage, lean mass (in pounds), and total weight (in pounds) from this DEXA scan report. Return the data in the specified JSON format."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate the extracted data
    if (typeof result.bodyFatPercent !== 'number' || 
        typeof result.leanMass !== 'number' || 
        typeof result.totalWeight !== 'number') {
      throw new Error("Invalid data extracted from DEXA scan");
    }

    return {
      bodyFatPercent: Number(result.bodyFatPercent),
      leanMass: Number(result.leanMass),
      totalWeight: Number(result.totalWeight),
      confidence: Number(result.confidence) || 0.8
    };

  } catch (error) {
    console.error("Error extracting DEXA scan data:", error);
    throw new Error("Failed to extract data from DEXA scan image");
  }
}