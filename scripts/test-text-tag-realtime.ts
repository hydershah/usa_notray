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

class TextTagRealtimeTester {
  private ws1: WebSocket | null = null;
  private ws2: WebSocket | null = null;
  private sessionId = 'test-text-tag-session-' + Date.now();
  private testResults: string[] = [];

  constructor() {
    console.log('🧪 Starting Text Tag Real-Time Test');
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

  private async testTextTagPlacement(): Promise<boolean> {
    try {
      this.log('Testing text tag placement...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let tagPlacedReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'tag_placed' && message.payload.tag.tagType === 'T') {
          tagPlacedReceived = true;
          this.log('✅ Signer received text tag placement', 'success');
        }
      });

      // Send text tag placement from notary
      this.log('Sending text tag placement from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_placed',
        payload: {
          tag: {
            id: 'test-text-tag-1',
            tagType: 'T',
            coordinates: { x: 100, y: 100, width: 150, height: 50 },
            assignedTo: 'signer-1',
            sessionId: this.sessionId,
            content: '',
            contentType: 'text'
          }
        }
      });

      await this.wait(1000);
      if (!tagPlacedReceived) {
        throw new Error('Text tag placement message not received');
      }

      this.log('✅ Text tag placement test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Text tag placement test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testTextTagContentUpdate(): Promise<boolean> {
    try {
      this.log('Testing text tag content update...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let contentUpdateReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'tag_content_updated' && message.payload.tagId === 'test-text-tag-1') {
          contentUpdateReceived = true;
          this.log('✅ Signer received text tag content update', 'success');
          this.log(`📝 Content: "${message.payload.content}"`, 'info');
        }
      });

      // Send text content update from notary
      this.log('Sending text tag content update from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_content_updated',
        payload: {
          tagId: 'test-text-tag-1',
          content: 'Hello World!',
          contentType: 'text',
          isCompleted: true,
          source: 'manual'
        }
      });

      await this.wait(1000);
      if (!contentUpdateReceived) {
        throw new Error('Text tag content update message not received');
      }

      this.log('✅ Text tag content update test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Text tag content update test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testTextTagMovement(): Promise<boolean> {
    try {
      this.log('Testing text tag movement...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let tagMovedReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'tag_moved' && message.payload.tagId === 'test-text-tag-1') {
          tagMovedReceived = true;
          this.log('✅ Signer received text tag movement', 'success');
        }
      });

      // Send text tag movement from notary
      this.log('Sending text tag movement from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_moved',
        payload: {
          tagId: 'test-text-tag-1',
          coordinates: { x: 200, y: 200, width: 150, height: 50 }
        }
      });

      await this.wait(1000);
      if (!tagMovedReceived) {
        throw new Error('Text tag movement message not received');
      }

      this.log('✅ Text tag movement test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Text tag movement test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testTextTagResize(): Promise<boolean> {
    try {
      this.log('Testing text tag resize...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let tagResizedReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'tag_resized' && message.payload.tagId === 'test-text-tag-1') {
          tagResizedReceived = true;
          this.log('✅ Signer received text tag resize', 'success');
        }
      });

      // Send text tag resize from notary
      this.log('Sending text tag resize from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_resized',
        payload: {
          tagId: 'test-text-tag-1',
          coordinates: { x: 200, y: 200, width: 200, height: 60 }
        }
      });

      await this.wait(1000);
      if (!tagResizedReceived) {
        throw new Error('Text tag resize message not received');
      }

      this.log('✅ Text tag resize test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Text tag resize test failed: ${error}`, 'error');
      return false;
    }
  }

  private async testTextTagDeletion(): Promise<boolean> {
    try {
      this.log('Testing text tag deletion...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let tagDeletedReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        if (message.type === 'tag_deleted' && message.payload.tagId === 'test-text-tag-1') {
          tagDeletedReceived = true;
          this.log('✅ Signer received text tag deletion', 'success');
        }
      });

      // Send text tag deletion from notary
      this.log('Sending text tag deletion from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_deleted',
        payload: {
          tagId: 'test-text-tag-1'
        }
      });

      await this.wait(1000);
      if (!tagDeletedReceived) {
        throw new Error('Text tag deletion message not received');
      }

      this.log('✅ Text tag deletion test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Text tag deletion test failed: ${error}`, 'error');
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
            if (message.payload.fieldId === 'test-text-tag-1') {
              typingReceived = true;
              this.log('✅ Signer received typing indicator', 'success');
            }
            break;
          case 'user_stopped_typing':
            if (message.payload.fieldId === 'test-text-tag-1') {
              stoppedTypingReceived = true;
              this.log('✅ Signer received stopped typing indicator', 'success');
            }
            break;
        }
      });

      // Send typing indicator from notary
      this.log('Sending typing indicator from notary...');
      this.sendMessage(this.ws1, {
        type: 'user_typing',
        payload: {
          fieldId: 'test-text-tag-1'
        }
      });

      await this.wait(1000);
      if (!typingReceived) {
        throw new Error('Typing indicator message not received');
      }

      // Send stopped typing indicator
      this.log('Sending stopped typing indicator from notary...');
      this.sendMessage(this.ws1, {
        type: 'user_stopped_typing',
        payload: {
          fieldId: 'test-text-tag-1'
        }
      });

      await this.wait(1000);
      if (!stoppedTypingReceived) {
        throw new Error('Stopped typing indicator message not received');
      }

      this.log('✅ Typing indicators test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Typing indicators test failed: ${error}`, 'error');
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
      { name: 'Text Tag Placement', test: () => this.testTextTagPlacement() },
      { name: 'Text Tag Content Update', test: () => this.testTextTagContentUpdate() },
      { name: 'Text Tag Movement', test: () => this.testTextTagMovement() },
      { name: 'Text Tag Resize', test: () => this.testTextTagResize() },
      { name: 'Text Tag Deletion', test: () => this.testTextTagDeletion() },
      { name: 'Typing Indicators', test: () => this.testTypingIndicators() }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    this.log(`🚀 Starting ${totalTests} text tag tests...`);

    // Connect WebSockets first
    try {
      this.ws1 = await this.connectWebSocket('notary-1', 'notary');
      this.ws2 = await this.connectWebSocket('signer-1', 'signer');
      
      // Wait for connections to stabilize
      await this.wait(1000);
    } catch (error) {
      this.log(`❌ Failed to establish WebSocket connections: ${error}`, 'error');
      this.cleanup();
      return;
    }

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

    this.log(`📊 Text Tag Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      this.log('🎉 All text tag tests passed! Text tags work correctly in real-time.', 'success');
    } else {
      this.log('⚠️ Some text tag tests failed. Please check the implementation.', 'error');
    }

    this.cleanup();
  }
}

// Run the tests
async function main() {
  const tester = new TextTagRealtimeTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export default TextTagRealtimeTester; 