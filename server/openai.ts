import OpenAI from 'openai';
// Simple PDF text extraction
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use dynamic import to avoid module loading issues
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(pdfBuffer);
    return pdfData.text || '';
  } catch (error) {
    console.error('PDF parsing failed:', error);
    // Return empty string as fallback - let OpenAI know it couldn't extract
    return 'PDF_EXTRACTION_FAILED_MANUAL_ENTRY_REQUIRED';
  }
}
import { getConfig } from './config';

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

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openai) return openai;
  
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    console.log("OpenAI API key not configured - extraction disabled");
    return null;
  }
  
  try {
    openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    return openai;
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error);
    return null;
  }
}

const DEXA_EXTRACTION_PROMPT = `
You are an expert at extracting data from DEXA (Dual-energy X-ray absorptiometry) scan reports. 
Analyze the provided DEXA scan report and extract the following metrics with high accuracy:

1. Body Fat Percentage (%)
2. Lean Mass (lbs or kg - convert to lbs if needed)
3. Total Weight (lbs or kg - convert to lbs if needed)  
4. Fat Mass (lbs or kg - convert to lbs if needed)
5. RMR/BMR (calories per day) - if available
6. Scan Date (if visible)
7. Patient Name (First and Last) - if visible
8. Scan Name/ID - if available

Return the data in this exact JSON format:
{
  "bodyFatPercent": <number>,
  "leanMass": <number in lbs>,
  "totalWeight": <number in lbs>,
  "fatMass": <number in lbs>,
  "rmr": <number or null>,
  "scanDate": "<YYYY-MM-DD or null>",
  "firstName": "<string or null>",
  "lastName": "<string or null>",
  "scanName": "<string or null>",
  "confidence": <0.0 to 1.0>
}

Important notes:
- Convert all weights from kg to lbs if needed (1 kg = 2.20462 lbs)
- Body fat percentage should be a decimal (e.g., 15.2 for 15.2%)
- Set confidence based on how clear and readable the data is
- If any value is unclear or missing, use null
- Only return the JSON object, no other text
`;

export async function extractDexaScanFromImage(imageBase64: string): Promise<ExtractedDexaData> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.log("OpenAI not available - returning default values");
    return getDefaultExtractedData();
  }

  try {
    console.log("Extracting DEXA data from image using OpenAI Vision...");
    
    // Remove data URL prefix if present
    const base64Image = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const response = await client.chat.completions.create({
      model: getConfig().OPENAI_MODEL || "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: DEXA_EXTRACTION_PROMPT
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("OpenAI response:", content);
    
    // Parse the JSON response
    const extractedData = JSON.parse(content.trim());
    
    // Validate and sanitize the response
    return {
      bodyFatPercent: Number(extractedData.bodyFatPercent) || 0,
      leanMass: Number(extractedData.leanMass) || 0,
      totalWeight: Number(extractedData.totalWeight) || 0,
      fatMass: Number(extractedData.fatMass) || 0,
      rmr: extractedData.rmr ? Number(extractedData.rmr) : undefined,
      scanDate: extractedData.scanDate || new Date().toISOString().split('T')[0],
      firstName: extractedData.firstName || undefined,
      lastName: extractedData.lastName || undefined,
      scanName: extractedData.scanName || undefined,
      confidence: Math.min(Math.max(Number(extractedData.confidence) || 0.5, 0), 1)
    };

  } catch (error) {
    console.error("OpenAI extraction failed:", error);
    return getDefaultExtractedData();
  }
}

export async function extractDexaScanFromPDF(pdfBase64: string): Promise<ExtractedDexaData> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.log("OpenAI not available - returning default values");
    return getDefaultExtractedData();
  }

  try {
    console.log("Extracting DEXA data from PDF...");
    
    // Remove data URL prefix if present
    const base64Pdf = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Pdf, 'base64');
    
    // Extract text from PDF
    const pdfText = await extractPdfText(pdfBuffer);
    
    console.log("Extracted PDF text length:", pdfText.length);
    
    if (!pdfText.trim() || pdfText === 'PDF_EXTRACTION_FAILED_MANUAL_ENTRY_REQUIRED') {
      console.log("PDF text extraction failed or returned empty - returning default values");
      return getDefaultExtractedData();
    }

    // Use OpenAI to analyze the extracted text
    const response = await client.chat.completions.create({
      model: getConfig().OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "user",
          content: `${DEXA_EXTRACTION_PROMPT}\n\nDEXA SCAN TEXT:\n${pdfText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("OpenAI response:", content);
    
    // Parse the JSON response
    const extractedData = JSON.parse(content.trim());
    
    // Validate and sanitize the response
    return {
      bodyFatPercent: Number(extractedData.bodyFatPercent) || 0,
      leanMass: Number(extractedData.leanMass) || 0,
      totalWeight: Number(extractedData.totalWeight) || 0,
      fatMass: Number(extractedData.fatMass) || 0,
      rmr: extractedData.rmr ? Number(extractedData.rmr) : undefined,
      scanDate: extractedData.scanDate || new Date().toISOString().split('T')[0],
      firstName: extractedData.firstName || undefined,
      lastName: extractedData.lastName || undefined,
      scanName: extractedData.scanName || undefined,
      confidence: Math.min(Math.max(Number(extractedData.confidence) || 0.7, 0), 1)
    };

  } catch (error) {
    console.error("PDF extraction failed:", error);
    return getDefaultExtractedData();
  }
}

function getDefaultExtractedData(): ExtractedDexaData {
  return {
    bodyFatPercent: 0,
    leanMass: 0,
    totalWeight: 0,
    fatMass: 0,
    confidence: 0.1,
    scanDate: new Date().toISOString().split('T')[0]
  };
}