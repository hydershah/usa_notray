# Tagged Document Workflow - Corrected Implementation

## **Understanding from Requirements Document**

Based on the EDITOR_TAGGING_SYSTEM_REQUIREMENTS.md, the correct workflow is:

### **Two-Phase System:**
1. **📋 Tagging Phase**: Tags are **temporary placeholders** that mark WHERE content should be placed
2. **✍️ Live Signing Phase**: Tags get replaced with actual content (signatures, names, etc.)

## **Corrected Implementation**

### **Phase 1: Tagging Session Completion**
When you click "Complete Tagging":

✅ **What happens:**
- Tags are saved as database records in `document_tags` table
- Session status updated to 'completed'
- **Original PDF remains unchanged** - no visual rendering yet
- Tagged document configuration saved for live signing

❌ **What does NOT happen:**
- No final PDF generation (this was my mistake)
- No visual rendering of tags to PDF

### **Phase 2: Live Signing Session Completion**  
When live signing session is completed:

✅ **What happens:**
- Load original PDF + tag metadata from database
- Replace tags with real content from user profiles
- Generate final signed PDF with all content applied
- Save to `uploads/signed/session_[sessionId]_signed.pdf`

## **Where the "Tagged Document" is Saved**

The **tagged document** consists of:

1. **Original PDF** (unchanged file in `uploads/` directory)
2. **Tag metadata** (database records in `document_tags` table)

### **Database Location:**
```sql
-- Tags are stored in the document_tags table
SELECT * FROM document_tags WHERE session_id = '[sessionId]';
```

### **File Locations:**
- **Original PDF**: `uploads/[original-filename].pdf` (unchanged)
- **Tagged document**: Database records + original PDF
- **Final signed PDF**: `uploads/signed/session_[sessionId]_signed.pdf` (generated after live signing)

## **API Endpoints:**

### **Tagging Session:**
- `POST /api/editor/session/:sessionId/complete` 
  - Returns: `{ taggedDocumentReady: true, tagsPlaced: N }`
  - No PDF generation

### **Live Signing Session:**
- `POST /api/editor/session/:sessionId/complete`
  - Returns: `{ downloadUrl: "/api/documents/signed/session_[sessionId]_signed.pdf" }`
  - Generates final PDF

### **Download URLs:**
- **Signed documents**: `/api/documents/signed/[fileName]`

## **Workflow Summary:**

1. **Job Creation** → Upload original PDFs
2. **Tagging Session** → Place tags as database records → Complete tagging
3. **Tagged Document** = Original PDF + tag metadata in database
4. **Live Signing Session** → Load tagged document → Replace tags with real content → Generate final PDF
5. **Final Result** = Signed PDF with all content applied

## **Key Insight:**

The "tagged document" is **not a separate PDF file** - it's the **original PDF plus tag metadata**. The visual representation of tags (as placeholders) is only shown in the UI during the tagging phase. The real content replacement and final PDF generation happens during the live signing phase.

This aligns with the requirements document's emphasis on the two-phase workflow where tags are temporary placeholders that get replaced with actual content.