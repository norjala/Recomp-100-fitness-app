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

// Function to extract data from PDF using OpenAI Vision API (treating PDF as image)
export async function extractDexaScanFromPDF(pdfBase64: string): Promise<ExtractedDexaData> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    // Use OpenAI Vision API to analyze PDF pages as images
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical data extraction expert specializing in DEXA scan analysis. Your task is to extract specific body composition metrics from DEXA scan PDF reports.

Extract these exact metrics from the PDF:
- Body Fat Percentage (as decimal, e.g., 16.9 for 16.9%)
- Lean Mass in pounds (labeled as "Lean Tissue" or "Lean Mass")  
- Total Weight/Mass in pounds (labeled as "Total Mass")
- Fat Mass in pounds (labeled as "Fat Tissue" or "Fat Mass")
- RMR (Resting Metabolic Rate) in calories/day if available
- Patient Name (extract first name and last name separately)
- Scan Date (extract and format as YYYY-MM-DD)

Look for these common DEXA report sections:
- "SUMMARY RESULTS" table with Total Body Fat %, Total Mass, Fat Tissue, Lean Tissue
- "SUPPLEMENTAL RESULTS" section with Resting Metabolic Rate (RMR)
- Patient information header with name and measured date
- Values in format like "16.9%" for body fat, "155.9" for total mass, "123.2" for lean tissue

IMPORTANT: For RMR extraction:
- Look for "Resting Metabolic Rate" or "RMR" followed by a number with "cal/day"
- Extract the numerical value (e.g., "1,571 cal/day" → extract 1571)

Return JSON in this exact format:
{
  "bodyFatPercent": number,
  "leanMass": number, 
  "totalWeight": number,
  "fatMass": number,
  "rmr": number (optional, calories per day),
  "scanName": string (optional, full patient name),
  "firstName": string (optional, first name only),
  "lastName": string (optional, last name only),
  "scanDate": string (optional, scan date in YYYY-MM-DD format),
  "confidence": number (0-1 scale)
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract body composition data from this DEXA scan PDF report. Focus on the SUMMARY RESULTS section for main metrics and SUPPLEMENTAL RESULTS for RMR. Return as JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    console.log("OpenAI PDF extraction result:", result);

    return validateAndSanitizeData(result);

  } catch (error) {
    console.error("Error extracting DEXA scan data from PDF:", error);
    throw new Error("Could not extract data from PDF. Please ensure it's a valid DEXA scan report and try again.");
  }
}

export async function extractDexaScanData(base64Image: string): Promise<ExtractedDexaData> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    // Check if it's a PDF data URL
    if (base64Image.startsWith('data:application/pdf;base64,')) {
      const pdfBase64 = base64Image.replace('data:application/pdf;base64,', '');
      return extractDexaScanFromPDF(pdfBase64);
    }

    // Handle image processing (existing logic)
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
- RMR, metabolic rate, or "Resting metabolic" sections - look for values like "1825 cal", "RMR: 1650", etc.
- Patient information header

IMPORTANT: For RMR (Resting Metabolic Rate):
- Look for sections labeled "Resting metabolic", "RMR", "Metabolic rate", or similar
- Extract the numerical value in calories (e.g., if you see "1825 cal", extract 1825)
- Common formats: "1825 cal", "RMR: 1650 calories", "Resting metabolic: 1750"

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
              text: "Extract body composition data from this DEXA scan image. Look for body fat percentage, lean mass (lbs), total weight (lbs), fat mass (lbs), and resting metabolic rate (RMR). Pay special attention to any section labeled 'Resting metabolic' - extract the calorie value (e.g., if you see '1825 cal', extract 1825 as the rmr value). Return as JSON."
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
    console.log("OpenAI image extraction result:", result);

    return validateAndSanitizeData(result);

  } catch (error) {
    console.error("Error extracting DEXA scan data:", error);
    if (error instanceof Error && error.message.includes("Invalid")) {
      throw error;
    }
    throw new Error("Could not extract data from image. Please ensure it's a clear DEXA scan report and try again.");
  }
}

// Helper function to validate and sanitize extracted data
function validateAndSanitizeData(result: any): ExtractedDexaData {
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
}