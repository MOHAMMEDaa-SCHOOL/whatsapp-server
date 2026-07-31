import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToWhatsApp } from './whatsapp';
import { router } from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', router);

// Start Server & WhatsApp
app.listen(PORT, async () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 QR Code Link: http://localhost:${PORT}/qr`);
    
    try {
        await connectToWhatsApp();
    } catch (err) {
        console.error('Failed to start WhatsApp connection:', err);
    }
});
