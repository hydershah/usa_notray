#!/usr/bin/env tsx

import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

interface TestMessage {
  type: string;
  payload: any;
  userId: string;
  sessionId: string;
  timestamp: number;
}

class RealtimeCollaborationTester {
  private ws1: WebSocket | null = null;
  private ws2: WebSocket | null = null;
  private sessionId = 'test-session-' + Date.now();
  private testResults: string[] = [];

  constructor() {
    console.log('🧪 Starting Real-Time Collaboration Test');
    console.log('📋 Session ID:', this.sessionId);
  }

  private log(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const logMessage = `${prefix} [${timestamp}] ${message}`;
    console.log(logMessage);
    this.testResults.push(logMessage);
  }

  private createToken(userId: string, role: 'notary' | 'signer' = 'signer'): string {
    return jwt.sign(
      { 
        id: userId, 
        userId: userId, 
        role: role,
        name: `Test ${role} ${userId}`,
        email: `test-${userId}@example.com`
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
  }

  private createWebSocketUrl(userId: string, role: 'notary' | 'signer' = 'signer'): string {
    const token = this.createToken(userId, role);
    const protocol = 'ws';
    const host = process.env.TEST_HOST || 'localhost:3000';
    return `${protocol}://${host}/ws/editor?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(this.sessionId)}`;
  }

  private async connectWebSocket(userId: string, role: 'notary' | 'signer' = 'signer'): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const url = this.createWebSocketUrl(userId, role);
      this.log(`Connecting ${role} ${userId} to: ${url}`);

      const ws = new WebSocket(url);

      ws.on('open', () => {
        this.log(`✅ ${role} ${userId} connected successfully`, 'success');
        resolve(ws);
      });

      ws.on('error', (error) => {
        this.log(`❌ ${role} ${userId} connection error: ${error.message}`, 'error');
        reject(error);
      });

      ws.on('close', (code, reason) => {
        this.log(`🔌 ${role} ${userId} disconnected: ${code} - ${reason}`);
      });
    });
  }

  private sendMessage(ws: WebSocket, message: Omit<TestMessage, 'userId' | 'sessionId' | 'timestamp'>): void {
    const fullMessage: TestMessage = {
      ...message,
      userId: 'test-user',
      sessionId: this.sessionId,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(fullMessage));
  }

  private async testBasicConnection(): Promise<boolean> {
    try {
      this.log('Testing basic WebSocket connection...');
      
      // Connect notary
      this.ws1 = await this.connectWebSocket('notary-1', 'notary');
      
      // Connect signer
      this.ws2 = await this.connectWebSocket('signer-1', 'signer');
      
      this.log('✅ Basic connection test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Basic connection test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testTagOperations(): Promise<boolean> {
    try {
      this.log('Testing tag operations...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let tagPlacedReceived = false;
      let tagUpdatedReceived = false;
      let tagDeletedReceived = false;

      // Set up message listeners for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'tag_placed':
            tagPlacedReceived = true;
            this.log('✅ Signer received tag_placed message', 'success');
            break;
          case 'tag_updated':
            tagUpdatedReceived = true;
            this.log('✅ Signer received tag_updated message', 'success');
            break;
          case 'tag_deleted':
            tagDeletedReceived = true;
            this.log('✅ Signer received tag_deleted message', 'success');
            break;
        }
      });

      // Test tag placement
      this.log('Sending tag_placed message from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_placed',
        payload: {
          tag: {
            id: 'test-tag-1',
            tagType: 'S',
            coordinates: { x: 100, y: 100, width: 150, height: 50 },
            assignedTo: 'signer-1',
            sessionId: this.sessionId
          }
        }
      });

      // Wait for message to be received
      await this.wait(1000);
      if (!tagPlacedReceived) {
        throw new Error('Tag placed message not received');
      }

      // Test tag update
      this.log('Sending tag_updated message from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_updated',
        payload: {
          tagId: 'test-tag-1',
          updates: {
            coordinates: { x: 200, y: 200, width: 150, height: 50 }
          }
        }
      });

      await this.wait(1000);
      if (!tagUpdatedReceived) {
        throw new Error('Tag updated message not received');
      }

      // Test tag deletion
      this.log('Sending tag_deleted message from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_deleted',
        payload: {
          tagId: 'test-tag-1'
        }
      });

      await this.wait(1000);
      if (!tagDeletedReceived) {
        throw new Error('Tag deleted message not received');
      }

      this.log('✅ Tag operations test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Tag operations test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testCursorTracking(): Promise<boolean> {
    try {
      this.log('Testing cursor tracking...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let cursorMovedReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'cursor_moved') {
          cursorMovedReceived = true;
          this.log('✅ Signer received cursor_moved message', 'success');
        }
      });

      // Send cursor movement from notary
      this.log('Sending cursor_moved message from notary...');
      this.sendMessage(this.ws1, {
        type: 'cursor_moved',
        payload: {
          x: 300,
          y: 400,
          pageNumber: 1,
          documentId: 'test-doc-1'
        }
      });

      await this.wait(1000);
      if (!cursorMovedReceived) {
        throw new Error('Cursor moved message not received');
      }

      this.log('✅ Cursor tracking test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Cursor tracking test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testTypingIndicators(): Promise<boolean> {
    try {
      this.log('Testing typing indicators...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let typingReceived = false;
      let stoppedTypingReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'user_typing':
            typingReceived = true;
            this.log('✅ Signer received user_typing message', 'success');
            break;
          case 'user_stopped_typing':
            stoppedTypingReceived = true;
            this.log('✅ Signer received user_stopped_typing message', 'success');
            break;
        }
      });

      // Send typing indicator from notary
      this.log('Sending user_typing message from notary...');
      this.sendMessage(this.ws1, {
        type: 'user_typing',
        payload: {
          fieldId: 'test-field-1'
        }
      });

      await this.wait(1000);
      if (!typingReceived) {
        throw new Error('User typing message not received');
      }

      // Send stopped typing indicator
      this.log('Sending user_stopped_typing message from notary...');
      this.sendMessage(this.ws1, {
        type: 'user_stopped_typing',
        payload: {
          fieldId: 'test-field-1'
        }
      });

      await this.wait(1000);
      if (!stoppedTypingReceived) {
        throw new Error('User stopped typing message not received');
      }

      this.log('✅ Typing indicators test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Typing indicators test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testPageNavigation(): Promise<boolean> {
    try {
      this.log('Testing page navigation...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let pageChangedReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'page_changed') {
          pageChangedReceived = true;
          this.log('✅ Signer received page_changed message', 'success');
        }
      });

      // Send page change from notary
      this.log('Sending page_changed message from notary...');
      this.sendMessage(this.ws1, {
        type: 'page_changed',
        payload: {
          pageNumber: 2
        }
      });

      await this.wait(1000);
      if (!pageChangedReceived) {
        throw new Error('Page changed message not received');
      }

      this.log('✅ Page navigation test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Page navigation test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testSyncUsers(): Promise<boolean> {
    try {
      this.log('Testing sync users functionality...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let syncReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'sync_to_notary') {
          syncReceived = true;
          this.log('✅ Signer received sync_to_notary message', 'success');
        }
      });

      // Send sync command from notary
      this.log('Sending sync_users message from notary...');
      this.sendMessage(this.ws1, {
        type: 'sync_users',
        payload: {
          pageNumber: 3,
          documentId: 'test-doc-1'
        }
      });

      await this.wait(1000);
      if (!syncReceived) {
        throw new Error('Sync to notary message not received');
      }

      this.log('✅ Sync users test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Sync users test failed: ${error}`, 'error');
      return false;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    if (this.ws1) {
      this.ws1.close(1000, 'Test completed');
    }
    if (this.ws2) {
      this.ws2.close(1000, 'Test completed');
    }
  }

  public async runAllTests(): Promise<void> {
    const tests = [
      { name: 'Basic Connection', test: () => this.testBasicConnection() },
      { name: 'Tag Operations', test: () => this.testTagOperations() },
      { name: 'Cursor Tracking', test: () => this.testCursorTracking() },
      { name: 'Typing Indicators', test: () => this.testTypingIndicators() },
      { name: 'Page Navigation', test: () => this.testPageNavigation() },
      { name: 'Sync Users', test: () => this.testSyncUsers() }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    this.log(`🚀 Starting ${totalTests} tests...`);

    for (const test of tests) {
      try {
        const result = await test.test();
        if (result) {
          passedTests++;
        }
      } catch (error) {
        this.log(`❌ Test "${test.name}" failed with error: ${error}`, 'error');
      }
      
      // Wait between tests
      await this.wait(500);
    }

    this.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      this.log('🎉 All tests passed! Real-time collaboration is working correctly.', 'success');
    } else {
      this.log('⚠️ Some tests failed. Please check the WebSocket service configuration.', 'error');
    }

    this.cleanup();
  }
}

// Run the tests
async function main() {
  const tester = new RealtimeCollaborationTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export default RealtimeCollaborationTester; 