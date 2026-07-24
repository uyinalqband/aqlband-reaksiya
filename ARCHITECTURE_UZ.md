# AqlBand V2 arxitekturasi

## Mahsulot darajalari

### 1. Shashka mahorati
`checkers_ratings` va `checkers_rating_events` orqali boshqariladi.

- Faqat `checkers_mode = rated` o‘yinlar ELO’ga ta’sir qiladi.
- Do‘stlik Shashkasi ratingni o‘zgartirmaydi.
- Natija PostgreSQL tranzaksiyasida bir marta hisoblanadi.
- Mag‘lubiyat ELO’ni kamaytiradi.
- Liga nomlari frontenddagi `src/features/checkers/rating.ts` orqali ELO’dan olinadi.

### 2. Platforma faolligi
Mavjud XP tizimi saqlanadi.

- Barcha yakka mini-o‘yinlar XP beradi.
- Shashka va Tic Tac Toe ham XP berishi mumkin.
- XP `src/features/progression/levels.ts` orqali cheksiz LEVEL’ga aylantiriladi.
- LEVEL va ELO bir-biriga ta’sir qilmaydi.

### 3. Rasmiy tarix
`CheckersHistoryScreen` faqat Shashka urinishlarini serverdan oladi.

- raqib;
- natija;
- rated yoki friendly;
- ELO oldin/keyin/delta;
- dona rangi;
- yurishlar;
- urilgan donalar;
- davomiylik;
- yakun sababi.

## Matchmaking

`join_checkers_matchmaking(uuid)` PostgreSQL funksiyasi:

- foydalanuvchining faol o‘yinini tekshiradi;
- navbat qatorini tranzaksiya ichida qulflaydi;
- `FOR UPDATE SKIP LOCKED` bilan ikki marta juftlashishni to‘sadi;
- dastlab ±100 ELO oralig‘ida qidiradi;
- har 15 soniyada qidiruv oralig‘ini 50 ELO ga kengaytiradi;
- maksimal oralig‘ ±500;
- oq/qora rangni tasodifiy belgilaydi;
- rated duelni `ready_check` holatida yaratadi.

## Xavfsizlik

- Telegram initData imzosi Edge Function’da tekshiriladi.
- Service role kaliti brauzerga berilmaydi.
- Shashka yurishlari serverda tekshiriladi.
- ELO PostgreSQL tranzaksiyasida, duel qatori bloklangan holda hisoblanadi.
- Rating hodisasi `(duel_id, user_id)` unique cheklovi bilan idempotent.
- Matchmaking jadvallari RLS bilan yopilgan.
- Eski mini-o‘yin duel yaratish API’si o‘chirilgan.
