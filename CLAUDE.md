# MyWepp-prototype — werkafspraken en geparkeerd werk

Prototype van de gebruikersadministratie van MyWepp: een beheeromgeving voor
zorggroepen plus een telefoon-app (MyWepp Personal). Statische pagina, vanilla
JS, Supabase als opslag, Vercel als hosting.

## Hoe hier gewerkt wordt

- **Werk op `master`.** Geen aparte takken of pull requests, tenzij iets eerst
  ter goedkeuring moet. Dan een losse tak, en pas mergen als de klant ja zegt.
- **Backuptak vóór een grote wijziging** (meer dan een handvol dingen in één
  commit).
- **Twee bestanden, altijd identiek:** `mywepp-prototype/index.html` is wat
  Vercel publiceert, `source/admin-tools-personal-app.html` is de kopie. Na elke
  wijziging kopiëren en met `diff` controleren.
- **Alles wordt aangetoond, niet beweerd.** Een bevinding pas melden als hij met
  Playwright is gereproduceerd; een fix pas af als dezelfde test hem groen laat
  zien. Bij twijfel of iets een regressie is: dezelfde test tegen de vorige
  versie draaien als controle.
- **Commits en comments in het Nederlands**, en een comment legt uit *waarom*
  iets zo is, niet wat er staat.
- Ideeën en uitgewerkte functies eerst laten zien voordat ze naar master gaan.

## Testen

Testscripts staan in de scratchpad van de sessie, niet in de repo.

```
python3 -m http.server 8731 --directory mywepp-prototype/     # testserver
NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node <test>.js 8731
./start-regressie.sh                                          # alles, ~45 min
```

Elk testscript neemt de poort als eerste argument. Let op twee vallen die al
meermaals toesloegen:

- De accordeons in het formulier staan standaard **dicht**. Een test die op een
  rij klikt moet ze eerst openzetten.
- `hidden` werkt niet op elementen met een expliciete `display` in de CSS
  (`.bottomnav`, `.bottomnav button`). Controleer zichtbaarheid met
  `offsetParent`, niet met de `hidden`-property — een test die dat niet doet
  meldt groen terwijl het scherm iets anders laat zien.

## Supabase

Project `yaooauluqhhldfuwnanq`. Tabellen: `personen`, `groepen`,
`organisatie_data` (sleutel/waarde), `logboek`, `client_data`, `chat_threads`,
`datalekken`. RLS staat aan; een ontbrekende policy laat een `delete` stil
mislukken — dat is twee keer misgegaan, dus bij een nieuwe schrijfactie altijd
de policy nalopen.

De sandbox kan **niet** bij Vercel of bij Supabase over HTTP. De Supabase
MCP-tools werken wel.

## Niet aankomen zonder overleg

De productie-testrijen in `personen`: `Dean Huizen` (7), `Test Test` (8, 11),
`Test Test Medewerker` (13), `Dean Schouten` (15), `Tttt TEST` (14),
`TEST Ttt` (16), `Dit Is Een Test` (17), en de groep `Test groep`. Die staan in
de live database en mogen alleen met expliciete toestemming weg.

## Wat er in zit (grote brokken)

Alles hieronder staat in master.

**Cliëntkant (MyWepp Personal)** — Vandaag (`renderCaVandaag`), meldingen met
een bel (`MELDINGEN`, `nieuweMelding`, `renderCaMeldingen`), cliëntweergave met
grote letters en een beperkt menu (`zetClientweergave`, `CA_CLIENTTABS`).

**Adminkant** — periodieke toegangscontrole (`openToegangscontrole`,
`CONTROLE_MAANDEN`, opslag onder `toegangscontrole`), uit dienst als één
handeling (`uitDienstFlow`, `wieBlijftLiggen`), meerdere mensen toevoegen door
plakken (`importFlow`, `leesImportregels`), gekoppelde groepen
(`groepKoppelingen`, `clusterVan`, `vulKoppelingAan`), wijzigingen doorvoeren
vanuit de Admin Tools (`voerWijzigingenDoor`).

**Gegevens** — statistieken komen uit het dossier zelf (`statistiekVoor`), niet
uit een formule. Maaltijdaanmeldingen staan op de hele datum
(`maaltijdSleutel`), niet op dagnummer: dat laatste brak zodra de kalender een
maandkeuze kreeg. Het logboek filtert op periode (`logboekDatum`).

**Verborgen op verzoek**, als comment in de code met een markering eromheen,
dus terug te zetten door die comment weg te halen: het scherm Bereikbaarheid
(`bereikbaarheid`), en de knoppen Rechtensets
(`rechtensets`) en Groepeer (`groepeer`). Die laatste twee openden allebei
Standaardrollen. Het hele kopje Overzichten is weg (`overzichten`): Wie ziet
wie, Zoeken en AVG zijn verborgen, Groepen beheren is weggehaald (het scherm
`admintab-groepen` bestaat nog en is alleen te bereiken via inloggen als
systeembeheer en na Groep maken — daar zit het koppelen van groepen).
Standaardrollen staat nu onder Bewerken, Controle onder Overig.

## Wacht op goedkeuring: tak `specificaties-rollen`

De grote specificatie (rollen, knoppen, zoeken, audit trail) staat op tak
`specificaties-rollen`, in vier commits (stap 1 t/m 4). Backup van daarvoor:
`backup/voor-specificaties-rollen`. Nog niet in master — pas mergen na ja van
de klant. Tests: `spec1.js` t/m `spec4.js` in de scratchpad.

- Rollen: categorie `locatie` (medewerker) en `clienten` = "Cliënt" (naaste)
  in `ROLLEN`/`RECHTEN`/`orgDefault`; oude opgeslagen standaarden worden
  aangevuld via `vulRolCategorieenAan`. Per persoon een rolkeuze als de groep
  optionele rollen heeft (`rolKeuzes`, `rolVan`, kolom `personen.rollen`).
- Voor- en achternaam verplicht (`toonNaamFout`), ook in Mijn profiel.
- Blokkeren/Verwijderen alleen bij bewerken; `verwijderVanuitProfiel`.
- Rechten overnemen bouwt het profiel niet meer opnieuw op
  (`leesProfielConcept`/`zetProfielConceptTerug`); overzicht met Toon meer.
- Herbruikbaar zoekveld `koppelZoekveld`, `maakLijstZoekbaar` (altijd zichtbaar, `ZOEK_VANAF=0`).
- Titel "Gebruikersbeheer – groep" (`toonGroepInTitel`); na opslaan terug
  naar herkomst (`profielHerkomst`, `naarHerkomst`).
- Logboek: `logActie(tekst,{soort,reden})`, kolommen `logboek.soort/reden`;
  `soortVanActie` leidt het soort af voor oude regels.
- Archief: prullenbak (nog niet doorgevoerd) + archief (soft delete),
  `BEWAARTERMIJN_JAREN=15`, `bewaarTot`, kolom `personen.gearchiveerd_reden`;
  vroegtijdig wissen vereist een reden. Let op: WGBO-dossiers = 20 jaar.

De Supabase-kolommen (`personen.rollen`, `personen.gearchiveerd_reden`,
`logboek.soort`, `logboek.reden`) staan al in de live database; master
gebruikt ze niet en werkt gewoon door.

## Andere takken

De werktakken `formulier-vereenvoudigd`, `nieuwe-functies`, `verbeterronde-2` en
`verbeterronde-3` zijn allemaal in master opgegaan. De `backup/`- en
`backup-*`-takken zijn momentopnamen van vóór een grote wijziging;
`backup/voor-merge-drie-takken` is de stand van vóór het samenvoegen van die
laatste drie.

Let op bij het samenvoegen van takken die naast elkaar lopen: git meldde geen
conflict terwijl het Vandaag-scherm en de maaltijdsleutel uit twee verschillende
rondes wel degelijk botsten. Na een merge dus niet alleen `node --check` maar ook
de schermen zelf nalopen.
