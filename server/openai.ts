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

// Simplified extraction for Bolt hosting
export async function extractDexaScanFromImage(imageBase64: string): Promise<ExtractedDexaData> {
  console.log("Image processing - manual entry recommended for Bolt hosting");
  
  // For Bolt hosting, return empty data to encourage manual entry
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

export async function extractDexaScanFromPDF(pdfBase64: string): Promise<ExtractedDexaData> {
  console.log("PDF processing - manual entry recommended for Bolt hosting");
  
  // For Bolt hosting, return empty data to encourage manual entry
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

  return {
    bodyFatPercent,
    leanMass,
    totalWeight,
    fatMass,
    rmr,
    scanName,
    firstName,
    lastName,
    scanDate: scanDate || new Date().toISOString().split('T')[0],
    confidence
  };
}