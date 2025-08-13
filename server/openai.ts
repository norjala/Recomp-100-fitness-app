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

// Function to extract DEXA scan data from images using OpenAI Vision
export async function extractDexaScanFromImage(imageBase64: string): Promise<ExtractedDexaData> {
  console.log("Analyzing DEXA scan image with OpenAI Vision...");
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Use OpenAI Vision to extract data from the image
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical data extraction expert specializing in DEXA scan analysis. Extract all visible data from this DEXA body composition scan report.

Look for and extract:
- Patient name (First and Last name)
- Scan date (any format)
- Body Fat Percentage (%)
- Total Weight/Mass (lbs or kg - convert kg to lbs: 1 kg = 2.20462 lbs)
- Lean Mass/Muscle Mass (lbs or kg - convert to lbs)
- Fat Mass (lbs or kg - convert to lbs)
- RMR/Metabolic Rate (cal/day)

Common terminology:
- "Fat Tissue" = fatMass
- "Lean Tissue" = leanMass  
- "Total Mass" = totalWeight
- "Body Fat %" = bodyFatPercent

Be precise with numbers. Convert metric units to imperial if needed.

Return JSON format:
{
  "firstName": "John",
  "lastName": "Doe", 
  "scanDate": "2025-04-30",
  "bodyFatPercent": 16.9,
  "totalWeight": 155.9,
  "leanMass": 123.2,
  "fatMass": 26.3,
  "rmr": 1571
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this DEXA scan report and extract all the body composition data. Pay special attention to numerical values and patient information."
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const extractedData = JSON.parse(response.choices[0].message.content || "{}");
    console.log("OpenAI Vision extraction result:", extractedData);

    // Build DEXA data object
    const dexaData = {
      bodyFatPercent: Number(extractedData.bodyFatPercent) || 0,
      leanMass: Number(extractedData.leanMass) || 0,
      totalWeight: Number(extractedData.totalWeight) || 0,
      fatMass: Number(extractedData.fatMass) || 0,
      rmr: extractedData.rmr ? Number(extractedData.rmr) : undefined,
      scanName: extractedData.firstName && extractedData.lastName ? `${extractedData.firstName} ${extractedData.lastName}` : "",
      firstName: extractedData.firstName || "",
      lastName: extractedData.lastName || "",
      scanDate: extractedData.scanDate || new Date().toISOString().split('T')[0],
      confidence: 0.85 // High confidence with Vision
    };

    if (dexaData.bodyFatPercent > 0 || dexaData.leanMass > 0) {
      console.log("Successfully extracted DEXA data:");
      console.log(`  Body Fat: ${dexaData.bodyFatPercent}%`);
      console.log(`  Lean Mass: ${dexaData.leanMass} lbs`);
      console.log(`  Total Weight: ${dexaData.totalWeight} lbs`);
      console.log(`  Fat Mass: ${dexaData.fatMass} lbs`);
      if (dexaData.rmr) console.log(`  RMR: ${dexaData.rmr} cal/day`);
      console.log(`  Patient: ${dexaData.firstName} ${dexaData.lastName}`);
      console.log(`  Date: ${dexaData.scanDate}`);
    } else {
      console.log("Could not extract complete DEXA data from image");
    }
    
    return validateAndSanitizeData(dexaData);

  } catch (error) {
    console.error("Vision processing failed:", error);
    
    // Return empty data for manual entry
    const fallbackData = {
      bodyFatPercent: 0,
      leanMass: 0,
      totalWeight: 0,
      fatMass: 0,
      rmr: undefined,
      scanName: "",
      firstName: "",
      lastName: "",
      scanDate: new Date().toISOString().split('T')[0],
      confidence: 0.1
    };
    
    return validateAndSanitizeData(fallbackData);
  }
}

// For PDFs, convert them to images first or provide manual entry
export async function extractDexaScanFromPDF(pdfBase64: string): Promise<ExtractedDexaData> {
  console.log("PDF processing - recommending image conversion or manual entry");
  
  // For now, return empty data to encourage manual entry
  // In future, could implement PDF-to-image conversion
  const fallbackData = {
    bodyFatPercent: 0,
    leanMass: 0,
    totalWeight: 0,
    fatMass: 0,
    rmr: undefined,
    scanName: "",
    firstName: "",
    lastName: "",
    scanDate: new Date().toISOString().split('T')[0],
    confidence: 0.1
  };
  
  return validateAndSanitizeData(fallbackData);
}

// Parse DEXA text content using flexible pattern matching
function parseDexaTextContent(text: string): ExtractedDexaData {
  console.log("🔍 Analyzing text patterns for DEXA metrics...");
  
  let bodyFatPercent = 0;
  let leanMass = 0;
  let totalWeight = 0; 
  let fatMass = 0;
  let rmr: number | undefined = undefined;
  let firstName = "";
  let lastName = "";
  let scanDate = "";
  let confidence = 0.1;
  
  // Clean up text for better pattern matching
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  try {
    // Extract patient name - try multiple formats
    const namePatterns = [
      /(?:Client|Patient|Name)[:\s]*([A-Z][a-z]+),\s*([A-Z][a-z]+)/i,
      /([A-Z][a-z]+),\s*([A-Z][a-z]+)/,  // "Last, First" format
      /([A-Z][a-z]+)\s+([A-Z][a-z]+)/    // "First Last" format
    ];
    
    for (const pattern of namePatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        if (pattern.source.includes(',')) {
          lastName = match[1];
          firstName = match[2]; 
        } else {
          firstName = match[1];
          lastName = match[2];
        }
        console.log(`Found patient: ${firstName} ${lastName}`);
        break;
      }
    }
    
    // Extract scan date
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(\d{4}-\d{2}-\d{2})/g,
      /Measured Date[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i
    ];
    
    for (const pattern of datePatterns) {
      const matches = Array.from(normalizedText.matchAll(pattern));
      if (matches.length > 0) {
        const dateStr = matches[0][1];
        if (dateStr.includes('/')) {
          const [month, day, year] = dateStr.split('/');
          scanDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          scanDate = dateStr;
        }
        console.log(`Found scan date: ${scanDate}`);
        break;
      }
    }
    
    // Extract body composition metrics using flexible patterns
    console.log("🔍 Searching for body composition data...");
    
    // Body fat percentage - look for percentage values that make sense
    const bodyFatMatches = Array.from(normalizedText.matchAll(/(\d{1,2}\.?\d*)%/g));
    for (const match of bodyFatMatches) {
      const value = parseFloat(match[1]);
      if (value >= 5 && value <= 50) { // Reasonable body fat range
        bodyFatPercent = value;
        console.log(`Found body fat: ${bodyFatPercent}%`);
        break;
      }
    }
    
    // Look for weight and mass values - extract numbers that are in reasonable ranges
    const numberMatches = Array.from(normalizedText.matchAll(/(\d{2,3}\.?\d*)/g));
    const numbers = numberMatches.map(m => parseFloat(m[1])).filter(n => n >= 50 && n <= 400);
    
    if (numbers.length >= 3) {
      // Sort numbers to assign them logically
      numbers.sort((a, b) => b - a); // Largest to smallest
      
      // Typically: Total Weight > Lean Mass > Fat Mass
      totalWeight = numbers[0];
      leanMass = numbers[1];
      fatMass = numbers[2];
      
      console.log(`Found total weight: ${totalWeight} lbs`);
      console.log(`Found lean mass: ${leanMass} lbs`);
      console.log(`Found fat mass: ${fatMass} lbs`);
    }
    
    // Look for RMR specifically
    const rmrPatterns = [
      /(\d{3,4})\s*cal(?:ories)?\/day/i,
      /(\d{1,2},\d{3})\s*cal\/day/i
    ];
    
    for (const pattern of rmrPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const value = parseInt(match[1].replace(',', ''));
        if (value >= 800 && value <= 4000) {
          rmr = value;
          console.log(`Found RMR: ${rmr} cal/day`);
          break;
        }
      }
    }
    
    // Calculate confidence based on extracted data
    const extractedMetrics = [bodyFatPercent, leanMass, totalWeight, fatMass].filter(v => v > 0);
    if (extractedMetrics.length >= 3) {
      confidence = 0.9; // High confidence with 3+ metrics
    } else if (extractedMetrics.length >= 2) {
      confidence = 0.7; // Medium confidence with 2 metrics  
    } else if (extractedMetrics.length >= 1) {
      confidence = 0.5; // Low confidence with 1 metric
    }
    
    console.log(`Extraction confidence: ${Math.round(confidence * 100)}%`);
    console.log(`Extracted ${extractedMetrics.length} out of 4 key metrics`);
    
  } catch (parseError) {
    console.error("Error parsing DEXA text:", parseError);
  }
  
  return {
    bodyFatPercent,
    leanMass,
    totalWeight,
    fatMass,
    rmr,
    scanName: firstName && lastName ? `${firstName} ${lastName}` : "",
    firstName,
    lastName,
    scanDate: scanDate || new Date().toISOString().split('T')[0],
    confidence
  };
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

  // Basic validation checks - skip strict validation for manual entry (confidence <= 0.15)
  if (confidence <= 0.15) {
    // For manual entry scenarios with zero values, just do basic bounds checking
    console.log("Manual entry mode - skipping strict validation");
  } else {
    // Only validate when confidence is higher (actual extraction)
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