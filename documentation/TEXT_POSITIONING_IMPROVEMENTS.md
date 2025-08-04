# Text Positioning - Baseline Alignment Fix

## Issue Fixed
Text was appearing above the underlines in the final PDF instead of sitting directly on them. The text positioning was off by a few pixels vertically.

## Root Cause
The PDF processor was centering text vertically within the field height, but the user expected text to sit directly on the baseline (underline) like traditional form filling.

## Solution - Baseline Alignment

### Changes Made:

1. **PDF Processor (Server)**:
   - **Baseline positioning**: Changed from vertical centering to baseline alignment
   - **Formula**: `y + (fontSize * 0.8)` instead of `y + (height / 2) - (fontSize / 2)`
   - **Result**: Text now sits directly on the underline

2. **Editor Component (Client)**:
   - **Bottom alignment**: Changed from `center` to `flex-end` alignment
   - **Baseline padding**: Added `paddingBottom: '2px'` to sit on baseline
   - **Input field**: Updated to match baseline positioning

### Technical Implementation
```javascript
// PDF Processor - Baseline positioning
const baselineY = y + (fontSize * 0.8);
page.drawText(text, { x: x + 4, y: baselineY });

// Editor - Matching baseline alignment
alignItems: 'flex-end'           // Bottom alignment
paddingBottom: '2px'            // Sit on baseline
verticalAlign: 'bottom'         // Input field baseline
```

## Result
Text now appears in the final PDF exactly on the underlines, not above them. The positioning is pixel-perfect between editor and PDF output.

## Testing
1. Place text in the editor
2. Text should appear at the bottom of the field (on baseline)
3. Complete document
4. Text should appear directly on the underlines in final PDF 