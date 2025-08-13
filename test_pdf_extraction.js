import fs from 'fs';
import { extractDexaScanFromPDF } from './server/openai.ts';

// Test PDF extraction directly
async function testPDFExtraction() {
  try {
    console.log('Testing PDF extraction...');
    
    // Read the PDF file
    const pdfBuffer = fs.readFileSync('attached_assets/bodyspec-results_1755050724620.pdf');
    console.log('PDF size:', pdfBuffer.length, 'bytes');
    
    const result = await extractDexaScanFromPDF(pdfBuffer);
    
    console.log('PDF Extraction Result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error testing PDF extraction:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPDFExtraction();