#!/usr/bin/env ts-node
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { redisCache } from './server/services/redis-cache';

const app = express();

console.log('🧪 Testing server startup...');

// Test Redis connection
redisCache.healthCheck()
  .then(result => {
    console.log('Redis health check:', result);
  })
  .catch(error => {
    console.error('Redis error:', error);
  });

// Simple health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test server
const port = 3001;
const server = app.listen(port, () => {
  console.log(`✅ Test server running on port ${port}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Test Redis functionality
setTimeout(async () => {
  try {
    console.log('🧪 Testing Redis cache...');
    await redisCache.set('test-key', 'test-value', 60);
    const value = await redisCache.get('test-key');
    console.log('Redis test result:', value);
  } catch (error) {
    console.error('Redis test error:', error);
  }
}, 2000); 