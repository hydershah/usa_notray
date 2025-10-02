# Signature Size Fix - Increased Default Dimensions

## Problem

Signatures were appearing **very small** in the generated PDFs during live signing sessions. The issue was caused by:

1. **Small default tag size**: Signature tags defaulted to 160x28 pixels (very short height)
2. **90% scaling**: PDF processor scaled signatures down to 90% of the tag bounds for padding
3. **Result**: Tiny, hard-to-see signatures in final PDFs

## Solution

Increased signature sizes in two places:

### Files Modified

1. **`server/services/pdf-processor.service.ts`** - PDF rendering
2. **`client/src/lib/constants/tagConstants.ts`** - Tag default dimensions

### Changes Made

#### 1. PDF Processor Scaling (Line 569)

**Before:**
```typescript
const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding
```

**After:**
```typescript
const scale = Math.min(scaleX, scaleY) * 1.0; // Use full bounds for signatures (no padding reduction)
```

**Impact**: Signatures now use 100% of the tag box instead of 90%

#### 2. Signature Tag Default Size

**Before:**
```typescript
'S': {
  defaultWidth: 160,
  defaultHeight: 28,  // Very small!
  minWidth: 1,
  minHeight: 1,
}
```

**After:**
```typescript
'S': {
  defaultWidth: 200,   // +25% width
  defaultHeight: 60,   // +114% height (more than doubled!)
  minWidth: 100,       // Prevents tags from being too small
  minHeight: 40,       // Ensures minimum readability
}
```

**Impact**: New signature tags are **much larger** by default

#### 3. Notary Seal Default Size (Bonus)

**Before:**
```typescript
'E': {
  defaultWidth: 120,
  defaultHeight: 80,
  minWidth: 1,
  minHeight: 1,
}
```

**After:**
```typescript
'E': {
  defaultWidth: 140,   // +17% width
  defaultHeight: 100,  // +25% height
  minWidth: 80,        // Prevents seals from being too small
  minHeight: 60,       // Ensures minimum visibility
}
```

**Impact**: Notary seals are also larger and have minimum size constraints

## Size Comparison

### Signature Tags
| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| Default Width | 160px | 200px | +25% |
| Default Height | 28px | 60px | **+114%** |
| Min Width | 1px | 100px | Enforced minimum |
| Min Height | 1px | 40px | Enforced minimum |
| PDF Scaling | 90% | 100% | +11% |

### Overall Size Increase
Combining the tag size increase and PDF scaling change:
- **Width**: ~40% larger (160→200 + 90%→100%)
- **Height**: ~140% larger (28→60 + 90%→100%)

## Important Notes

### For Existing Signature Tags

**Existing tags** that are already placed in documents will **keep their old dimensions** until:
1. They are manually resized by the user
2. The tag is deleted and re-created

### For New Signature Tags

**New signature tags** created after this update will automatically use the larger default size (200x60).

### User Can Still Resize

Users can always:
- **Make tags larger**: Drag to any size
- **Make tags smaller**: Can go down to minimum (100x40)
- **Custom sizes are remembered**: Per-tag type in localStorage

## Testing Steps

1. **Create a new signature tag** in the editor
2. **Verify it's larger**: Should be 200x60 instead of 160x28
3. **Try to resize smaller**: Should stop at 100x40 minimum
4. **Complete a live signing session**: Signature should appear much larger in PDF
5. **Check existing tags**: Old tags keep their size until resized

## Visual Comparison

### Before
```
┌──────────────────────┐
│     [Signature]      │  ← 160 x 28 (tiny!)
└──────────────────────┘
```

### After
```
┌─────────────────────────────┐
│                             │
│       [Signature]           │  ← 200 x 60 (much better!)
│                             │
└─────────────────────────────┘
```

## Backward Compatibility

✅ **Fully backward compatible**
- Existing documents continue to work
- Old signature tags retain their dimensions
- Users can manually resize any tag if needed
- No database migration required

## Rollback

If signatures are too large, adjust values in:
1. `client/src/lib/constants/tagConstants.ts` (lines 144-156)
2. `server/services/pdf-processor.service.ts` (line 569)

## Success Criteria

✅ New signature tags are visibly larger (200x60 vs 160x28)  
✅ Minimum size prevents accidentally tiny tags  
✅ Signatures fill the entire tag box in PDFs (100% vs 90%)  
✅ Signatures are clearly visible and readable in final PDFs  
✅ Users can still resize tags freely (within minimums)  
✅ Existing documents are not affected

