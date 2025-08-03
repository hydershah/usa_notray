import { db } from '../server/db';
import { documentTags } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Migration script to update all existing text tags to use compact dimensions
 * This fixes the issue where text tags were created with large dimensions (305x95)
 * and need to be updated to the new compact size (60x12)
 */
export async function updateTextTagDimensions() {
  console.log('🔄 Starting text tag dimensions migration...');
  
  try {
    // Get all text tags with old dimensions
    const oldTextTags = await db
      .select()
      .from(documentTags)
      .where(eq(documentTags.tagType, 'T'));
    
    console.log(`📊 Found ${oldTextTags.length} text tags to update`);
    
    let updatedCount = 0;
    
    for (const tag of oldTextTags) {
      // Check if this tag has old dimensions (width > 100 or height > 30)
      if (tag.width > 100 || tag.height > 30) {
        console.log(`🔄 Updating text tag ${tag.id}: ${tag.width}x${tag.height} -> 60x12`);
        
        await db
          .update(documentTags)
          .set({
            width: 60,
            height: 12,
            updatedAt: new Date()
          })
          .where(eq(documentTags.id, tag.id));
        
        updatedCount++;
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} text tags to compact dimensions`);
    console.log(`📊 Summary: ${oldTextTags.length} total text tags, ${updatedCount} updated`);
    
  } catch (error) {
    console.error('❌ Failed to update text tag dimensions:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateTextTagDimensions()
    .then(() => {
      console.log('✅ Text tag dimensions migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Text tag dimensions migration failed:', error);
      process.exit(1);
    });
} 