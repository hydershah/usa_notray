/**
 * Debug Script: Text Tag Real-Time Synchronization Test
 * 
 * This script helps debug two issues:
 * 1. Text tag movement not syncing in real-time
 * 2. Text input tags not being clickable
 * 
 * Usage: Run this in browser console while in a session with text tags
 */

window.debugTextTagSync = {
  // Test if WebSocket messages are being received for position updates
  testPositionSync: () => {
    console.log('🔍 Testing text tag position sync...');
    
    // Hook into WebSocket messages
    const originalSend = WebSocket.prototype.send;
    const originalAddEventListener = WebSocket.prototype.addEventListener;
    
    // Monitor outgoing WebSocket messages
    WebSocket.prototype.send = function(data) {
      try {
        const message = JSON.parse(data);
        if (message.type === 'tag_updated' && message.payload?.tagType === 'T') {
          console.log('📤 Outgoing text tag position update:', message);
        }
      } catch (e) {
        // Not JSON, ignore
      }
      return originalSend.call(this, data);
    };
    
    // Monitor incoming WebSocket messages
    WebSocket.prototype.addEventListener = function(type, listener, options) {
      if (type === 'message') {
        const wrappedListener = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'tag_updated' && message.payload?.tagType === 'T') {
              console.log('📥 Incoming text tag position update:', message);
            }
          } catch (e) {
            // Not JSON, ignore
          }
          return listener.call(this, event);
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    console.log('✅ WebSocket position sync monitoring enabled');
  },
  
  // Test text input clickability
  testClickability: () => {
    console.log('🔍 Testing text input clickability...');
    
    const textInputs = document.querySelectorAll('[id*="text-stable-"]');
    console.log(`Found ${textInputs.length} text inputs`);
    
    textInputs.forEach((input, index) => {
      const styles = window.getComputedStyle(input);
      console.log(`Text input ${index + 1}:`, {
        element: input,
        pointerEvents: styles.pointerEvents,
        zIndex: styles.zIndex,
        position: styles.position,
        visibility: styles.visibility,
        display: styles.display,
        opacity: styles.opacity,
        cursor: styles.cursor
      });
      
      // Test if element responds to synthetic click
      const rect = input.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Find what element is actually at the click position
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      console.log(`Element at center of text input ${index + 1}:`, elementAtPoint);
      
      if (elementAtPoint !== input && !input.contains(elementAtPoint)) {
        console.warn(`⚠️ Text input ${index + 1} is blocked by:`, elementAtPoint);
      }
    });
  },
  
  // Test if text inputs are properly synchronized with tags
  testTagSync: () => {
    console.log('🔍 Testing text input <-> tag synchronization...');
    
    // Get editor store data
    const editorStore = window.__ZUSTAND_DEVTOOLS_STORE__ || {};
    
    if (typeof useEditorStore !== 'undefined') {
      try {
        const tags = useEditorStore.getState?.()?.tags || [];
        const textTags = tags.filter(tag => tag.tagType === 'T');
        
        console.log(`Found ${textTags.length} text tags in store:`, textTags);
        
        // Check if there are corresponding text inputs in DOM
        const textInputElements = document.querySelectorAll('[id*="text-stable-"]');
        console.log(`Found ${textInputElements.length} text input elements in DOM`);
        
        if (textTags.length !== textInputElements.length) {
          console.warn('⚠️ Mismatch between text tags in store and DOM elements');
        }
        
      } catch (error) {
        console.error('Failed to access editor store:', error);
      }
    }
  },
  
  // Simulate a position update to test sync
  simulatePositionUpdate: (textTagId) => {
    console.log(`🎮 Simulating position update for text tag: ${textTagId}`);
    
    // Find the text input element
    const textInput = document.querySelector(`[id*="${textTagId}"]`);
    if (!textInput) {
      console.error('Text input not found for ID:', textTagId);
      return;
    }
    
    // Get current position
    const rect = textInput.getBoundingClientRect();
    console.log('Current position:', { left: rect.left, top: rect.top });
    
    // Simulate drag event
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 10,
      clientY: rect.top + 10
    });
    
    const mouseMove = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 50,
      clientY: rect.top + 50
    });
    
    const mouseUp = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 50,
      clientY: rect.top + 50
    });
    
    textInput.dispatchEvent(mouseDown);
    document.dispatchEvent(mouseMove);
    document.dispatchEvent(mouseUp);
    
    console.log('✅ Simulated drag completed - check for WebSocket messages');
  },
  
  // Run all tests
  runAllTests: () => {
    console.log('🚀 Running all text tag debug tests...');
    window.debugTextTagSync.testPositionSync();
    window.debugTextTagSync.testClickability();
    window.debugTextTagSync.testTagSync();
    console.log('✅ All tests completed - check console output above');
  }
};

console.log('📋 Text Tag Debug Utility Loaded');
console.log('Run window.debugTextTagSync.runAllTests() to test everything');
console.log('Available methods:');
console.log('- testPositionSync(): Monitor WebSocket position updates');
console.log('- testClickability(): Check if text inputs are clickable');
console.log('- testTagSync(): Verify tag <-> DOM synchronization');
console.log('- simulatePositionUpdate(tagId): Test position update for specific tag');
console.log('- runAllTests(): Run all tests at once'); 