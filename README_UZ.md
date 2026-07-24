# AqlBand V2

AqlBand V2 — Shashka markazidagi strategik Telegram Mini App platformasi.

## Asosiy konsepsiya

- **Shashka** — asosiy raqobatbardosh o‘yin.
- **Overall Rating / ELO** — faqat reytingli Shashka uchrashuvlari orqali o‘zgaradi.
- G‘alabada ELO oshadi, mag‘lubiyatda kamayadi.
- Do‘st bilan Shashka va Tic Tac Toe ELO’ga ta’sir qilmaydi.
- Barcha o‘yinlar XP beradi.
- XP cheksiz **LEVEL** tizimini oshiradi.
- Rasmiy o‘yin tarixida faqat Shashka uchrashuvlari ko‘rsatiladi.
- Qolgan mini-o‘yinlar faqat yakka mashq rejimida.
- Tic Tac Toe faqat do‘st bilan o‘ynaladi.

## V2 yangiliklari

- Shashka uchun ELO hisoblash va rating yo‘qotish.
- 1200 boshlang‘ich rating va dastlabki 10 ta tez joylashtirish o‘yini.
- Bronze I dan Legend III gacha rating ligalari.
- Kuchga yaqin raqib topuvchi matchmaking navbati.
- Reytingli va do‘stlik Shashkasi alohida.
- 60 soniyalik server yurish taymeri.
- Majburiy urish, ketma-ket urish, damka va avtomatik durranglar.
- Taslim bo‘lish va durrang taklifi.
- Faol Shashka uchrashuviga qaytish.
- Faqat Shashka uchun rasmiy reyting va tarix.
- Raqib, natija, ELO o‘zgarishi, rang, yurishlar va yakun sababi.
- XP asosida cheksiz LEVEL.
- Yangi premium ko‘k, oltin va zumrad rangli dizayn.
- GitHub Actions build tekshiruvi.

## Texnologiyalar

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Edge Functions
- Telegram Mini Apps
- Cloudflare Pages

## O‘rnatish

### 1. GitHub

Loyiha papkasining barcha fayllarini yangi repository’ga joylashtiring.

```bash
npm ci
npm run verify
npm run build
```

### 2. Cloudflare Pages

Build command:

```text
npm run build
```

Output directory:

```text
dist
```

Environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### 3. Mavjud Supabase loyihasi

Oldingi `0015_add_checkers.sql` migratsiyasigacha ishlagan loyiha uchun faqat:

```text
supabase/migrations/0016_aqlband_v2_platform.sql
```

faylini Supabase SQL Editor’da ishga tushiring.

### 4. Yangi Supabase loyihasi

`supabase/migrations` ichidagi migratsiyalarni `0001` dan `0016` gacha ketma-ket ishga tushiring.

### 5. Edge Function

Quyidagi fayl bilan `aqlband-api` funksiyasini to‘liq almashtiring:

```text
supabase/functions/aqlband-api/index.ts
```

Edge Function secrets:

```text
TELEGRAM_BOT_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Telegram uchun `Legacy JWT verification` o‘chiq turadi.

## Muhim ma’lumot

Eski XP va foydalanuvchilar saqlanadi. V2 migratsiyasi barcha mavjud foydalanuvchilar uchun 1200 boshlang‘ich Shashka ratingini yaratadi. Eski mini-o‘yin natijalari XP hisobida saqlanishi mumkin, lekin yangi rasmiy tarix ekranida faqat Shashka ko‘rsatiladi.
