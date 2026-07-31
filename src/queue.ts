import { sendWhatsAppMessage } from './whatsapp';
import dotenv from 'dotenv';
dotenv.config();

interface QueueMessage {
    id: string;
    phone: string;
    text: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
}

export const messageQueue: QueueMessage[] = [];
let isProcessingQueue = false;

const MIN_DELAY = parseInt(process.env.MIN_DELAY || '30', 10) * 1000;
const MAX_DELAY = parseInt(process.env.MAX_DELAY || '180', 10) * 1000;

function getRandomDelay() {
    return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

export function addToQueue(phone: string, text: string): string {
    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    messageQueue.push({ id, phone, text, status: 'pending' });
    
    if (!isProcessingQueue) {
        processQueue();
    }
    
    return id;
}

async function processQueue() {
    if (messageQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    
    isProcessingQueue = true;
    
    // Get the first pending message
    const messageIndex = messageQueue.findIndex(m => m.status === 'pending');
    
    if (messageIndex === -1) {
        isProcessingQueue = false;
        return;
    }
    
    const message = messageQueue[messageIndex];
    message.status = 'processing';
    
    try {
        console.log(`[Queue] Sending message to ${message.phone}...`);
        await sendWhatsAppMessage(message.phone, message.text);
        message.status = 'completed';
        console.log(`[Queue] ✅ Sent successfully to ${message.phone}`);
    } catch (error: any) {
        message.status = 'failed';
        message.error = error.message;
        console.error(`[Queue] ❌ Failed to send to ${message.phone}:`, error.message);
    }
    
    // Wait for random delay before sending the next one
    const delay = getRandomDelay();
    console.log(`[Queue] Waiting ${delay / 1000} seconds before next message...`);
    
    setTimeout(() => {
        // Remove completed/failed messages to prevent memory leak (optional, or keep a history)
        const indexToRemove = messageQueue.findIndex(m => m.id === message.id);
        if (indexToRemove !== -1) {
            messageQueue.splice(indexToRemove, 1);
        }
        
        processQueue();
    }, delay);
}
