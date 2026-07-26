# Checkers Online’ni @CheckersOnlinebot’ga ulash

## Muhim

Loyiha `Checkers Online V2.6` sifatida to‘liq rebrand qilindi. Eski bot username va eski brend matnlari frontenddan olib tashlangan.

## 1. GitHub

ZIP ichidagi `CheckersOnline` papkasining ichidagi barcha fayllarni GitHub repository’ga yuklang va hosting deploy tugashini kuting.

## 2. BotFather

1. `@BotFather` → `/mybots` → `@CheckersOnlinebot`.
2. `Bot Settings` → `Menu Button`.
3. Tugma nomini `🎮 O‘YINNI BOSHLASH` deb belgilang.
4. URL sifatida yangi frontend hosting manzilini kiriting.
5. Agar Main Mini App yoqilgan bo‘lsa, uning URL manzilini ham aynan shu frontendga o‘rnating.

## 3. Supabase Edge Function

Yangi funksiyaning nomi:

`checkers-online-api`

Fayl:

`supabase/functions/checkers-online-api/index.ts`

CLI orqali:

```bash
supabase functions deploy checkers-online-api
```

Supabase Edge Function secrets ichidagi `TELEGRAM_BOT_TOKEN` qiymatini aynan `@CheckersOnlinebot` uchun BotFather bergan yangi token bilan almashtiring:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=YANGI_BOT_TOKEN
```

Tokenni GitHub yoki frontend fayllariga yozmang.

## 4. SQL

Agar V2.5 migratsiyalari shu Supabase loyihasida avval ishga tushirilgan bo‘lsa, SQL’ni qayta ishlatish shart emas. Shu Supabase loyihasidan foydalanish mavjud XP, ELO, skin, do‘stlar va tarixni saqlaydi.

Yangi, bo‘sh Supabase loyiha ishlatilsa `supabase/migrations` ichidagi fayllarni raqam tartibida ishga tushiring.

## 5. Tekshirish

1. `@CheckersOnlinebot` ichidan ilovani oching.
2. Profil nomi va ELO yuklanishini tekshiring.
3. Mini Game yakunlab XP va kunlik topshiriq progressini tekshiring.
4. “Raqib topish” orqali 10 soniyalik taklif va 20 soniyalik AI fallback’ni tekshiring.
5. AI bilan dastlabki uchta kunlik o‘yinda cheklangan ELO o‘zgarishini tekshiring.
6. Do‘stga challenge yuborilganda havola `@CheckersOnlinebot` orqali ochilishini tekshiring.
