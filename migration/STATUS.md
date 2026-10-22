# Stav přenosu Radaru — 22. října 2026

## Prokazatelný checkpoint

Pracovní frontend v GitHubu: `ccff092a0f830c98f75ff697a0ec43866fe43135`. Obsahuje skutečné původní hlavní obrazovky, API kontrakty a pomocné funkce; nový filtr Mých a lokální export jsou oddělené malé změny. Build i browser QA: https://github.com/prouza-hue/radar/actions/runs/39864023978 (success).

Artefakty této kontroly: `radar-compiled-build` (12462643292) a `radar-browser-evidence` (12463610606). Dočasné Actions artefakty mají 14denní retenci; zdroj a ověřené veřejné assety jsou trvale commitnuté. Starý první CI běh byl nahrazen novým po doplnění časových limitů testovacího prohlížeče.

## Co zůstalo beze změny

Původní publikovaný Radar, Live databáze a uživatelská označení. Nebyl proveden deployment na původní Convex, import, vypnutí aplikace ani práce s účtem vlastníka. Anonymní katalogové požadavky mohou standardně obnovit společnou metadata cache.

## Zachování osobního účtu v první fázi

Nový frontend má v prostředí veřejné `VITE_CONVEX_URL=https://ceaseless-chameleon-385.eu-west-1.convex.cloud`. To zachovává stejná data; samo o sobě to není záloha ani odchod od Macaly backendu.

Přechodný režim `VITE_MIGRATION_MODE=true` nabízí `/connect`. Vygeneruje privátní jednorázový proof v paměti nového prohlížeče, serveru předá pouze SHA-256 a vlastníku ukáže veřejný párovací kód. Vlastník jej výslovně schválí na původní `/tv` pod svým skutečným účtem. Používá legitimní existující `tv-device` provider bez nové identity. Nikdy nevyzvedává nebo nevkládá token staré relace.

Přechodná relace nemá právo spravovat Google ani další TV, proto tyto části nového účtu odkazují na původní `/account`. Párování ani soukromé zápisy vlastníka nebyly za něj testované. Není doloženo, že Google autorizace nové domény funguje; přechodný režim ji nepředstírá.

## Osobní záloha a obnova

Po připojení vlastník otevře Moje a nechá doběhnout původní doplnění legacy historie. Pak `/backup` stáhne čtecí export `radar-personal-state` v1: všechny relation záznamy, uložené/oblíbené/skryté/viděné příznaky, původní datum přidání, odběr titulu a jednotlivé aktuálně viděné epizody. Před/po exportu se porovná sada klíčů, revize a příznaky; stránkování musí skončit, nejsou povolené duplicity, změna vlastníka ani `progressLimited`.

Tento export neobsahuje původní časy sledování epizod, dříve odznačené rows, autentizační tabulky, push subscription klíče ani záruku neexistence starých orphan rows. Není náhradou úplného Convex snapshotu. Skutečný export vlastníka zatím není stažený.

Nástroj `tools/prepare_personal_import.py` pouze offline ověří JSON a vytvoří dvě JSONL plus auditní plán pro NOVÉ prázdné tabulky `user_titles` a `watched_episodes`. Vyžaduje skutečné cílové `users._id` ověřené po přihlášení do nové aplikace; neodvozuje jej z e-mailu. Zachová `addedAt` a příznaky. `watchedAt` musí být označený čas obnovy (použit export timestamp), ne vymyšlený původní čas sledování.

Příklad čistě lokální přípravy mimo repo:

```sh
python migration/tools/prepare_personal_import.py /private/radar-backup.json --target-user-id ACTUAL_DESTINATION_USER_ID --out /private/radar-restore
```

Teprve po kontrole nového deploymentu, auth vazeb a prázdných tabulek lze jeho autorizovaným Convex CLI použít `npx convex import --table user_titles /private/radar-restore/user_titles.jsonl` a totéž pro `watched_episodes`. Nikdy nepřidávat `--append`, `--replace`, `--replace-all` a nikdy nepouštět proti zdrojové Live DB. Metadata titulů a followers je třeba v cíli doplnit a každý záznam/epizodu poté porovnat. Tento import nebyl vykonaný. Preferovaná cesta zůstává úplný Live snapshot, pokud bude dostupný.

Primární import dokumentace: https://docs.convex.dev/database/import-export/import

## Lovable

Projekt: https://lovable.dev/projects/b5710865-a4da-47cd-bd82-16d057ee3cc3

Uvnitř jsou zatím archivní dávky a výchozí staging, nikoli pracovní frontend z tohoto repozitáře. Poslední skutečný požadavek na implementaci byl odmítnut kvůli vyčerpaným kreditům. Reálná záchrana, build a testy se proto přesunuly do GitHub Actions bez dalších agentních kreditů Lovable.

GitHub účet je již připojený pro jiné projekty. Konkrétní projekt Radar nemá doložený Git sync. V dostupných nástrojích není správní akce pro tuto vazbu a Browser umí v této relaci jen číst záložky. Podle oficiálního postupu vlastník propojí tento projekt v Project settings → Git → GitHub → Connect u již existujícího prouza-hue. Lovable si vytváří vlastní nový soukromý synchronizovaný repozitář; neváže ručně vytvořený existující repo. Potom lze přes GitHub connector do jeho main přenést zde otestovanou pracovní verzi při zachování Lovable nativní build konfigurace. Nezakládat další prázdný projekt a neopakovat propojení workspace účtu.

Primární dokumentace: https://docs.lovable.dev/integrations/github

## Zbývá před označením migrace za dokončenou

- Přenést pracovní frontend do skutečně synchronizovaného Lovable repo, ověřit jeho build a publikaci.
- Nechat vlastníka potvrdit připojení původního účtu a stáhnout skutečnou zálohu.
- Získat všechny potřebné zbývající originální serverové/TV soubory, soukromou konfiguraci a podpisový klíč.
- Převést backend pod kontrolu vlastníka nebo vytvořit nový, importovat a porovnat skutečná data; osamostatnit Google/OTP, upravit push guard a adresy APK.
- Fyzicky ověřit aktualizovanou TV aplikaci a relace; až potom případně vypínat starý hosting.
