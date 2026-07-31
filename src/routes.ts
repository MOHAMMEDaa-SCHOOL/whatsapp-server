import express from 'express';
import { qrCodeData, isConnected } from './whatsapp';
import { addToQueue, messageQueue, messageHistory } from './queue';
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

router.post('/check', (req, res) => {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds)) return res.status(400).json({ error: 'Invalid body' });
    
    const results: Record<string, any> = {};
    for (const id of messageIds) {
        const inQueue = messageQueue.find(m => m.id === id);
        if (inQueue) {
            results[id] = { status: inQueue.status };
            continue;
        }
        const inHistory = messageHistory.find(m => m.id === id);
        if (inHistory) {
            results[id] = { status: inHistory.status, sentAt: inHistory.sentAt, error: inHistory.error };
            continue;
        }
        results[id] = { status: 'not_found' };
    }
    res.json(results);
});

router.get('/logs', (req, res) => {
    res.send(`
        <html>
            <head>
                <meta charset="utf-8">
                <title>WhatsApp Server Logs</title>
                <style>
                    body { font-family: system-ui, sans-serif; padding: 20px; background: #f5f5f5; direction: rtl; }
                    .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
                    .badge { background: #e0f2fe; color: #0284c7; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
                    .badge.success { background: #dcfce7; color: #166534; }
                    .badge.failed { background: #fee2e2; color: #991b1b; }
                    .badge.pending { background: #fef9c3; color: #854d0e; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { padding: 12px; text-align: right; border-bottom: 1px solid #e5e5e5; }
                    th { color: #666; font-size: 14px; }
                    td { font-size: 14px; }
                </style>
                <script>setTimeout(() => window.location.reload(), 5000);</script>
            </head>
            <body>
                <div class="card">
                    <h2 style="margin-top: 0; color: #111;">الرسائل المعلقة في الطابور (${messageQueue.length})</h2>
                    ${messageQueue.length === 0 ? '<p style="color: #666;">لا توجد رسائل قيد الانتظار حالياً.</p>' : `
                        <table>
                            <tr><th>الرقم</th><th>الحالة</th></tr>
                            ${messageQueue.map(m => `<tr><td dir="ltr" style="text-align: right;">${m.phone}</td><td><span class="badge pending">في الانتظار ⏳</span></td></tr>`).join('')}
                        </table>
                    `}
                </div>

                <div class="card">
                    <h2 style="margin-top: 0; color: #111;">سجل الرسائل المرسلة (${messageHistory.length})</h2>
                    ${messageHistory.length === 0 ? '<p style="color: #666;">لم يتم إرسال أي رسائل حتى الآن.</p>' : `
                        <table>
                            <tr><th>الرقم</th><th>الحالة</th><th>وقت الإرسال الفعلي</th></tr>
                            ${messageHistory.map(m => `
                                <tr>
                                    <td dir="ltr" style="text-align: right;">${m.phone}</td>
                                    <td><span class="badge ${m.status === 'completed' ? 'success' : 'failed'}">${m.status === 'completed' ? 'نجاح ✅' : 'فشل ❌'}</span></td>
                                    <td dir="ltr" style="text-align: right; font-weight: bold; color: #059669;">${m.sentAt || '-'}</td>
                                </tr>
                            `).join('')}
                        </table>
                    `}
                </div>
            </body>
        </html>
    `);
});
