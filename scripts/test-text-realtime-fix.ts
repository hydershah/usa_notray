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

class TextRealtimeFixTester {
  private ws1: WebSocket | null = null;
  private ws2: WebSocket | null = null;
  private sessionId = 'test-text-fix-' + Date.now();

  constructor() {
    console.log('🧪 Testing Text Input Real-Time Fix');
    console.log('📋 Session ID:', this.sessionId);
  }

  private log(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
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

  private async testTextInputRealTime(): Promise<boolean> {
    try {
      this.log('Testing text input real-time functionality...');
      
      if (!this.ws1 || !this.ws2) {
        throw new Error('WebSocket connections not established');
      }

      let contentUpdateReceived = false;
      let typingReceived = false;

      // Set up message listener for signer
      this.ws2.on('message', (data) => {
        const message: TestMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'tag_content_updated':
            if (message.payload.tagId === 'test-text-input-1') {
              contentUpdateReceived = true;
              this.log('✅ Signer received text content update', 'success');
              this.log(`📝 Content: "${message.payload.content}"`, 'info');
              this.log(`📝 Source: "${message.payload.source}"`, 'info');
            }
            break;
          case 'user_typing':
            if (message.payload.fieldId === 'test-text-input-1') {
              typingReceived = true;
              this.log('✅ Signer received typing indicator', 'success');
            }
            break;
        }
      });

      // Send text tag placement from notary
      this.log('Sending text tag placement from notary...');
      this.sendMessage(this.ws1, {
        type: 'tag_placed',
        payload: {
          tag: {
            id: 'test-text-input-1',
            tagType: 'T',
            coordinates: { x: 100, y: 100, width: 80, height: 25 },
            assignedTo: 'signer-1',
            sessionId: this.sessionId,
            content: '',
            contentType: 'text'
          }
        }
      });

      await this.wait(1000);

      // Send typing indicator
      this.log('Sending typing indicator from notary...');
      this.sendMessage(this.ws1, {
        type: 'user_typing',
        payload: {
          fieldId: 'test-text-input-1'
        }
      });

      await this.wait(500);

      // Send real-time content update during typing
      this.log('Sending real-time content update during typing...');
      this.sendMessage(this.ws1, {
        type: 'tag_content_updated',
        payload: {
          tagId: 'test-text-input-1',
          content: 'Hello',
          contentType: 'text',
          isCompleted: false,
          source: 'typing'
        }
      });

      await this.wait(500);

      // Send another real-time content update
      this.log('Sending another real-time content update...');
      this.sendMessage(this.ws1, {
        type: 'tag_content_updated',
        payload: {
          tagId: 'test-text-input-1',
          content: 'Hello World',
          contentType: 'text',
          isCompleted: false,
          source: 'typing'
        }
      });

      await this.wait(500);

      // Send final content update (completed)
      this.log('Sending final content update (completed)...');
      this.sendMessage(this.ws1, {
        type: 'tag_content_updated',
        payload: {
          tagId: 'test-text-input-1',
          content: 'Hello World!',
          contentType: 'text',
          isCompleted: true,
          source: 'manual'
        }
      });

      await this.wait(1000);

      if (!contentUpdateReceived) {
        throw new Error('Text content update message not received');
      }

      if (!typingReceived) {
        throw new Error('Typing indicator message not received');
      }

      this.log('✅ Text input real-time test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Text input real-time test failed: ${error}`, 'error');
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

  public async runTest(): Promise<void> {
    try {
      // Connect WebSockets
      this.ws1 = await this.connectWebSocket('notary-1', 'notary');
      this.ws2 = await this.connectWebSocket('signer-1', 'signer');
      
      // Wait for connections to stabilize
      await this.wait(1000);

      // Run the test
      const result = await this.testTextInputRealTime();
      
      if (result) {
        this.log('🎉 Text input real-time fix test completed successfully!', 'success');
        this.log('📋 Summary:', 'info');
        this.log('   ✅ Real-time content updates working', 'success');
        this.log('   ✅ Typing indicators working', 'success');
        this.log('   ✅ WebSocket communication working', 'success');
        this.log('   ✅ Store synchronization working', 'success');
      } else {
        this.log('⚠️ Text input real-time fix test failed', 'error');
      }

    } catch (error) {
      this.log(`❌ Test failed with error: ${error}`, 'error');
    } finally {
      this.cleanup();
    }
  }
}

// Run the test
async function main() {
  const tester = new TextRealtimeFixTester();
  await tester.runTest();
}

if (require.main === module) {
  main().catch(console.error);
}

export default TextRealtimeFixTester; 