# AqlBand V2.1 arxitekturasi

## Mahsulot modeli

1. Shashka — asosiy raqobatbardosh o‘yin.
2. ELO — faqat reytingli Shashka uchun.
3. Liga — ELO diapazonidan olinadi.
4. XP va LEVEL — barcha o‘yinlar uchun umumiy rivojlanish.
5. Tic Tac Toe — do‘stlik o‘yini.
6. Qolgan mini-o‘yinlar — yakka mashqlar.
7. Rasmiy tarix — faqat Shashka.

## Kod bo‘limlari

- `src/features/games/checkers` — Shashka yurish dvigateli.
- `src/features/checkers` — ELO va liga ko‘rsatish qoidalari.
- `src/screens/games` — Shashka, Tic Tac Toe va mini-o‘yin ekranlari.
- `src/services` — platforma, duel, do‘stlik va matchmaking API.
- `src/store` — profil, sozlama, avatar, tarix va online holat.
- `src/lib/checkersMusic.ts` — adaptiv procedural musiqa.
- `supabase/functions/aqlband-api` — server tekshiruvlari va anti-cheat.
- `supabase/migrations` — bazani 0001–0018 tartibida yaratish.

## Muhim server qoidalari

- Shashka yurishlari serverda tekshiriladi.
- Urish mavjud bo‘lsa oddiy yurish qabul qilinmaydi.
- Ketma-ket urish bitta dona bilan davom ettiriladi.
- Bir vaqtning o‘zida yuborilgan qarama-qarshi yurishlardan bittasi qabul qilinadi.
- Taymer server vaqtiga asoslanadi.
- Birinchi oq yurish 120 soniya, keyingi yurishlar 60 soniya.
- Ilovani yopish taymerni to‘xtatmaydi.
- Do‘stlik o‘yini Overall Rating’ni o‘zgartirmaydi.
