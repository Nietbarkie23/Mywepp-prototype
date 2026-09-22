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

## Geparkeerd: zes functies op tak `nieuwe-functies`

Af, getest en met screenshots getoond, maar **bewust niet naar master**. Commit
`nieuwe-functies` bevat ze alle zes. Mergen kan zodra de klant akkoord is.

**Cliëntkant**

1. **Vandaag** — nieuw eerste tabblad in MyWepp Personal: afspraken van vandaag,
   actieve geheugensteuntjes, of de cliënt mee-eet, en de laatste rapportage.
   Functies: `renderCaVandaag`, `afsprakenVandaag`, `laatsteRapportage`.
2. **Meldingen** — bel met teller in de telefoonbalk. De vier schakelaars bij
   Meer instellingen bepaalden iets wat nergens binnenkwam; nu wel. Functies:
   `MELDINGEN`, `nieuweMelding`, `renderCaMeldingen`, `werkBelBij`, `zetCaTab`.
3. **Cliëntweergave** — grote letters, alleen Vandaag/Agenda/Ik-Boek/Chat, geen
   bewerkknoppen. Functie: `zetClientweergave`, constante `CA_CLIENTTABS`.

**Adminkant**

4. **Periodieke toegangscontrole** — vijftiende controlesignaal plus een scherm
   om per cliënt de toegangslijst na te lopen en in te trekken, met vastlegging
   van wie het wanneer deed. Functies: `openToegangscontrole`,
   `maandenSindsControle`; constante `CONTROLE_MAANDEN` (6); opslag onder
   `toegangscontrole` in `organisatie_data`.
5. **Uit dienst** — één handeling in plaats van vijf (blokkeren, einddatum,
   rechten intrekken, contactpersoonschap en taken overdragen, archiveren
   klaarzetten), met vooraf een lijst van wat er blijft liggen. Functies:
   `uitDienstFlow`, `uitDienstVenster`, `wieBlijftLiggen`.
6. **Meerdere mensen toevoegen** — plakken uit een lijst met een voorbeeld dat
   per regel zegt wat er misgaat. Functies: `importFlow`, `leesImportregels`;
   `pushNew` is gesplitst in `maakPersoon` (alleen aanmaken) en `pushNew`
   (aanmaken én het profiel openen).

Meegenomen in diezelfde commit: "2 taaken" in twee logregels, en
`.bottomnav button[hidden]{display:none}` voor de hierboven genoemde CSS-val.

## Andere takken

`formulier-vereenvoudigd` is inmiddels in master; `backup/formulier-tekst-voor`
is de stand van daarvóór. De oudere `backup-*`-takken zijn momentopnamen van
eerdere rondes.
