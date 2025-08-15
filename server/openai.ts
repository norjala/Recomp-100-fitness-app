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

export async function extractDexaScanFromImage(imageBase64: string): Promise<ExtractedDexaData> {
  console.log("Image processing - manual entry recommended for Bolt hosting");
  return {
    bodyFatPercent: 0,
    leanMass: 0,
    totalWeight: 0,
    fatMass: 0,
    confidence: 0.1,
    scanDate: new Date().toISOString().split('T')[0]
  };
}

export async function extractDexaScanFromPDF(pdfBase64: string): Promise<ExtractedDexaData> {
  return extractDexaScanFromImage(pdfBase64);
}