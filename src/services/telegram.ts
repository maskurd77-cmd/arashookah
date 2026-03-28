import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const sendTelegramMessage = async (message: string) => {
  try {
    const docRef = doc(db, 'settings', 'general');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const settings = docSnap.data();
      const botToken = settings.telegramBotToken;
      const chatId = settings.telegramChatId;

      if (!botToken || !chatId) {
        // Telegram not configured
        return false;
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
        console.error('Failed to send Telegram message:', await response.text());
        return false;
      }

      return true;
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
};
