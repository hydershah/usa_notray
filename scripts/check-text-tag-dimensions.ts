import { db } from '../server/db';
import { documentTags } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Script to check and update text tag dimensions in the database
 * This will find all text tags and update them to 200x40 dimensions
 */
export async function checkAndUpdateTextTagDimensions() {
  console.log('🔍 Checking text tag dimensions in database...');
  
  try {
    // Get all text tags
    const textTags = await db
      .select({
        id: documentTags.id,
        width: documentTags.width,
        height: documentTags.height,
        content: documentTags.content,
        documentId: documentTags.documentId
      })
      .from(documentTags)
      .where(eq(documentTags.tagType, 'T'));
    
    console.log(`📊 Found ${textTags.length} text tags in database`);
    
    // Show current dimensions
    console.log('\n📋 Current text tag dimensions:');
    textTags.forEach(tag => {
      console.log(`  Tag ${tag.id} (Doc ${tag.documentId}): ${tag.width}x${tag.height}`);
    });
    
    // Find tags that need updating (not 200x40)
    const tagsToUpdate = textTags.filter(tag => tag.width !== 200 || tag.height !== 40);
    
    console.log(`\n🔄 Found ${tagsToUpdate.length} text tags that need updating`);
    
    if (tagsToUpdate.length > 0) {
      console.log('\n📝 Updating text tags to 200x40...');
      
      let updatedCount = 0;
      
      for (const tag of tagsToUpdate) {
        console.log(`  Updating tag ${tag.id}: ${tag.width}x${tag.height} -> 200x40`);
        
        await db
          .update(documentTags)
          .set({
            width: 200,
            height: 40,
            updatedAt: new Date()
          })
          .where(eq(documentTags.id, tag.id));
        
        updatedCount++;
      }
      
      console.log(`✅ Successfully updated ${updatedCount} text tags to 200x40`);
    } else {
      console.log('✅ All text tags already have correct dimensions (200x40)');
    }
    
    // Verify the update
    const updatedTags = await db
      .select({
        id: documentTags.id,
        width: documentTags.width,
        height: documentTags.height
      })
      .from(documentTags)
      .where(eq(documentTags.tagType, 'T'));
    
    console.log('\n📋 Updated text tag dimensions:');
    updatedTags.forEach(tag => {
      console.log(`  Tag ${tag.id}: ${tag.width}x${tag.height}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to check/update text tag dimensions:', error);
    throw error;
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkAndUpdateTextTagDimensions()
    .then(() => {
      console.log('✅ Text tag dimensions check/update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Text tag dimensions check/update failed:', error);
      process.exit(1);
    });
} 