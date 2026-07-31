import express from 'express';
import { qrCodeData, isConnected } from './whatsapp';
import { addToQueue, messageQueue } from './queue';
import qrcode from 'qrcode';

export const router = express.Router();

router.get('/qr', async (req, res) => {
    if (isConnected) {
        return res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h2 style="color: green;">✅ WhatsApp is connected and running!</h2>
                    <p>No need to scan any QR code.</p>
                </body>
            </html>
        `);
    }

    if (!qrCodeData) {
        return res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h2>⏳ Please wait...</h2>
                    <p>Generating QR Code or starting up...</p>
                    <script>setTimeout(() => window.location.reload(), 2000);</script>
                </body>
            </html>
        `);
    }

    try {
        const qrImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h2>📱 Scan this QR Code with WhatsApp</h2>
                    <p>Open WhatsApp on your phone -> Linked Devices -> Link a Device</p>
                    <img src="${qrImage}" alt="QR Code" style="width: 300px; height: 300px;" />
                    <script>setTimeout(() => window.location.reload(), 5000);</script>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Error generating QR code image');
    }
});

router.post('/send', (req, res) => {
    const { apiKey, phone, text } = req.body;

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }

    if (!phone || !text) {
        return res.status(400).json({ error: 'Bad Request: Missing phone or text' });
    }

    if (!isConnected) {
        return res.status(503).json({ error: 'Service Unavailable: WhatsApp is not connected.' });
    }

    const messageId = addToQueue(phone, text);
    
    res.json({
        success: true,
        message: 'Message added to queue',
        messageId,
        queuePosition: messageQueue.length
    });
});

router.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        queueLength: messageQueue.length
    });
});
