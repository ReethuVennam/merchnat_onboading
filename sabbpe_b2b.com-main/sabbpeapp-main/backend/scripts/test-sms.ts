import 'dotenv/config';
import { sendInviteViaSms } from '../src/services/inviteService';

(async () => {
  try {
    const result = await sendInviteViaSms('8639915897', 'http://localhost:5173/invite/test', 'Test Merchant');
    console.log('sms helper result:', result);
  } catch (err) {
    console.error('error running sms helper:', err);
  }
})();
