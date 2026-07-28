# AI V2.5 o‘rnatish

Ushbu ZIP to‘liq loyiha. GitHub’dagi loyiha fayllarini almashtirgandan keyin backendni quyidagi tartibda yangilang.

## 1. Supabase SQL

Avval V2.4 migratsiyasi hali ishga tushirilmagan bo‘lsa:

`supabase/migrations/0025_consent_ai_rating.sql`

Keyin yangi migratsiya:

`supabase/migrations/0026_daily_quests_achievements.sql`

0026 mavjud foydalanuvchi XP, ELO, o‘yin tarixi va skinlarini o‘chirmaydi. U faqat kunlik topshiriqlar, reward ledger, streak va yutuqlar jadvallarini qo‘shadi.

## 2. Edge Function

Yangi faylni `aqlband-api` Edge Function’ga deploy qiling:

`supabase/functions/aqlband-api/index.ts`

Frontenddan oldin SQL va Edge Function’ni yangilash tavsiya qilinadi. Frontend vaqtincha eski backend bilan ochilsa ham asosiy sahifa ishlashda davom etadi, faqat topshiriq kartasi backend yangilanguncha ko‘rinmaydi.

## 3. Frontend

GitHub fayllarini ushbu ZIP bilan almashtirib deploy qiling:

```bash
npm install
npm run build
```

## Sinov ro‘yxati

1. Mini Game yakunlang — “Aqlni uyg‘otish” `1/1` bo‘lishi va `+15 XP` bir marta berilishi kerak.
2. 3 xil Mini Game yakunlang — ikkinchi topshiriq ochiladi.
3. Shashka o‘ynang yoki 5 ta Mini Game yakunlang — uchinchi topshiriq ochiladi.
4. `3/3` bo‘lgach sandiqni bosing — `+50 XP` faqat bir marta beriladi.
5. Profil → “Yutuqlar” orqali progress va ochilgan badge’larni tekshiring.
6. AI shashkada foydalanuvchi yurishi darhol doskada ko‘rinishi, AI esa qisqa tabiiy pauzadan keyin yurishi kerak.
