# Seriálový Radar

Původní český filmový a seriálový tracker přenášený z Macaly. Tento repozitář již obsahuje sestavitelný původní frontend, nikoli maketu podle screenshotů. Databáze zůstává prozatím původní Live Convex; osobní data nebyla kopírována do tohoto repozitáře ani přepsána.

## Co je hotové

- Původní Domů / Objevuj / Hledat / Moje, detaily, epizody, srdíčka, skryté tipy a řazení.
- Nový filtr **Vše / Seriály / Filmy** v Mých, kombinovaný se stavem a řazením.
- Původní světlé/tmavé styly, Fold rozložení, ikony a podepsané TV APK se Stremiem/Jellyfinem. CSS je zachráněný původní zkompilovaný artefakt, nikoli úplná kopie všech zdrojových stylů.
- Přechodné připojení původního účtu přes výslovně schválený jednorázový kód na starém Radaru (`/connect`). Nevytváří nový účet ani nepřiřazuje historii podle e-mailového odhadu.
- Čtecí osobní záloha (`/backup`) se stránkováním, kontrolou úplnosti a kontrolou změn během exportu. Žádné soukromé exporty do Gitu.
- Offline příprava obnovy této zálohy do NOVÉ prázdné databáze: `migration/tools/prepare_personal_import.py`. Není to automatická migrace ani plná databázová záloha.

## Ověření

[GitHub Actions — úspěšný build, testy a browser QA](https://github.com/prouza-hue/radar/actions/runs/39864023978).

19 Node testů pro filtr a export, build a TypeScript prošly. Skutečný anonymní katalog, hledání Arrival, detail a Stremio odkaz byly ověřeny při 390/590/1280 CSS px ve světlém i tmavém režimu, bez horizontálního přetečení. Osobní účet vlastníka nebyl v těchto testech použitý a export jeho skutečných dat zatím neproběhl. Samostatných 10 lokálních Python testů pokrývá přípravu importu.

## Spuštění

Node 22. Zkopíruj `.env.example` do `.env.local` (obsahuje jen veřejnou adresu backendu a přepínač přechodného režimu), poté:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run typecheck
npm run dev
```

Původní veřejné CSS, ikony a APK jsou již uložené v `public/`; build je nemusí znovu stahovat z Macaly. Jejich původ a SHA-256 jsou v `migration/PUBLIC_ASSETS.json`. CI ověřuje shodu a případně obnoví jen tyto konkrétní veřejné soubory.

## Co ještě není dokončené

Lovable staging projekt existuje, ale poslední požadavek na nahrání pracovní verze odmítl kvůli vyčerpaným kreditům. Repozitář `prouza-hue/radar` zatím nemá doloženou automatickou vazbu na tento konkrétní projekt Lovable. Samotný GitHub účet propojený je; to není totéž jako propojení projektu.

Nejsou dokončené: úplná záchrana všech 205 původních souborů, nezávislé vlastnictví backendu, úplný export Live databáze, přenos serverových tajných hodnot ani privátního podpisového klíče APK. `convex/` je zatím částečně zachráněný původní serverový zdroj — **nespouštět jeho deploy přes současnou produkci**.

Dokud nebude ověřená samostatná databáze a přihlášení, nevypínat původní Radar. Současný build ukazuje přesun webového rozhraní se zachovanou databází, nikoli úplné odstřižení od Macaly.

## Bezpečnost

Repozitář vytvořený vlastníkem je veřejný. Patří sem pouze kód a veřejné assety. Nikdy sem nepatří `.env` hodnoty, osobní JSON/ZIP exporty, tokeny, provider secrets, keystore nebo hesla. Soukromé zálohy držet mimo checkout. Podrobnosti a zbývající kroky: [migration/STATUS.md](migration/STATUS.md).
