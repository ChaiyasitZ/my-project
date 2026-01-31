/**
 * Translation Utility for Network Configuration Prompts
 * Handles translation between English and Thai for network terms
 */

// Translation dictionary for network configuration terms
const translationDict = {
  // English to Thai
  en: {
    'configure': 'ตั้งค่า',
    'set up': 'กำหนด',
    'set': 'กำหนด',
    'create': 'สร้าง',
    'enable': 'เปิดใช้งาน',
    'disable': 'ปิดใช้งาน',
    'add': 'เพิ่ม',
    'remove': 'ลบ',
    'delete': 'ลบ',
    'interface': 'interface',
    'with': 'ด้วย',
    'and': 'และ',
    'on': 'บน',
    'for': 'สำหรับ',
    'to': 'ไป',
    'via': 'ผ่าน',
    'using': 'ใช้',
    'named': 'ชื่อ',
    'as': 'เป็น',
    'description': 'description',
    'routing': 'routing',
    'static route': 'static route',
    'static routes': 'static routes',
    'trunk port': 'trunk port',
    'access port': 'access port',
    'port-channel': 'port-channel',
    'members': 'สมาชิก',
    'allowing': 'อนุญาต',
    'maximum': 'จำกัด',
    'default gateway': 'default gateway',
    'next-hop': 'next-hop',
    'area': 'area',
    'network': 'network',
    'neighbor': 'neighbor',
    'remote-as': 'remote-as',
    'mapped': 'แมป',
    'destination': 'destination',
    'priority': 'priority',
    'virtual': 'virtual',
    'group': 'group',
    'domain': 'domain',
    'peer-keepalive': 'peer-keepalive',
    'active mode': 'active mode',
  },
  // Thai to English  
  th: {
    'ตั้งค่า': 'configure',
    'กำหนด': 'set',
    'สร้าง': 'create',
    'เปิดใช้งาน': 'enable',
    'ปิดใช้งาน': 'disable',
    'เพิ่ม': 'add',
    'ลบ': 'remove',
    'ด้วย': 'with',
    'และ': 'and',
    'บน': 'on',
    'สำหรับ': 'for',
    'ไป': 'to',
    'ผ่าน': 'via',
    'ใช้': 'using',
    'ชื่อ': 'named',
    'เป็น': 'as',
    'สมาชิก': 'members',
    'อนุญาต': 'allowing',
    'จำกัด': 'maximum',
    'แมป': 'mapped',
  }
};

/**
 * Detect if text contains Thai characters
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains Thai
 */
export const containsThai = (text) => {
  return /[\u0E00-\u0E7F]/.test(text);
};

/**
 * Detect the language of the prompt
 * @param {string} text - Text to analyze
 * @returns {'th' | 'en'} - Detected language
 */
export const detectLanguage = (text) => {
  return containsThai(text) ? 'th' : 'en';
};

/**
 * Simple translation using dictionary lookup
 * Preserves technical terms and network-specific vocabulary
 * @param {string} text - Text to translate
 * @param {'en' | 'th'} fromLang - Source language
 * @returns {string} - Translated text
 */
export const translatePrompt = (text, fromLang) => {
  if (!text) return text;
  
  const dict = translationDict[fromLang];
  if (!dict) return text;
  
  let result = text;
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    const regex = new RegExp(key, 'gi');
    result = result.replace(regex, dict[key]);
  }
  
  return result;
};

/**
 * Translate prompt from Thai to English for LLM processing
 * @param {string} prompt - User prompt (may be Thai)
 * @returns {string} - English prompt for LLM
 */
export const translateToEnglish = (prompt) => {
  if (!containsThai(prompt)) return prompt;
  return translatePrompt(prompt, 'th');
};

/**
 * Translate prompt from English to Thai for display
 * @param {string} prompt - English prompt
 * @returns {string} - Thai prompt for display
 */
export const translateToThai = (prompt) => {
  if (containsThai(prompt)) return prompt;
  return translatePrompt(prompt, 'en');
};
