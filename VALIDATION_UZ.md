# AqlBand V2 tekshiruv hisoboti

## O‘tkazilgan tekshiruvlar

- 85 ta TypeScript/TSX manba fayllari sintaksis transpilyatsiyasi: **OK**
- O‘zgargan frontend fayllari strict semantik TypeScript tekshiruvi: **OK**
- Edge Function TypeScript semantik tekshiruvi: **OK**
- Ishlatilmayotgan importlar: **topilmadi**
- Barcha `@/` lokal import yo‘llari: **OK**
- O‘zbek, ingliz va rus tarjima kalitlari: **OK**
- Shashka katalogdagi birinchi o‘yin: **OK**
- Mini-o‘yinlardan do‘stlik tugmasi olib tashlangan: **OK**
- Do‘stlik dueli API’si faqat Shashka va Tic Tac Toe uchun: **OK**
- Eski ochiq duel yaratish API’si: **o‘chirilgan**
- Shashka qoidalari:
  - boshlang‘ich 12+12 dona: **OK**
  - 7 ta boshlang‘ich yurish: **OK**
  - majburiy urish: **OK**
  - orqaga urish: **OK**
  - ketma-ket urish: **OK**
  - damka: **OK**
  - uzoq yuruvchi damka: **OK**
- ELO formulasi:
  - g‘alabada ijobiy delta: **OK**
  - mag‘lubiyatda manfiy delta: **OK**
  - kuchli raqibni yutishda ko‘proq delta: **OK**
- ELO hisoblash PostgreSQL tranzaksiyasi va duel lock: **mavjud**
- Matchmaking `FOR UPDATE SKIP LOCKED`: **mavjud**
- Rating hodisalari idempotent unique cheklovi: **mavjud**
- LEVEL formulasi 0 dan katta XP qiymatlarida: **OK**
- SQL migratsiyadagi dollar quote va qavslar balansi: **OK**

## To‘liq npm build holati

`npm ci` orqali to‘liq dependency o‘rnatish sinab ko‘rildi. Lokal muhitdagi ichki npm registry
`yocto-queue` paketida **HTTP 503 Service Temporarily Unavailable** qaytardi. Shu sabab bu muhitda
yakuniy `npm run build` bajarilmadi.

Kod global TypeScript kompilyatori, semantik shims, import tekshiruvlari va loyiha verifikatori orqali
tekshirildi. Cloudflare build dependency registry ishlaganda yakuniy real buildni bajaradi.
