# AI V2.4 o‘rnatish

Bu ZIP to‘liq loyiha. GitHub’dagi eski fayllarni almashtirgandan keyin quyidagi ikki backend qadam majburiy.

## 1. Supabase SQL

SQL Editor’da faqat yangi migratsiyani ishga tushiring:

`supabase/migrations/0025_consent_ai_rating.sql`

U 10 soniyalik rozilik oqimini, taklif natijasi bildirishini va AI o‘yinlaridagi cheklangan ELO ta’sirini qo‘shadi.

## 2. Edge Function

Quyidagi faylning yangi nusxasini `aqlband-api` Edge Function’ga deploy qiling:

`supabase/functions/aqlband-api/index.ts`

SQL va Edge Function birga yangilanmasa AI reytingi yoki taklif natijasi ishlamaydi.

## 3. Frontend

GitHub/Vercel’dagi barcha loyiha fayllarini ushbu ZIP bilan almashtirib deploy qiling. Build tekshiruvi:

```bash
npm install
npm run build
```

## Tezkor sinov

1. A foydalanuvchi “Raqib topish”ni bosadi.
2. B foydalanuvchi boshqa sahifada online turadi: unga 10 soniyalik ✅/❌ taklif chiqadi.
3. B hech narsa bosmasa taklif rad etiladi va A’da qidiruv davom etayotgani ko‘rinadi.
4. 20 soniyada inson qabul qilmasa AI o‘yini boshlanadi.
5. AI belgisi avatar tagida, emoji esa 5 soniyadan keyin yo‘qoladi.
6. Mini Game sahifasida 3 mashqli kundalik trening, tavsiya, mahorat xaritasi va missiyalar ko‘rinadi.
