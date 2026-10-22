import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface TelegramResult {
  success: boolean;
  error?: string;
}

/** Escapes user-entered text before putting it inside an HTML Telegram message */
export const escapeTelegramHtml = (text: unknown): string =>
  String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const htmlToPlainText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export const sendTelegramMessage = async (message: string): Promise<TelegramResult> => {
  try {
    const docRef = doc(db, 'settings', 'general');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const settings = docSnap.data();
      const botToken = settings.telegramBotToken;
      const chatId = settings.telegramChatId;

      if (!botToken || !chatId) {
        return { success: false, error: 'تۆکن یان ئایدی چاتی تێلیگرام ڕێکنەخراوە لە بەشی ڕێکخستن' };
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const send = (body: Record<string, unknown>) => fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chat_id: chatId, ...body }),
      });

      let response = await send({ text: message, parse_mode: 'HTML' });

      // 400 = Telegram could not parse the HTML (e.g. a note containing "<" or "&").
      // Resend as plain text so reports (and closing a shift) never get blocked by user-typed text.
      if (response.status === 400) {
        response = await send({ text: htmlToPlainText(message) });
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to send Telegram message:', errorData);
        return { success: false, error: `تێلیگرام ڕەتیکردەوە (${response.status}): تکایە تۆکن یان ئایدی چات بپشکنە` };
      }

      return { success: true };
    } else {
      return { success: false, error: 'ڕێکخستنەکانی تێلیگرام نەدۆزرایەوە' };
    }
  } catch (error: any) {
    console.error('Error sending Telegram message:', error);
    return { success: false, error: error?.message || 'کێشەیەک لە پێوەندی تێلیگرام ڕوویدا' };
  }
};

