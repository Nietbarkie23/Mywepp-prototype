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

Met de echte databasebibliotheek testen: `scratchpad/metlib/` is een kopie van
de pagina die `supabase.js` (2.117.1, uit het npm-pakket) lokaal laadt; serveer
die op poort 8734 en vang de database-aanroepen af met
`page.route('**/rest/v1/**', …)` (zie `geladen-opslaan.js`, `traagladen.js`).
Zo is laden, opslaan en een trage of mislukte verbinding na te spelen zonder
bij de echte database te komen. Na een wijziging de kopie opnieuw maken.

Toegankelijkheid meten: `axe-scan.js` (overzicht per regel) en `axe-kleur2.js`
(contrast per kleurpaar) gebruiken axe-core uit `scratchpad/axe/` (via npm).
Animaties worden tijdens de meting uitgezet; anders meet axe een scherm
halverwege het invagen en meldt het onterecht te weinig contrast.

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
systeembeheer en na Groep maken; het koppelen van groepen staat nu bij Groep
bewerken).
Standaardrollen staat nu onder Bewerken, Controle onder Overig. De knop Uit
dienst is ook weggehaald (`uitdienst`); `uitDienstFlow` staat nog in de code.

**Ziekmelden staat uit** (`ZIEKMELDEN=false`, `isZiek`, HTML-comment
`ziekmelden`): geen vinkje, geen Ziek-label, geen doorschakeling naar
contactpersoon 2, geen controlesignaal. De opgeslagen `status='ziek'` blijft in
de database staan (live: Marieke de Vries, id 3, en rij 19) — niet zonder
overleg aanpassen. Terugzetten = comment weg en `ZIEKMELDEN=true`.

**Rechten overnemen** staat onder het kopje Rollen en rechten. In de rij
`pp-accountacties` staat alleen nog Inzage (AVG); die rij is bij aanmaken weg.
**Verwijderen** staat onderaan het profiel, links naast Annuleren/Opslaan.

**Toegang blokkeren** is als knop weggehaald (HTML-comment `blokkeren`,
`wisselBlokkade` bestaat nog). Een bestaande blokkade blijft gelden en staat
met reden in het profiel. Live geblokkeerd: Stagaire Mywepp (id 18) — niet
zonder overleg opheffen.

**Groepsgegevens** (naam, adres, telefoon, e-mail op het groepsprofiel) zijn
per groep te bewerken via het potlood rechtsboven (`renderHubGegevens`,
`groepGegevens`, opslag onder `groep_gegevens`). Het adres staat in delen
(straat, huisnr, postcode, plaats); een oude adresregel wordt gesplitst
(`splitsAdres`). Zonder eigen gegevens toont een groep de oude
voorbeeldwaarden (`GROEP_STANDAARD`). Hernoemen gaat voor beide ingangen via
`hernoemGroepOveral`, die ook tweestaps, Digibord, koppelingen en locatie
meeneemt — een nieuwe opslag per groepsnaam moet daar ook in.

**Verplicht bij medewerkers en naasten:** voornaam, achternaam en e-mailadres
(profiel, Meerdere toevoegen, Mijn profiel). Bij cliënten is het e-mailadres
optioneel, want dat wordt zo nodig gegenereerd. Bij het aanmaken staan alleen
"Rechten overnemen"; Inzage (AVG) en Verwijderen alleen bij
bewerken.

## Specificatie rollen en gebruikersbeheer (in master)

De grote specificatie (rollen, knoppen, zoeken, audit trail) is samen met het
koppelen via Groep bewerken in master gezet. Backups: van vóór de specificatie
`backup/voor-specificaties-rollen`, van vóór het samenvoegen
`backup/voor-merge-specificaties-en-koppelen`. Tests in de scratchpad:
`spec1.js` t/m `spec4.js`, `combo.js`, `zoekadmin.js`, `adminbalk.js`,
`groepkoppel.js`. Tests die vastlopen op op verzoek verwijderde knoppen
(Groepeer, Wie ziet wie, AVG-tab, Uit dienst, Blokkeren, Ziek) staan in
`scratchpad/verouderd/` en draaien niet mee in de regressie.

**Controleronde (hele code nagelopen)** — gevonden en opgelost, alles eerst
aangetoond: terugpijl/kruimels lieten lege nieuwe personen achter (live id
19-21, niet zonder overleg weghalen); `syncToSupabase` schreef niet-doorgevoerde
nieuwe personen weg (nu pas bij doorvoeren); `cap()` maakte "de Vries" tot
"De Vries" (`TUSSENVOEGSELS`); definitief wissen schreef opgeruimde
verwijzingen niet weg (database weigerde het wissen van een vertegenwoordiger,
nu ook `ON DELETE SET NULL`); zonder databasebibliotheek toonde de app zonder
waarschuwing voorbeeldgegevens (nu melding bovenaan); tijdens het laden werden
de voorbeeldgegevens bij de eerste klik over de echte database geschreven —
nu gaat elke schrijfactie langs `opslagGeblokkeerd()` (pas schrijven als
`gegevensGeladen===true`), met een laadmelding. supabase-js staat vast op
2.117.1. Verder: hernoemen schrijft eerst de personen weg voordat de oude
groepsnaam verdwijnt; een verwijderde groep gaat uit zijn koppeling;
wijzigingen die nog op de opslagvertraging (600 ms) wachten worden bij
verbergen/sluiten direct opgeslagen (`bewaarAllesNu`, keepalive via
`sbFetch`). Tests met de nep-database: `nepdb.js`, `rondgang-db.js`,
`clientdata-db.js`, `hernoem-herlaad.js`, `twee-beheerders.js` (poort 8734).

**Meerdere beheerders tegelijk:** opslaan schrijft alleen wat deze sessie
veranderde. Personen: per veld (`update` op id) t.o.v. `dbStandPersonen`;
nieuwe personen in hun geheel. Instellingen: alleen gewijzigde sleutels t.o.v.
`dbStandOrg` (`orgRijen()`). Groepen: alleen eigen mutaties (`groepMutaties`,
`groepErbij`/`groepWeg`), nooit "wat niet in mijn lijst staat". Instellingen
die als object zijn opgeslagen (per groep: `groep_gegevens`, `groep_tweestaps`,
`digibord`, `groep_rollen`, …) worden per onderdeel samengevoegd met de
databasestand (`org-samen.js`); lijsten (instituten, koppelingen) gaan nog in
hun geheel.
Objectvelden (`OBJECTVELDEN`: rechten, rollen, toestemming) worden per sleutel
samengevoegd met de actuele databasestand, zodat een ingetrokken recht niet
door een ander wordt teruggezet. Nieuwe personen: vlak voor het wegschrijven
wordt het hoogste id opgevraagd en botsende nieuwe id's worden omgenummerd
(`maakNieuweIdsVrij`, `hernummerPersoon`), daarna `insert` i.p.v. `upsert`.
Tests: `intrekken.js`, `zelfde-id.js`, `hernummer.js`.

**Chat:** berichten hebben een uniek id (`nieuwBerichtId`), afzender met naam
en `vanId`, en een ISO-tijdstip (`chatTijd`). "Jij" wordt bij het tonen
bepaald (`isMijnBericht`); oude berichten met `van:'Jij'` blijven als eigen
bericht werken. Opslaan voegt samen met de database (`voegGesprekSamen`);
verwijderde berichten staan als grafsteen in `thread.verwijderd`. Bij het
sluiten van de pagina schrijft `schrijfBijSluiten` rechtstreeks met één
keepalive-fetch (supabase-js was daar te traag voor). Let op in tests:
Playwright onderschept verzoeken van een pagina die sluit niet altijd — kijk
naar `page.on('request')`, niet naar de nep-database (`clientdata-db.js`). Nagelopen en in orde:
opslaan/laden van alle velden, alle schermen op 390px, XSS op 27 schermen,
RLS-policies. Open punt: alle policies staan op `true` (geen inlog).

- Rollen: categorie `locatie` (medewerker) en `clienten` = "Cliënt" (naaste)
  in `ROLLEN`/`RECHTEN`/`orgDefault`; oude opgeslagen standaarden worden
  aangevuld via `vulRolCategorieenAan`. Per persoon een rolkeuze als de groep
  optionele rollen heeft (`rolKeuzes`, `rolVan`, kolom `personen.rollen`).
- Voor- en achternaam verplicht (`toonNaamFout`), ook in Mijn profiel.
- Blokkeren/Verwijderen alleen bij bewerken; `verwijderVanuitProfiel`.
- Rechten overnemen bouwt het profiel niet meer opnieuw op
  (`leesProfielConcept`/`zetProfielConceptTerug`); overzicht met Toon meer.
- Zoekkeuze (`zoekKeuzeHtml`, `koppelZoekKeuze`): één veld met een lijst eronder die meeverandert, met detail (e-mail, groep) zodat naamgenoten te onderscheiden zijn; bij meerdere treffers geen automatische keuze. In elke keuzelijst van de Admin Tools (`kiesUitLijstModal`) en bij Rechten overnemen. Op verzoek NIET in de rechtenlijsten van een profiel. `koppelZoekveld` alleen nog voor de rijenlijst in groepsbeheer.
- Titel "Gebruikersbeheer – groep" (`toonGroepInTitel`); na opslaan terug
  naar herkomst (`profielHerkomst`, `naarHerkomst`).
- Logboek: `logActie(tekst,{soort,reden})`, kolommen `logboek.soort/reden`;
  `soortVanActie` leidt het soort af voor oude regels.
- Archief: prullenbak (nog niet doorgevoerd) + archief (soft delete),
  `BEWAARTERMIJN_JAREN=15`, `bewaarTot`, kolom `personen.gearchiveerd_reden`;
  vroegtijdig wissen vereist een reden. Let op: WGBO-dossiers = 20 jaar.

- Groepen koppelen gebeurt bij Groep bewerken (`hernoemGroep`): de bewerkte
  groep staat niet in het keuzemenu "Koppelen aan"; opheffen per groep met
  `ontkoppelGroep`. Hernoemen werkt de koppeling bij.

Supabase-kolommen die hiervoor zijn toegevoegd: `personen.rollen`,
`personen.gearchiveerd_reden`, `logboek.soort`, `logboek.reden`.

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
