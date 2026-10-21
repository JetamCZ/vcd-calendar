# vcd-cal

iCal feed programu Východočeského divadla Pardubice (vcd.cz) filtrovaný podle skupin předplatného.
Přidáš si URL jako odběr do kalendáře a představení tvého předplatného se objeví sama.

Bez runtime závislostí, Node 18+.

## Spuštění

```sh
npm start          # http://localhost:3000, port přes PORT=...
npm run dev        # totéž s nodemon, restart při změně src/ a public/
npm test
```

## Endpointy

| Cesta | Popis |
|---|---|
| `/` | Formulář pro sestavení URL kalendáře |
| `/vcd-ical` | iCal feed (`text/calendar`) |
| `/vcd-json` | Stejná data jako JSON, pro ladění |

### Parametry

| Parametr | Výchozí | Popis |
|---|---|---|
| `cat` | vše | Skupiny předplatného oddělené čárkou, např. `K,P1,STUDENT`. Nezáleží na velikosti písmen. |
| `months` | `6` | Kolik měsíců od aktuálního načíst (1–24). |
| `allday` | – | `1` = celodenní událost, čas začátku se přidá na začátek názvu. |
| `noauthor` | – | `1` = z názvu odstraní autora (část před posledním `/`). |
| `prefix` | – | Text před názvem události, mezeru zapiš jako `%20`. |

Parametry `allday`, `noauthor` a `prefix` ovlivňují jen `/vcd-ical`.

```
/vcd-ical?cat=K,student&months=6&allday=1&noauthor=1&prefix=DIVADLO%20-%20
→ SUMMARY: DIVADLO - 19:00 HOTEL MODRÁ HVĚZDA (K)
```

### Skupina `STUDENT`

Neoficiální skupina. Přiřadí se představením, u kterých web uvádí „slevu pro studenty“.

## Jak to funguje

Server stáhne `vcd.cz/program/?month=M&year=Y` pro každý měsíc, vytáhne regexem bloky představení
(id, den, čas, název, skupina, konec, scéna) a složí z nich iCal. Stránky se cachují v paměti hodinu.

Událost obsahuje název se skupinami, začátek a konec (z „konec v HH:MM“, jinak +2 h), scénu
s adresou pro Městské divadlo a Malou scénu ve dvoře, popis a odkaz na inscenaci. UID je id představení
z webu, takže se při aktualizaci odběru události neduplikují.

## Soubory

- `src/config.js` – konfigurace (URL webu, cache, adresy scén, limity parametrů)
- `src/parser.js` – parsování HTML programu, regexy pro markup vcd.cz na jednom místě
- `src/vcd.js` – stahování měsíců z vcd.cz s cache v paměti
- `src/ical.js` – sestavení iCal feedu
- `src/server.js` – HTTP server a routy
- `public/` – formulář na `/` a logo
- `test/` – test parseru na reálném bloku HTML (`fixture.html`)
