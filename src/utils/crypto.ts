import CryptoJS from 'crypto-js';

const APP_KEY = 'onyxstream-v1-key';

export const encrypt = (data: string): string => {
  return CryptoJS.AES.encrypt(data, APP_KEY).toString();
};

export const decrypt = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, APP_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};
