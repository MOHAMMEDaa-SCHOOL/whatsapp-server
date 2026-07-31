import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

export let sock: ReturnType<typeof makeWASocket> | null = null;
export let qrCodeData: string | null = null;
export let isConnected = false;

export async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) as any
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
        }

        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Logged out from WhatsApp. Please delete auth_info_baileys and restart to scan again.');
                qrCodeData = null;
            }
        } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp successfully!');
            isConnected = true;
            qrCodeData = null; // Clear QR code once connected
        }
    });
}

export async function sendWhatsAppMessage(phone: string, text: string) {
    if (!sock || !isConnected) {
        throw new Error('WhatsApp is not connected.');
    }
    
    // Format phone number to WhatsApp JID format (e.g., 967700000000@s.whatsapp.net)
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { text });
}
