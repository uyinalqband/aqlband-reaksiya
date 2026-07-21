export {};

/**
 * Minimal, accurate typing of the `window.Telegram.WebApp` bridge injected by
 * https://telegram.org/js/telegram-web-app.js. Only the surface this app
 * actually uses is typed; extend as new native features are adopted.
 */
declare global {
  interface TelegramWebAppUser {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  }

  interface TelegramWebAppInitData {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: number;
    start_param?: string;
    hash?: string;
  }

  interface TelegramThemeParams {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  }

  interface TelegramHapticFeedback {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  }

  interface TelegramMainButton {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  }

  interface TelegramBackButton {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  }

  interface TelegramCloudStorage {
    setItem: (key: string, value: string, cb?: (err: unknown, ok?: boolean) => void) => void;
    getItem: (key: string, cb: (err: unknown, value?: string) => void) => void;
    getItems: (keys: string[], cb: (err: unknown, values?: Record<string, string>) => void) => void;
    removeItem: (key: string, cb?: (err: unknown, ok?: boolean) => void) => void;
  }

  interface TelegramWebApp {
    initData: string;
    initDataUnsafe: TelegramWebAppInitData;
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: TelegramThemeParams;
    viewportHeight: number;
    viewportStableHeight: number;
    isExpanded: boolean;
    MainButton: TelegramMainButton;
    BackButton: TelegramBackButton;
    HapticFeedback: TelegramHapticFeedback;
    CloudStorage?: TelegramCloudStorage;
    ready: () => void;
    expand: () => void;
    close: () => void;
    disableVerticalSwipes?: () => void;
    setHeaderColor?: (color: string) => void;
    setBackgroundColor?: (color: string) => void;
    openTelegramLink: (url: string) => void;
    openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
    switchInlineQuery?: (query: string, choose_chat_types?: string[]) => void;
    onEvent: (eventType: string, cb: () => void) => void;
    offEvent: (eventType: string, cb: () => void) => void;
    showAlert?: (message: string, cb?: () => void) => void;
    showConfirm?: (message: string, cb?: (confirmed: boolean) => void) => void;
  }

  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
