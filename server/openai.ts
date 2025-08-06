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
  fatMass: number;
  rmr?: number;
  scanName?: string;
  firstName?: string;
  lastName?: string;
  scanDate?: string;
  confidence: number;
}

export async function extractDexaScanData(base64Image: string): Promise<ExtractedDexaData> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    // Clean up base64 string and detect image format
    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");
    const imageFormat = base64Image.includes('data:image/png') ? 'png' : 'jpeg';
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical data extraction expert specializing in DEXA scan analysis. Your task is to extract specific body composition metrics from DEXA scan reports or screenshots.

Extract these exact metrics:
- Body Fat Percentage (as decimal, e.g., 19.1 for 19.1%)
- Lean Mass in pounds (total lean body mass)
- Total Weight in pounds (total body weight)
- Fat Mass in pounds (total fat mass)
- RMR (Resting Metabolic Rate) in calories/day if available
- Patient/Scan Name if visible (extract first name and last name separately)
- Scan Date if visible

Common DEXA scan sections to look for:
- "Total Body" summary section
- "Composition" or "Body Composition" tables
- Values labeled as "Fat %", "Lean Mass", "Total Mass", "Fat Mass"
- RMR or metabolic rate sections
- Patient information header

Return JSON in this exact format:
{
  "bodyFatPercent": number,
  "leanMass": number, 
  "totalWeight": number,
  "fatMass": number,
  "rmr": number (optional, calories per day),
  "scanName": string (optional, full patient name from scan),
  "firstName": string (optional, first name only),
  "lastName": string (optional, last name only),
  "scanDate": string (optional, scan date in YYYY-MM-DD format),
  "confidence": number (0-1 scale)
}

If you cannot find clear DEXA scan data, return confidence: 0.1 and reasonable estimates based on what's visible.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract body composition data from this DEXA scan image. Look for body fat percentage, lean mass (lbs), total weight (lbs), and scan date. Return as JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/${imageFormat};base64,${cleanBase64}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and sanitize the extracted data
    const bodyFatPercent = Number(result.bodyFatPercent) || 0;
    const leanMass = Number(result.leanMass) || 0;
    const totalWeight = Number(result.totalWeight) || 0;
    const fatMass = Number(result.fatMass) || 0;
    const rmr = result.rmr ? Number(result.rmr) : undefined;
    const scanName = result.scanName ? String(result.scanName).trim() : undefined;
    const firstName = result.firstName ? String(result.firstName).trim() : undefined;
    const lastName = result.lastName ? String(result.lastName).trim() : undefined;
    const scanDate = result.scanDate ? String(result.scanDate).trim() : undefined;
    const confidence = Math.min(Math.max(Number(result.confidence) || 0.1, 0), 1);

    // Basic validation checks
    if (bodyFatPercent < 0 || bodyFatPercent > 50) {
      throw new Error("Invalid body fat percentage extracted");
    }
    if (leanMass < 50 || leanMass > 300) {
      throw new Error("Invalid lean mass extracted");
    }
    if (totalWeight < 80 || totalWeight > 400) {
      throw new Error("Invalid total weight extracted");
    }
    if (fatMass < 5 || fatMass > 200) {
      throw new Error("Invalid fat mass extracted");
    }

    return {
      bodyFatPercent,
      leanMass,
      totalWeight,
      fatMass,
      rmr,
      scanName,
      firstName,
      lastName,
      scanDate,
      confidence
    };

  } catch (error) {
    console.error("Error extracting DEXA scan data:", error);
    if (error instanceof Error && error.message.includes("Invalid")) {
      throw error;
    }
    throw new Error("Could not extract data from image. Please ensure it's a clear DEXA scan report and try again.");
  }
}