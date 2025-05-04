#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Setup for ES modules (to get __dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function promptForInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function testChatSystem() {
  try {
    console.log('Running chat system test...');
    
    // Prompt for user credentials
    const email = await promptForInput('Enter your Columbia email: ');
    const token = await promptForInput('Enter your authentication token (from localStorage): ');
    
    // Create axios instance with auth token
    const api = axios.create({
      baseURL: 'http://localhost:3003/api',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Test 1: Get all chats
    console.log('\nTest 1: Getting all chats...');
    try {
      const chatsResponse = await api.get('/chats');
      console.log('✅ Successfully retrieved chats list');
      
      if (chatsResponse.data.length > 0) {
        console.log(`Found ${chatsResponse.data.length} chats`);
        
        // Use the first chat for further testing
        const firstChat = chatsResponse.data[0];
        console.log(`Using chat with ID: ${firstChat.id}`);
        
        // Test 2: Get messages for this chat
        console.log('\nTest 2: Getting messages for chat...');
        const messagesResponse = await api.get(`/chats/${firstChat.id}/messages`);
        console.log('✅ Successfully retrieved messages');
        console.log(`Found ${messagesResponse.data.length} messages`);
        
        // Display a few messages
        if (messagesResponse.data.length > 0) {
          console.log('\nSample messages:');
          messagesResponse.data.slice(0, 3).forEach((msg, i) => {
            console.log(`Message ${i+1}: ${msg.content}`);
          });
        }
        
        // Test 3: Send a new message to this chat
        console.log('\nTest 3: Sending a new message...');
        const newMessageContent = `Test message sent at ${new Date().toISOString()}`;
        
        const sendResponse = await api.post(`/chats/${firstChat.id}/messages`, {
          content: newMessageContent
        });
        
        console.log('✅ Successfully sent new message');
        console.log('New message:', sendResponse.data);
        
        // Verify the sent message has the correct field structure
        if (sendResponse.data.content === newMessageContent) {
          console.log('✅ Message content field is working correctly');
        } else {
          console.log('❌ Message content mismatch');
          console.log(`Expected: ${newMessageContent}`);
          console.log(`Received: ${sendResponse.data.content}`);
        }
      } else {
        console.log('No chats found. Please create a chat first through the UI.');
      }
    } catch (error) {
      console.error('❌ Error fetching chats:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log('Authentication failed. Please check your token.');
      }
    }
    
    console.log('\nTests completed!');
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    rl.close();
  }
}

testChatSystem().catch(console.error); 