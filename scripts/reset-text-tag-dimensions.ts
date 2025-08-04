#!/usr/bin/env node

/**
 * Script to reset all text tag dimensions to 200x30
 */

import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { documentTags } from '../shared/schema';

export async function resetTextTagDimensions() {
  console.log('🔧 Resetting all text tag dimensions to 200x30...');
  
  try {
    // Update all text tags to have 200x30 dimensions
    const result = await db
      .update(documentTags)
      .set({
        width: 200,
        height: 30,
        updatedAt: new Date()
      })
      .where(eq(documentTags.tagType, 'T'))
      .returning({
        id: documentTags.id,
        width: documentTags.width,
        height: documentTags.height,
        xPosition: documentTags.xPosition,
        yPosition: documentTags.yPosition
      });

    console.log(`✅ Updated ${result.length} text tags to 200x30 dimensions`);
    
    if (result.length > 0) {
      console.log('📊 Updated tags:');
      result.forEach(tag => {
        console.log(`  - Tag ${tag.id}: ${tag.width}x${tag.height} at (${tag.xPosition}, ${tag.yPosition})`);
      });
    } else {
      console.log('ℹ️  No text tags found to update');
    }

    // Fetch all current text tags to verify
    const allTextTags = await db
      .select({
        id: documentTags.id,
        width: documentTags.width,
        height: documentTags.height,
        xPosition: documentTags.xPosition,
        yPosition: documentTags.yPosition,
        pageNumber: documentTags.pageNumber
      })
      .from(documentTags)
      .where(eq(documentTags.tagType, 'T'))
      .orderBy(documentTags.id);

    console.log('\n📋 Current text tag dimensions:');
    allTextTags.forEach(tag => {
      const status = (tag.width === 200 && tag.height === 30) ? '✅' : '❌';
      console.log(`  ${status} Tag ${tag.id}: ${tag.width}x${tag.height} at (${tag.xPosition}, ${tag.yPosition}) page ${tag.pageNumber}`);
    });
    
  } catch (error) {
    console.error('❌ Error resetting text tag dimensions:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetTextTagDimensions()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
} 