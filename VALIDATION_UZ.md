# AqlBand V2.1 tekshiruv hisoboti

## Muvaffaqiyatli tekshiruvlar

- Project verification script: OK
- 87 ta TypeScript/TSX manba faylining sintaksis transpilyatsiyasi: OK
- Ishlatilmayotgan importlar tekshiruvi: OK
- Barcha lokal `@/` import yo‘llari: OK
- O‘zbek, ingliz va rus tarjima JSON fayllari: OK
- Shashka boshlang‘ich holati: 12 oq + 12 qora dona
- Boshlang‘ich ruxsat etilgan yurishlar: 7
- Oddiy donaning orqaga urishi: OK
- Majburiy urish: OK
- Ketma-ket urish: OK
- Damkaga aylanish: OK
- Uzoq yuruvchi damka: OK
- Optimistik bir bosishli yurish: qo‘shildi
- Serverda bevosita o‘yin boshlanishi: qo‘shildi
- Birinchi yurish 2 daqiqa: UI, Edge Function va 0018 migratsiyada
- Keyingi yurishlar 1 daqiqa: saqlandi
- Reytingli o‘yin ELO snapshotlari: 0018 migratsiyada
- Mini-o‘yinlarda avtomatik 1 raund / very-hard: qo‘shildi
- Tayyor va countdown ekranlari: Shashka va Tic Tac Toe’dan olib tashlandi

## Muhim cheklov

To‘liq `npm run build` ushbu ishchi muhitda yakunlanmadi, chunki lokal
`node_modules` to‘liq o‘rnatilmagan va npm dependency o‘rnatilishi vaqt
chegarasidan oshdi. Source sintaksisi va loyiha ichki verifikatsiyasi o‘tdi.
Yakuniy haqiqiy build Cloudflare Pages’da bajariladi.

Ikki real Telegram akkauntida to‘liq online o‘yin sinovi bu muhitda
bajarilmadi. Deploydan keyin `INSTALL_UZ.txt` dagi 10 bosqichli sinovni bajaring.
