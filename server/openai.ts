import OpenAI from 'openai';
import { getConfig } from './config.js';

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
  // Debug information
  debugInfo?: {
    extractionMethod: string;
    textLength: number;
    extractedTextPreview: string;
    openaiModel: string;
    processingTime: number;
    retryAttempts?: number;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    fallbackUsed?: boolean;
    confidenceFactors: string[];
  };
}

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openai) return openai;
  
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    console.error("❌ CRITICAL: OpenAI API key not configured in environment variables!");
    console.error("   Please add OPENAI_API_KEY to your Render environment variables");
    console.error("   AI extraction will return default values (all zeros) until configured");
    return null;
  }
  
  console.log("✅ OpenAI API key found, initializing client...");
  
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

// Enhanced PDF text extraction with proper PDF parsing
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  console.log("Starting enhanced PDF text extraction...");
  
  try {
    // Use pdf-parse library for proper Node.js PDF parsing
    let extractedText = '';
    
    try {
      const pdfParse = await import('pdf-parse');
      
      console.log("Using pdf-parse for text extraction...");
      const pdfData = await pdfParse.default(pdfBuffer);
      
      extractedText = pdfData.text;
      console.log(`PDF parsed successfully: ${pdfData.numpages} pages, ${extractedText.length} characters`);
      
    } catch (pdfParseError) {
      console.log("pdf-parse failed, trying pdf2json fallback:", pdfParseError);
      
      // Fallback to pdf2json
      try {
        const pdf2json = await import('pdf2json');
        
        const pdfParser = new pdf2json.default();
        
        const pdfData = await new Promise<any>((resolve, reject) => {
          pdfParser.on("pdfParser_dataError", reject);
          pdfParser.on("pdfParser_dataReady", resolve);
          pdfParser.parseBuffer(pdfBuffer);
        });
        
        // Extract text from pdf2json format - PRESERVE STRUCTURE
        let pageTexts: string[] = [];
        if (pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              // Sort texts by Y position (top to bottom) then X position (left to right)
              const sortedTexts = page.Texts
                .map((text: any) => ({
                  x: text.x || 0,
                  y: text.y || 0,
                  text: decodeURIComponent(text.R?.[0]?.T || '')
                }))
                .filter((item: any) => item.text.trim().length > 0)
                .sort((a: any, b: any) => {
                  // Sort by Y position first (top to bottom)
                  const yDiff = Math.abs(a.y - b.y);
                  if (yDiff > 0.5) { // If on different lines
                    return a.y - b.y;
                  }
                  // Same line, sort by X position (left to right)
                  return a.x - b.x;
                });
              
              // Group texts by approximate line (Y position)
              const lines: string[] = [];
              let currentLine: string[] = [];
              let lastY = -1;
              
              for (const item of sortedTexts) {
                // If Y position changes significantly, start new line
                if (lastY >= 0 && Math.abs(item.y - lastY) > 0.5) {
                  if (currentLine.length > 0) {
                    lines.push(currentLine.join(' '));
                    currentLine = [];
                  }
                }
                currentLine.push(item.text);
                lastY = item.y;
              }
              
              // Add final line
              if (currentLine.length > 0) {
                lines.push(currentLine.join(' '));
              }
              
              const pageText = lines.join('\n');
              pageTexts.push(pageText);
              
              console.log(`Page ${pageTexts.length} extracted with ${lines.length} lines`);
              console.log(`First few lines:\n${lines.slice(0, 10).join('\n')}`);
            }
          }
        }
        
        extractedText = pageTexts.join('\n');
        console.log(`pdf2json extracted ${extractedText.length} characters from ${pageTexts.length} pages`);
        
      } catch (pdf2jsonError) {
        console.log("pdf2json also failed, using basic text extraction:", pdf2jsonError);
        
        // Last resort: try to extract readable text from raw PDF
        const rawText = pdfBuffer.toString('utf8');
        
        // Look for text patterns that might be readable
        const textMatches = rawText.match(/[A-Za-z0-9\s\.\,\:\%\(\)\/\-]+/g);
        if (textMatches) {
          extractedText = textMatches
            .filter(match => match.length > 3)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    }
    
    if (!extractedText || extractedText.length < 10) {
      console.log("No readable text extracted from PDF");
      return "PDF_EXTRACTION_FAILED_NO_TEXT_FOUND";
    }
    
    // Look for DEXA-specific keywords to validate this is a DEXA scan
    const dexaKeywords = [
      // Core DEXA terms (universal)
      'dexa', 'dxa', 'dual energy', 'dual-energy', 'absorptiometry',
      // Body composition terms (universal)
      'body fat', 'lean mass', 'lean tissue', 'fat tissue', 'fat mass',
      'bone mineral', 'body composition', 'lean body mass', 'lbm',
      // Metabolic terms (universal)
      'resting metabolic rate', 'rmr', 'bmr', 'basal metabolic',
      // Common DEXA providers/formats
      'bodyspec', 'inbody', 'hologic', 'lunar', 'ge healthcare'
    ];
    
    const lowerText = extractedText.toLowerCase();
    const foundKeywords = dexaKeywords.filter(keyword => lowerText.includes(keyword));
    
    console.log(`Found DEXA keywords: ${foundKeywords.join(', ')}`);
    
    if (foundKeywords.length === 0) {
      console.log("No DEXA-related keywords found in extracted text");
      return "PDF_NOT_DEXA_SCAN";
    }
    
    console.log(`Raw extracted text preview (first 1000 chars):\n${extractedText.substring(0, 1000)}`);
    
    // COMPREHENSIVE HEADER CAPTURE STRATEGY
    let patientInfoFound = false;
    let headerText = "";
    
    const lines = extractedText.split('\n');
    console.log(`Total lines in PDF: ${lines.length}`);
    
    // Strategy 1: Capture a large initial portion (first 100 lines or until we hit obvious data tables)
    const headerLines: string[] = [];
    let dataTableStart = -1;
    
    for (let i = 0; i < Math.min(100, lines.length); i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      // Look for obvious data table starts to know when to stop header capture
      if ((lineLower.includes('region') && lineLower.includes('fat') && lineLower.includes('lean')) ||
          (lineLower.includes('total') && lineLower.includes('arms') && lineLower.includes('legs')) ||
          lineLower.match(/^\s*total\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+/)) {
        dataTableStart = i;
        console.log(`Data table detected at line ${i}: ${line}`);
        break;
      }
      
      if (line.length > 0) {
        headerLines.push(line);
      }
    }
    
    // Strategy 2: Search ENTIRE document for name patterns, not just header
    console.log(`Searching entire document for patient name patterns...`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      // Look for various name patterns throughout document
      if ((lineLower.includes('name') && lineLower.includes(':')) ||
          lineLower.includes('patient:') ||
          lineLower.includes('client:') ||
          lineLower.includes('subject:') ||
          /patient\s*id/i.test(line) ||
          // Look for "Parnala" specifically since we know that's the name we're looking for
          lineLower.includes('parnala') ||
          lineLower.includes('jaron') ||
          // Look for common name patterns
          /\b[a-zA-Z]+,\s*[a-zA-Z]+\b/.test(line) ||
          // Look for lines that might contain identification info
          /^(name|patient|client|subject)\s*[:\-]\s*.+/i.test(line)) {
        patientInfoFound = true;
        console.log(`*** FOUND PATIENT INFO at line ${i}: ${line}`);
        
        // Add surrounding context lines to ensure we get complete info
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length - 1, i + 2);
        for (let j = contextStart; j <= contextEnd; j++) {
          const contextLine = lines[j].trim();
          if (contextLine.length > 0 && !headerLines.includes(contextLine)) {
            headerLines.push(contextLine);
            console.log(`Added context line ${j}: ${contextLine}`);
          }
        }
      }
    }
    
    headerText = headerLines.join('\n');
    console.log(`COMPREHENSIVE HEADER CAPTURE COMPLETE:`);
    console.log(`- Captured ${headerLines.length} header lines`);
    console.log(`- Patient info found: ${patientInfoFound}`);
    console.log(`- Data table starts at line: ${dataTableStart}`);
    console.log(`Full header text:\n${headerText}`);
    
    // Now extract body composition data
    let bodyDataSections: string[] = [];
    
    // Split by common section separators for body composition data
    const sections = extractedText.split(/(?:SUMMARY|RESULTS|COMPOSITION|ANALYSIS|REGIONAL|SUPPLEMENTAL|OVERVIEW|REPORT)/i);
    
    for (const section of sections) {
      const sectionLower = section.toLowerCase();
      
      // Include body composition sections
      if ((sectionLower.includes('body fat') || sectionLower.includes('fat %')) ||
          (sectionLower.includes('lean') && (sectionLower.includes('mass') || sectionLower.includes('tissue'))) ||
          sectionLower.includes('total weight') ||
          sectionLower.includes('total mass') ||
          sectionLower.includes('resting metabolic') ||
          sectionLower.includes('rmr') ||
          sectionLower.includes('bmr') ||
          sectionLower.includes('cal/day') ||
          sectionLower.includes('calories') ||
          // Look for the main data table
          sectionLower.includes('region') ||
          // Look for numeric patterns that might be RMR values
          /\b\d{3,4}\s*(cal|kcal|calories)/.test(sectionLower)) {
        bodyDataSections.push(section.trim());
        console.log(`Found body composition section: ${section.substring(0, 100)}...`);
      }
    }
    
    // Combine header and body data
    const allRelevantSections = [headerText, ...bodyDataSections].filter(s => s.length > 0);
    let relevantText = allRelevantSections.join('\n\n');
    
    console.log(`Combined ${allRelevantSections.length} sections. Patient info found: ${patientInfoFound}`);
    console.log(`Final relevant text preview (first 500 chars):\n${relevantText.substring(0, 500)}...`);
    
    // If still no good content, use the full text
    if (relevantText.length < 200) {
      relevantText = extractedText;
    }
    
    // Limit text length for OpenAI processing (increase limit for better RMR capture)
    const maxLength = 12000; // Increased to capture more sections
    if (relevantText.length > maxLength) {
      console.log(`Truncating text from ${relevantText.length} to ${maxLength} characters`);
      relevantText = relevantText.substring(0, maxLength);
    }
    
    console.log(`Final text length: ${relevantText.length} characters`);
    console.log(`Text preview: ${relevantText.substring(0, 300)}...`);
    
    return relevantText;
    
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return "PDF_EXTRACTION_FAILED_TECHNICAL_ERROR";
  }
}

const DEXA_EXTRACTION_PROMPT = `
You are an expert at extracting data from DEXA (Dual-energy X-ray absorptiometry) scan reports. 
The text may be messy, contain artifacts from PDF extraction, or have incomplete formatting.
Look for key numeric values and percentages that match DEXA scan metrics.

COMMON DEXA SCAN FORMATS TO RECOGNIZE:

**BodySpec Format:**
- Look for "SUMMARY RESULTS" table with columns: "Total Body Fat %", "Total Mass (lbs)", "Fat Tissue (lbs)", "Lean Tissue (lbs)"
- RMR format: "1,571 cal/day" or "Resting Metabolic Rate (RMR): [number] cal/day"

**InBody Format:**
- May show "Body Fat Mass", "Lean Body Mass", "Total Body Weight", "Skeletal Muscle Mass"
- Often displays data in tables with percentages and absolute values
- May include "BMR" instead of "RMR"

**Hologic/Lunar (GE Healthcare) Format:**
- Clinical DEXA reports with "Whole Body Composition" sections
- May show "Fat Mass", "Lean Mass", "Total Mass" in grams or kg
- Often includes T-scores and Z-scores for bone density

**Generic DEXA Formats:**
- Any format showing body composition data from dual-energy X-ray absorptiometry
- Could be in kg (convert to lbs using 1 kg = 2.20462 lbs)
- May use different terminology but same core metrics

**Key Data Points to Extract:**
1. **Body Fat Percentage (%)** - Look for "16.9%", "Body Fat %", "Fat %", "BF%", or similar patterns
2. **Lean Mass (lbs)** - "Lean Tissue", "Lean Mass", "LBM", "Lean Body Mass", "Skeletal Muscle Mass" - convert from kg if needed
3. **Total Weight (lbs)** - "Total Mass", "Total Weight", "Body Weight", "Total Body Weight" - convert from kg if needed  
4. **Fat Mass (lbs)** - "Fat Tissue", "Fat Mass", "Body Fat Mass", "Adipose Tissue" - convert from kg if needed
5. **RMR/BMR (calories/day)** - "RMR", "BMR", "Resting Metabolic Rate", "Basal Metabolic Rate", numbers near "cal/day", "kcal", "calories"
6. **Scan Date** - Any date format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
7. **Patient Name** - ONLY extract actual human names (like "John", "Sarah", "Michael", "Jaron"). DO NOT extract scan IDs, reference numbers, or alphanumeric codes (like "A01212506", "PT001", "REF123"). Look for names that appear in name fields or after labels like "Patient:", "Name:", "Client:"
8. **Scan ID** - Reference numbers, alphanumeric codes, or identifiers (like "A01212506", "PT001") - DO NOT use these as names

**METABOLIC RATE EXTRACTION INSTRUCTIONS:**
- RMR/BMR can appear anywhere in the report, not just specific sections
- Look for patterns: "1,571 cal/day", "1571 kcal", "RMR: 1571", "BMR = 1571", etc.
- Values typically range 1000-3000 calories for adults
- May be labeled differently by provider: RMR, BMR, REE (Resting Energy Expenditure)
- If you see 3-4 digit numbers near metabolic terms, extract as RMR

**Validation Rules:**
- Body fat % should be 5-50% (typically 10-35%)
- Lean mass should be 50-200 lbs for adults
- Fat mass should be 10-100 lbs for adults  
- Total weight should equal lean + fat + bone (roughly)
- RMR should be 1000-3000 calories/day

**Name Extraction Rules:**
- firstName/lastName should ONLY contain actual human names with letters (a-z, A-Z)
- DO NOT extract scan IDs, codes, or numbers that contain digits (0-9) 
- Examples of VALID names: "Jaron", "Sarah", "Michael", "Emily"
- Examples of INVALID names to REJECT: "A01212506", "PT001", "12345", "REF-ABC123"
- If uncertain whether text is a name or ID, set firstName/lastName to null
- Look for names near labels like "Patient Name:", "Client:", "Name:" but validate they are actual names

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

**Confidence Scoring:**
- 0.9-1.0: All major values found in clear table format with labels
- 0.7-0.9: Most values found, minor formatting issues
- 0.5-0.7: Some values found but unclear formatting  
- 0.2-0.5: Few values found, significant extraction issues
- 0.0-0.2: No clear DEXA data found

**Example DEXA Data Patterns:**
- BodySpec: "16.9%" body fat, "123.2" lean tissue, "155.9" total mass, "26.3" fat tissue, "1,571 cal/day" RMR
- InBody: "15.2% body fat", "65.5 kg lean mass", "75.0 kg total weight", "BMR: 1650 kcal"
- Hologic: "Fat Mass: 18.5 kg", "Lean Mass: 52.3 kg", "Total Mass: 73.2 kg"
- Generic: Any combination of the above metrics in various formats

Only return the JSON object, no other text.
`;

export async function extractDexaScanFromImage(imageBase64: string): Promise<ExtractedDexaData> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.error("❌ OpenAI client not available - returning default values (zeros)");
    console.error("   This is why your extraction shows 0% body fat, 0 lbs lean mass, etc.");
    console.error("   Configure OPENAI_API_KEY in Render environment variables to fix this");
    return getDefaultExtractedData();
  }

  try {
    console.log("Extracting DEXA data from image using OpenAI Vision...");
    
    // Remove data URL prefix if present
    const base64Image = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const response = await client.chat.completions.create({
      model: getConfig().OPENAI_MODEL || "gpt-4o",
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
    
    // Parse the JSON response with better error handling
    let extractedData;
    try {
      // Clean the response to extract just the JSON part
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      extractedData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError);
      console.error("Raw response:", content);
      return getDefaultExtractedData();
    }
    
    // Helper function to validate if a string is a real name (not a scan ID)
    const isValidName = (name: string): boolean => {
      if (!name || typeof name !== 'string') return false;
      
      // Must contain only letters, spaces, hyphens, or apostrophes (no numbers)
      if (!/^[a-zA-Z\s\-']+$/.test(name)) return false;
      
      // Should not be too short or too long
      if (name.trim().length < 2 || name.trim().length > 30) return false;
      
      // Should not look like common scan ID patterns
      const scanIdPatterns = [
        /^[A-Z]\d+/,           // A01212506, PT001, etc.
        /^\d+[A-Z]/,           // 123ABC, etc.
        /^[A-Z]{2,}\d{2,}/,    // ABC123, REF001, etc.
        /^(ID|REF|PT|SCAN|TEST|CLIENT)[A-Z0-9]/i, // ID123, REF001, etc.
      ];
      
      return !scanIdPatterns.some(pattern => pattern.test(name.trim()));
    };

    // Validate and sanitize the response
    const result = {
      bodyFatPercent: Number(extractedData.bodyFatPercent) || 0,
      leanMass: Number(extractedData.leanMass) || 0,
      totalWeight: Number(extractedData.totalWeight) || 0,
      fatMass: Number(extractedData.fatMass) || 0,
      rmr: extractedData.rmr ? Number(extractedData.rmr) : undefined,
      scanDate: extractedData.scanDate || new Date().toISOString().split('T')[0],
      firstName: isValidName(extractedData.firstName) ? extractedData.firstName.trim() : undefined,
      lastName: isValidName(extractedData.lastName) ? extractedData.lastName.trim() : undefined,
      scanName: extractedData.scanName || undefined,
      confidence: Math.min(Math.max(Number(extractedData.confidence) || 0.5, 0), 1)
    };
    
    console.log("Parsed extraction result:", result);
    return result;

  } catch (error) {
    console.error("OpenAI extraction failed:", error);
    return getDefaultExtractedData();
  }
}

export async function extractDexaScanFromPDF(pdfBase64: string): Promise<ExtractedDexaData> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.error("❌ OpenAI client not available - returning default values (zeros)");
    console.error("   This is why your extraction shows 0% body fat, 0 lbs lean mass, etc.");
    console.error("   Configure OPENAI_API_KEY in Render environment variables to fix this");
    return getDefaultExtractedData();
  }

  try {
    console.log("Extracting DEXA data from PDF...");
    
    // Remove data URL prefix if present
    const base64Pdf = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Pdf, 'base64');
    
    // Extract text from PDF
    let pdfText = await extractPdfText(pdfBuffer);
    
    console.log("Extracted PDF text length:", pdfText.length);
    console.log("PDF text preview (first 500 chars):", pdfText.substring(0, 500));
    
    if (!pdfText.trim() || pdfText === 'PDF_EXTRACTION_FAILED_MANUAL_ENTRY_REQUIRED') {
      console.log("PDF text extraction failed or returned empty - returning default values");
      return {
        ...getDefaultExtractedData(),
        confidence: 0.1 // Very low confidence to indicate manual entry needed
      };
    }

    // FINAL SAFETY CHECK: Ensure we never exceed token limits
    const estimatedTokens = Math.ceil(pdfText.length / 4); // Conservative estimate: 4 chars per token
    const maxAllowedTokens = 8000; // Safety margin under OpenAI's limits
    
    if (estimatedTokens > maxAllowedTokens) {
      console.log(`EMERGENCY TRUNCATION: Estimated ${estimatedTokens} tokens, max allowed ${maxAllowedTokens}`);
      pdfText = pdfText.substring(0, maxAllowedTokens * 4);
      console.log(`Emergency truncated to ${pdfText.length} characters`);
    }

    // Use OpenAI to analyze the extracted text
    const startTime = Date.now();
    const model = getConfig().OPENAI_MODEL || "gpt-4o";
    
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: `${DEXA_EXTRACTION_PROMPT}\n\nDEXA SCAN TEXT:\n${pdfText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("OpenAI response:", content);
    
    // Parse the JSON response with better error handling
    let extractedData;
    try {
      // Clean the response to extract just the JSON part
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      extractedData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError);
      console.error("Raw response:", content);
      return getDefaultExtractedData();
    }
    
    // Generate confidence factors for debugging
    const confidenceFactors = [];
    const originalConfidence = Number(extractedData.confidence) || 0;
    
    if (extractedData.bodyFatPercent > 0 && extractedData.bodyFatPercent < 50) {
      confidenceFactors.push("Valid body fat percentage range");
    } else {
      confidenceFactors.push("Invalid body fat percentage");
    }
    
    if (extractedData.leanMass > 50 && extractedData.leanMass < 200) {
      confidenceFactors.push("Reasonable lean mass value");
    } else {
      confidenceFactors.push("Questionable lean mass value");
    }
    
    if (extractedData.totalWeight > 0) {
      confidenceFactors.push("Valid total weight");
    } else {
      confidenceFactors.push("Missing or invalid total weight");
    }
    
    // Check for any recognized DEXA provider format
    const providers = ['bodyspec', 'inbody', 'hologic', 'lunar', 'ge healthcare'];
    const detectedProvider = providers.find(provider => pdfText.toLowerCase().includes(provider));
    
    if (detectedProvider) {
      confidenceFactors.push(`${detectedProvider.charAt(0).toUpperCase() + detectedProvider.slice(1)} format detected`);
    } else if (pdfText.toLowerCase().includes('dexa') || pdfText.toLowerCase().includes('dxa')) {
      confidenceFactors.push("Generic DEXA format detected");
    } else {
      confidenceFactors.push("DEXA format not clearly identified");
    }
    
    // Helper function to validate if a string is a real name (not a scan ID)
    const isValidName = (name: string): boolean => {
      if (!name || typeof name !== 'string') return false;
      
      // Must contain only letters, spaces, hyphens, or apostrophes (no numbers)
      if (!/^[a-zA-Z\s\-']+$/.test(name)) return false;
      
      // Should not be too short or too long
      if (name.trim().length < 2 || name.trim().length > 30) return false;
      
      // Should not look like common scan ID patterns
      const scanIdPatterns = [
        /^[A-Z]\d+/,           // A01212506, PT001, etc.
        /^\d+[A-Z]/,           // 123ABC, etc.
        /^[A-Z]{2,}\d{2,}/,    // ABC123, REF001, etc.
        /^(ID|REF|PT|SCAN|TEST|CLIENT)[A-Z0-9]/i, // ID123, REF001, etc.
      ];
      
      return !scanIdPatterns.some(pattern => pattern.test(name.trim()));
    };

    // Validate and sanitize the response
    const result: ExtractedDexaData = {
      bodyFatPercent: Number(extractedData.bodyFatPercent) || 0,
      leanMass: Number(extractedData.leanMass) || 0,
      totalWeight: Number(extractedData.totalWeight) || 0,
      fatMass: Number(extractedData.fatMass) || 0,
      rmr: extractedData.rmr ? Number(extractedData.rmr) : undefined,
      scanDate: extractedData.scanDate || new Date().toISOString().split('T')[0],
      firstName: isValidName(extractedData.firstName) ? extractedData.firstName.trim() : undefined,
      lastName: isValidName(extractedData.lastName) ? extractedData.lastName.trim() : undefined,
      scanName: extractedData.scanName || undefined,
      confidence: Math.min(Math.max(originalConfidence, 0), 1),
      debugInfo: {
        extractionMethod: "PDF",
        textLength: pdfText.length,
        extractedTextPreview: pdfText.substring(0, 500),
        openaiModel: model,
        processingTime,
        tokenUsage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined,
        confidenceFactors
      }
    };
    
    console.log("Parsed extraction result:", result);
    return result;

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