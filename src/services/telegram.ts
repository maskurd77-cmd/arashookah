import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface TelegramResult {
  success: boolean;
  error?: string;
}

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
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

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

