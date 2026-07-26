# AqlBand V2.2

AqlBand — Shashka markazidagi raqobatbardosh Telegram Mini App platformasi.

## Asosiy tizim

- **Shashka** — reytingli asosiy o‘yin.
- **Overall Rating / ELO** — faqat reytingli Shashka natijasiga bog‘liq.
- G‘alabada ELO oshadi, mag‘lubiyatda kamayadi.
- Bronze–Legend ligalari ELO asosida.
- **XP va LEVEL** — barcha o‘yinlardagi umumiy faollik uchun.
- **Tic Tac Toe** — faqat do‘st bilan, ELO’siz.
- Boshqa mini-o‘yinlar — faqat yakka, 1 raund va maksimal qiyinlikda.
- Rasmiy o‘yin tarixida faqat Shashka uchrashuvlari.

## V2.1 yangiliklari

- Mini-o‘yinlarda sozlash va qiyinchilik tanlash oynasi yo‘q.
- Shashka va Tic Tac Toe’da “Tayyorman” hamda 5 soniyalik sanoq yo‘q.
- Reytingli Shashka raqib topilishi bilan darhol boshlanadi.
- Oq donaning birinchi yurishi 2 daqiqa, keyingi yurishlar 1 daqiqa.
- Zamonaviy Shashka doskasi va premium tosh dizayni.
- Raqib doska tepasida, foydalanuvchi doska tagida.
- Ism, avatar, ELO, taymer, musiqa tugmasi va urilgan toshlar ko‘rinadi.
- Urilgan toshlar raqam o‘rniga haqiqiy tosh belgilarida tasvirlanadi.
- Tosh va katak bir martalik bosish bilan ishlaydi.
- Optimistik yurish sabab doska server javobini kutmasdan darhol harakatlanadi.
- Reytingda username ko‘rsatilmaydi.
- Avatar reytingdan tashqari asosiy ekranlarda ko‘rinadi.
- Adaptiv original Shashka musiqasi vaqt kamaygan sari kuchayadi.
- Profil ismini o‘zgartirish va avatarni bosib tanlash mumkin.

## V2.2 interfeys yangiliklari

- Pastki menyu: Bosh sahifa, O‘yinlar, Reyting va Profil.
- Bildirishnomalar bosh sahifadagi qo‘ng‘iroq tugmasiga ko‘chirildi.
- Shashka bosh sahifadagi yagona asosiy o‘yin sifatida ajratildi.
- Tezkor mashg‘ulotlar bosh sahifada, barcha o‘yinlar esa alohida katalogda.
- O‘yinlar tezlik, xotira, diqqat va mantiq bo‘yicha filtrlashga ajratildi.
- Profil: Profil, Do‘stlar va Ko‘rinish ichki bo‘limlariga ajratildi.
- Reyting: Shashka ELO va umumiy XP faollik reytingi.
- Barcha muhim tugmalar mobil qurilmalarda qulay bosiladigan o‘lchamga keltirildi.

## Ishga tushirish

```bash
npm ci
npm run dev
```

Tekshiruv:

```bash
npm run verify
npm run typecheck
npm run lint
npm run build
```

Deploy ko‘rsatmalari `INSTALL_UZ.txt` faylida.
