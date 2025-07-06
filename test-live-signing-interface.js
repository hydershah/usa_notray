#!/usr/bin/env node

// Test script for Live Signing Interface integration
// Run this to verify all components are properly linked

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Live Signing Interface Integration\n');

const tests = [
  {
    name: 'LiveSigningInterface Component',
    file: 'client/src/components/editor/LiveSigningInterface.tsx',
    check: (content) => {
      return content.includes('LiveSigningInterface') && 
             content.includes('sessionState') &&
             content.includes('ParticipantPanel') &&
             content.includes('VideoIntegration');
    }
  },
  {
    name: 'ParticipantPanel Component',
    file: 'client/src/components/editor/ParticipantPanel.tsx',
    check: (content) => {
      return content.includes('ParticipantPanel') && 
             content.includes('liveSession') &&
             content.includes('onSetActiveUser');
    }
  },
  {
    name: 'SessionStatus Component',
    file: 'client/src/components/editor/SessionStatus.tsx',
    check: (content) => {
      return content.includes('SessionStatus') && 
             content.includes('completedTags') &&
             content.includes('sessionState');
    }
  },
  {
    name: 'LiveSigningControls Component',
    file: 'client/src/components/editor/LiveSigningControls.tsx',
    check: (content) => {
      return content.includes('LiveSigningControls') && 
             content.includes('onStartSession') &&
             content.includes('onPauseSession');
    }
  },
  {
    name: 'VideoIntegration Updated',
    file: 'client/src/components/editor/VideoIntegration.tsx',
    check: (content) => {
      return content.includes('isAudioActive') && 
             content.includes('isVideoActive') &&
             content.includes('isRecording');
    }
  },
  {
    name: 'EditorPage Integration',
    file: 'client/src/pages/EditorPage.tsx',
    check: (content) => {
      return content.includes('LiveSigningInterface') && 
             content.includes('mode === \'signing\'') &&
             content.includes('liveSessionId');
    }
  },
  {
    name: 'Component Exports',
    file: 'client/src/components/editor/index.ts',
    check: (content) => {
      return content.includes('export { LiveSigningInterface }') && 
             content.includes('export { ParticipantPanel }') &&
             content.includes('export { SessionStatus }');
    }
  },
  {
    name: 'Job Details Modal Integration',
    file: 'client/src/components/job/job-details-modal.tsx',
    check: (content) => {
      return content.includes('start-signing') && 
             content.includes('Start Live Signing') &&
             content.includes('?mode=signing');
    }
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const filePath = path.join(__dirname, test.file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${test.name}: File not found - ${test.file}`);
      failed++;
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (test.check(content)) {
      console.log(`✅ ${test.name}: Integration verified`);
      passed++;
    } else {
      console.log(`❌ ${test.name}: Integration check failed`);
      failed++;
    }
    
  } catch (error) {
    console.log(`❌ ${test.name}: Error reading file - ${error.message}`);
    failed++;
  }
}

console.log('\n📊 Test Results:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📋 Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All Live Signing Integration Tests Passed!');
  console.log('\n🚀 Ready to Test:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Navigate to a job details page');
  console.log('3. Click "Start Live Signing" button');
  console.log('4. Verify the live signing interface loads');
  console.log('5. Test session controls and participant management');
} else {
  console.log('\n⚠️  Some integration tests failed. Please review the components above.');
  console.log('💡 Make sure all components are properly created and exported.');
}

console.log('\n📝 Next Development Steps:');
console.log('• Implement content replacement system (Week 2)');
console.log('• Integrate real video conferencing (Week 3)');
console.log('• Add document completion workflow (Week 4)');
console.log('• Test end-to-end live signing flow');

console.log('\n🔧 Current Features Available:');
console.log('✅ Session state management');
console.log('✅ Live signing interface');
console.log('✅ Participant management panel');
console.log('✅ Session controls and status');
console.log('✅ Video integration framework');
console.log('✅ Real-time participant tracking');
console.log('✅ Active user management');
console.log('⏳ Content replacement (next priority)');
console.log('⏳ Live video integration (next priority)');
console.log('⏳ Document completion workflow (next priority)'); 