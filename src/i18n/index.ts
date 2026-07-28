/**
 * Lightweight localization. `t(key)` returns the string for the active language,
 * falling back to English (and finally the key itself), so partial translations
 * degrade gracefully. Narrative/dynamic prose stays English by design; this
 * covers the app chrome (menus, actions, settings, hubs).
 *
 * Add a language by adding its column to STRINGS. Use `useT()` in components so
 * they re-render when the language setting changes.
 */
import { Language, useSettings } from '../state/settingsStore';

type Dict = Record<string, string>;

const EN: Dict = {
  // Menu
  'menu.continue': 'Continue',
  'menu.newGame': 'New Game',
  'menu.savedGames': 'Saved Games',
  'menu.login': 'Login',
  'menu.purchase': 'Store',
  'menu.settings': 'Settings',
  'menu.exit': 'Exit',
  // Common actions
  'common.back': 'Back',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.playMatch': 'Play Match',
  'common.next': 'Next',
  'common.done': 'Done',
  'common.saveExit': 'Save & Exit to Menu',
  // New game
  'newgame.title': 'New Game',
  'newgame.subtitle': 'Choose how you want to live the game',
  'newgame.playerTitle': 'Player Career',
  'newgame.playerDesc':
    'Create a cricketer and live their whole journey — matches, milestones, relationships, sponsors, national duty and, one day, retirement.',
  'newgame.managerTitle': 'Manager Career',
  'newgame.managerDesc':
    'Take charge of a club: pick your XI, set tactics, scout and sign players, build the academy, and answer to the board across full seasons.',
  // Settings
  'settings.title': 'Settings',
  'settings.sound': 'Sound effects',
  'settings.music': 'Music',
  'settings.haptics': 'Haptics',
  'settings.notifications': 'Notifications',
  'settings.graphics': 'Graphics quality',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'settings.themeSystem': 'System',
  // Hub sections
  'hub.matchday': 'Matchday',
  'hub.leagueTable': 'League Table',
  'hub.tabHome': 'Home',
  'hub.tabSquad': 'Squad',
  'hub.tabTrain': 'Train',
  'hub.tabStore': 'Store',
  'hub.tabProfile': 'Profile',
  'hub.tabTransfers': 'Transfers',
  'hub.tabRecords': 'Records',
};

const HI: Dict = {
  'menu.continue': 'जारी रखें',
  'menu.newGame': 'नया खेल',
  'menu.savedGames': 'सहेजे गए खेल',
  'menu.login': 'लॉगिन',
  'menu.purchase': 'स्टोर',
  'menu.settings': 'सेटिंग्स',
  'menu.exit': 'बाहर',
  'common.back': 'वापस',
  'common.save': 'सहेजें',
  'common.cancel': 'रद्द करें',
  'common.continue': 'जारी रखें',
  'common.playMatch': 'मैच खेलें',
  'common.next': 'आगे',
  'common.done': 'पूर्ण',
  'common.saveExit': 'सहेजें और मेन्यू पर जाएँ',
  'newgame.title': 'नया खेल',
  'newgame.subtitle': 'चुनें कि आप खेल को कैसे जीना चाहते हैं',
  'newgame.playerTitle': 'खिलाड़ी करियर',
  'newgame.playerDesc':
    'एक क्रिकेटर बनाएँ और उसका पूरा सफर जिएँ — मैच, कीर्तिमान, रिश्ते, प्रायोजक, देश की सेवा और एक दिन संन्यास।',
  'newgame.managerTitle': 'मैनेजर करियर',
  'newgame.managerDesc':
    'एक क्लब की कमान संभालें: अपनी एकादश चुनें, रणनीति तय करें, खिलाड़ी स्काउट करें, अकादमी बनाएँ और बोर्ड को जवाब दें।',
  'settings.title': 'सेटिंग्स',
  'settings.sound': 'ध्वनि प्रभाव',
  'settings.music': 'संगीत',
  'settings.haptics': 'हैप्टिक्स',
  'settings.notifications': 'सूचनाएँ',
  'settings.graphics': 'ग्राफ़िक्स गुणवत्ता',
  'settings.theme': 'थीम',
  'settings.language': 'भाषा',
  'settings.themeDark': 'गहरा',
  'settings.themeLight': 'हल्का',
  'settings.themeSystem': 'सिस्टम',
  'hub.matchday': 'मैच दिवस',
  'hub.leagueTable': 'लीग तालिका',
  'hub.tabHome': 'होम',
  'hub.tabSquad': 'टीम',
  'hub.tabTrain': 'अभ्यास',
  'hub.tabStore': 'स्टोर',
  'hub.tabProfile': 'प्रोफ़ाइल',
  'hub.tabTransfers': 'ट्रांसफ़र',
  'hub.tabRecords': 'रिकॉर्ड',
};

const STRINGS: Record<Language, Dict> = { en: EN, hi: HI };

export type TKey = keyof typeof EN;

/** Translate a key for a language (falls back to English, then the key). */
export function translate(lang: Language, key: string): string {
  return STRINGS[lang]?.[key] ?? EN[key] ?? key;
}

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (App Chrome Only)' },
];

/** Reactive translator bound to the active language setting. */
export function useT(): (key: TKey | string) => string {
  const lang = useSettings((s) => s.language);
  return (key) => translate(lang, key as string);
}
