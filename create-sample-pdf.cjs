const fs = require('fs');
const path = require('path');

// Create a minimal PDF for testing
const samplePdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 150
>>
stream
BT
/F1 24 Tf
50 700 Td
(USA Notary - Sample Document) Tj
0 -50 Td
/F1 12 Tf
(This is a sample PDF for testing purposes.) Tj
0 -20 Td
(The requested document is temporarily unavailable.) Tj
0 -20 Td
(Please try again or contact support.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000110 00000 n 
0000000334 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
535
%%EOF`;

const samplePdfPath = path.resolve('uploads/sample-document.pdf');

fs.writeFileSync(samplePdfPath, samplePdfContent, 'binary');
console.log(`✅ Created sample PDF: ${samplePdfPath}`);

// Also create the specific path structure for the problematic document
const specificPath = path.resolve('uploads/development/document/2025/07/notarizations/job-56');
fs.mkdirSync(specificPath, { recursive: true });

const specificFile = path.join(specificPath, '20250712_doc_cqyxsu_job56_BlueAssure_Platform_Integratio.pdf');
fs.writeFileSync(specificFile, samplePdfContent, 'binary');
console.log(`✅ Created fallback PDF: ${specificFile}`);

console.log('✅ Sample PDFs created for testing!'); 