# Checkers Online 2.7 ni joylashtirish

Quyidagi ishlarni aynan shu tartibda bajaring.

## 1. GitHub

ZIP ichidagi barcha fayllarni GitHub loyihangizga yuklang. `node_modules`
papkasini yuklash kerak emas.

## 2. Supabase SQL

Supabase → SQL Editor → New query oynasini oching.
`supabase/migrations/0033_reliability_timezone_and_security.sql` faylining
barcha matnini ko‘chirib, Run tugmasini bosing. Bu migratsiya faqat bir marta
bajariladi.

## 3. Edge Functions

Supabase’da quyidagi ikkita funksiyani yangi ZIPdagi kod bilan qayta deploy
qiling:

- `supabase/functions/aqlband-api/index.ts`
- `supabase/functions/checkers-bot/index.ts`

Secret qiymatlarini o‘zgartirish shart emas.

## 4. Kun qahramoni jadvali

Supabase Cron’da har kuni Toshkent vaqti bilan 09:00 da quyidagi Edge Function
amalini chaqiradigan vazifa ishlayotganini tekshiring:

```json
{"action":"announcements"}
```

UTC bo‘yicha bu `0 4 * * *` jadvalidir. Yakshanba kuni shu chaqiruv kun
qahramoni bilan birga hafta qahramonini ham e’lon qiladi. Kecha yakunlangan
o‘yin bo‘lmasa xabar yuborilmaydi.

## Tekshirish

Telegram botni to‘liq yoping va qayta oching. Keyin:

1. Reytingda 0 ta o‘yin o‘ynagan begona akkauntlar ko‘rinmasligini tekshiring.
2. Raqib chaqiruvi 10 soniyada bekor bo‘lishini tekshiring.
3. Mini Game ichidagi orqaga tugmasi O‘yinlar bo‘limiga qaytishini tekshiring.
4. Ruscha va inglizcha rejimda trening hamda kunlik maqsadlar tarjima
   qilinganini tekshiring.

## Ma’lum tashqi cheklov

`npm audit` React Router 6 uchun ikkita o‘rtacha darajadagi ogohlantirish
ko‘rsatadi. Paket ishlab chiqaruvchisi 6-versiya uchun buzmaydigan avtomatik
tuzatish bermagan. Ilova server-side React Router hydration ishlatmaydi va
ichki navigatsiyada oldindan belgilangan yo‘llardan foydalanadi. Shu sababli
hozir 7-versiyaga shoshilinch ko‘chirish ilovani buzish xavfi yuqoriroq.
Keyingi alohida relizda Router 7 migratsiyasi va to‘liq regression testi
qilinishi kerak.
