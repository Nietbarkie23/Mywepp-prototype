# MyWepp-prototype — werkafspraken en geparkeerd werk

Prototype van de gebruikersadministratie van MyWepp: een beheeromgeving voor
zorggroepen plus een telefoon-app (MyWepp Personal). Statische pagina, vanilla
JS, Supabase als opslag, Vercel als hosting.

## Hoe hier gewerkt wordt

- **Werk op `master`.** Geen aparte takken of pull requests, tenzij iets eerst
  ter goedkeuring moet. Dan een losse tak, en pas mergen als de klant ja zegt.
- **Backuptak vóór een grote wijziging** (meer dan een handvol dingen in één
  commit).
- **Twee paren bestanden, altijd identiek:** `mywepp-prototype/index.html` is wat
  Vercel publiceert, `source/admin-tools-personal-app.html` is de kopie; de
  JavaScript staat sinds 29-09 apart in `mywepp-prototype/app.js`, met kopie
  `source/app.js`. Na elke wijziging kopiëren en met `diff` controleren. Geen
  JavaScript terugzetten in de pagina en geen `onclick=`/`onerror=` in HTML: de
  CSP staat alleen scripts van de eigen site toe (`script-src 'self'`), dus dat
  wordt door de browser geweigerd.
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
./maak-kopieen.sh                                             # na elke wijziging
python3 -m http.server 8731 --directory zonderlib/            # zonder bibliotheek
python3 -m http.server 8734 --directory metlib/               # met bibliotheek
node vercelserver.js 8735                                     # achter vercel.json
NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node <test>.js 8731
./start-regressie.sh                                          # alles, ~45 min
```

De bibliotheek (`supabase.js`) en het lettertype (`fonts/`) staan sinds de
beveiligingsronde naast de pagina. Daarom zijn er drie testkopieën
(`maak-kopieen.sh`): `zonderlib/` (8731) zonder bibliotheek, dus met
voorbeeldgegevens, zoals de meeste tests verwachten; `metlib/` (8734) met de echte
bibliotheek, waarbij de database met `page.route('**/rest/v1/**', …)` wordt
afgevangen (zie `geladen-opslaan.js`, `traagladen.js`, `nepdb.js`); en
`vercelserver.js` (8735), die de rewrites en headers uit `vercel.json` naspeelt
(`csp-zelfgehost.js`). `start-regressie.sh` kiest de poort per test.

Toegankelijkheid meten: `axe-scan.js` (overzicht per regel) en `axe-kleur2.js`
(contrast per kleurpaar) gebruiken axe-core uit `scratchpad/axe/` (via npm).
Stand: 0 problemen (statuskleuren moss/amber/brick zijn daarvoor donkerder
gemaakt, met akkoord van de klant). Animaties worden tijdens de meting uitgezet; anders meet axe een scherm
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
`Test Test Medewerker` (13), `Dean Schouten` (15), `TEST Ttt` (16),
`Dit Is Een Test` (17), en de groep `Test groep`. Die staan in de live database
en mogen alleen met expliciete toestemming weg. (`Tttt TEST`, id 14, is op
23-09 via de app definitief gewist; zie het logboek.)

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
wie en Zoeken zijn verborgen, Groepen beheren is weggehaald (het scherm
`admintab-groepen` bestaat nog en is alleen te bereiken via inloggen als
systeembeheer en na Groep maken; het koppelen van groepen staat nu bij Groep
bewerken).
Standaardrollen staat nu onder Bewerken, Controle onder Overig. AVG
(datalekkenregister, verwerkingsregister, export) staat op verzoek weer terug,
onder Overig naast Controle. De knop Uit
dienst is ook weggehaald (`uitdienst`); `uitDienstFlow` staat nog in de code.

**Ziekmelden staat uit** (`ZIEKMELDEN=false`, `isZiek`, HTML-comment
`ziekmelden`): geen vinkje, geen Ziek-label, geen doorschakeling naar
contactpersoon 2, geen controlesignaal. De opgeslagen `status='ziek'` blijft in
de database staan (live: Marieke de Vries, id 3) — niet zonder
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
19-21, op 28-09 met akkoord gewist; 30 dagen terug te halen uit `private.historie`); `syncToSupabase` schreef niet-doorgevoerde
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
databasestand (`org-samen.js`). Lijsten (instituten, locaties, koppelingen,
verwijderde groepen) ook: alleen wat deze sessie toevoegde of weghaalde wordt op
de databasestand toegepast (`voegLijstSamen`); overlappende koppelingen worden
één groepje (`voegClustersSamen`). Test: `lijsten-samen.js`.
Objectvelden (`OBJECTVELDEN`: rechten, rollen, toestemming) worden per sleutel
samengevoegd met de actuele databasestand, zodat een ingetrokken recht niet
door een ander wordt teruggezet. Nieuwe personen: vlak voor het wegschrijven
wordt het hoogste id opgevraagd en botsende nieuwe id's worden omgenummerd
(`maakNieuweIdsVrij`, `hernummerPersoon`), daarna `insert` i.p.v. `upsert`.
Tests: `intrekken.js`, `zelfde-id.js`, `hernummer.js`.
Verder (29-09, gevonden met `invarianten.js ... twee`):
- **Eén rij**: alle schrijfacties van een sessie lopen op volgorde (`inRij`;
  `syncToSupabase`/`syncOrganisatieData`/`syncGroepenToSupabase` zijn de
  wachtende versies, `schrijfPersonenWeg`/`schrijfOrgWeg`/`schrijfGroepenWeg` de
  interne). Van binnenuit altijd de interne versie aanroepen, anders wacht de
  rij op zichzelf. Bij het sluiten van de pagina wordt niet gewacht.
- `groepen` van een persoon wordt per naam samengevoegd met de databasestand
  (zoals rechten). Wat naar een groep verwijst die in de database niet (meer)
  bestaat, wordt niet weggeschreven; dan een melding met Pagina herladen
  (`groepConflict`).
- Na hernoemen/verwijderen van een groep worden ook mensen die deze sessie niet
  kent en de koppelingen in de database bijgewerkt (`groepHernoemd`,
  `werkGroepnamenBijInDatabase`). Na het wegschrijven van personen worden het
  gekoppelde team (`vulTeamsAanInDatabase`) en rechten zonder gedeelde groep of
  op gewiste mensen (`ruimRechtenOpInDatabase`) in de database rechtgezet. Die
  stappen passen op het scherm alleen hun eigen wijziging toe.
- Vangnet: wie alleen nog naar niet-bestaande groepen verwijst, staat onder
  Zonder groep. Test: `twee-groepen.js`.
- Hernoemen van een groep die een ander intussen al hernoemde of verwijderde is
  een conflict (niets wegschrijven, herladen). De lijst verwijderde groepen
  bevat nooit een groep die in de database nog bestaat. Een lege groepentabel
  wordt alleen bij de allereerste keer met de eigen lijst gevuld
  (`groepenTabelWasLeeg`), anders kwamen samen verwijderde groepen terug.
- Vangnet bij elk laden (`herstelSamenhangNaLaden`): koppelingen alleen met
  bestaande groepen, medewerkers in het hele gekoppelde team, geen bestaande
  groep in de lijst verwijderde groepen; wordt weggeschreven zonder als eigen
  wijziging mee te tellen. Een lijst-sleutel die nog niet in de database staat,
  gaat ook door de samenvoeging en controle.
- `invarianten.js` wacht na elke handeling tot de opslag klaar is en herlaadt
  bij de melding Pagina herladen, zoals een gebruiker; `DEBUG=1` toont per stap
  de groepen in de database.

**Dossier van een cliënt** (client_data: dossier, geheugen, instellingen) wordt
niet meer in zijn geheel overschreven: bij opslaan de databaserij lezen en per
item op id alleen toepassen wat deze sessie toevoegde, wijzigde of verwijderde
t.o.v. de stand bij laden (`voegClientRijSamen`, `voegItemsSamen`,
`DOSSIERLIJSTEN`, basis in `dbStandClient`); rapportages binnen een doel ook per
item. Nieuwe items krijgen een uniek getal (`nieuwNummer`, tijd×1000+toeval),
geen volgnummer per dossier meer. Het samengevoegde dossier wordt op zijn plek
bijgewerkt met dezelfde objecten per id (`werkBijOpZijnPlek`), anders
schreven open formulieren in een los object. Opnieuw tekenen alleen bij
inhoudelijk nieuwe dingen van een ander (`vasteJson`) en nooit terwijl iemand
typt. Stond een dossier er bij laden wel en nu niet (definitief gewist), dan
wordt het niet opnieuw aangemaakt. Test: `dossier-samen.js`.

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

**Pentest en overbelasting.** Aangetoond en opgelost: XSS via de chattijd
(`renderCaChatList`) en via een rolnaam uit `org_default` (`vulRolCategorieenAan`
accepteert alleen rollen uit `ROLLEN`), CSV-injectie in exports (`csvVeld` zet
een apostrof voor `= + - @`), Escape in een zoekkeuze sloot het hele venster,
reactieknoppen crashten zonder `reacties`-object. Tests: `xss-rest.js`,
`xss-rol.js`, `csv-injectie.js`, `modal-toets.js`, `te-veel.js` (poort 8734).
Later (28-09, gevonden door Codex, patroon op acht plekken): waarden uit het
JSON-dossier (`client_data`, chat) zijn niet op type afgedwongen. Reactietellers
gaan door `veiligeTeller`, en id's van doelen, rapportages, agenda, Ik-Boek,
geheugen, chatgesprekken en -berichten door `esc()` in hun data-attribuut.
Tests: `xss-json.cjs`, `knoppen-ids.cjs`.
Nog open en alleen met inlog op te lossen: met de publieke sleutel kan iedereen
alles lezen, personen aanmaken/wissen, rechten geven en logregels vervalsen.
Tegen overspoelen (in de database, migraties `rate_limit_*`):
`beveiliging.check_request` (eigen schema, niet via de API aan te roepen) draait als `pgrst.db_pre_request` vóór elk API-verzoek en
telt schrijfverzoeken per IP in `private.verzoeken`; boven 2000 per twee minuten
volgt HTTP 429 (de app toont dan "Niet opgeslagen"). Tegen een aanval vanaf veel
adressen telt dezelfde functie ook alle adressen samen (rij `*alle*`, grens 5000
per twee minuten): onder zo'n aanval kan ook een echte gebruiker even niet
opslaan, maar de database blijft heel. Per tabel een bovengrens op het aantal
rijen (trigger `tabelgrootte`, `bewaak_tabelgrootte`, geschat via `pg_class`). Een fout in de teller laat
het verzoek door, zodat de app nooit door de teller platgaat. Leesverzoeken zijn
zo niet te begrenzen. Elke tabel heeft een trigger `rijgrootte`
(`bewaak_rijgrootte`) die te grote rijen weigert. Uitzetten:
`alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.
De oude kopie `public.check_request` is weg (migratie
`oude_public_check_request_weg`): die was via `/rest/v1/rpc/` door iedereen
aan te roepen. Definitie bewaard in de scratchpad
(`terugzetten-public-check_request.sql`).
Verder (migratie `beveiliging_rechten_controles_historie`): anon/authenticated
hebben geen TRUNCATE meer en geen wijzig-/wisrecht op het logboek; nieuwe
tabellen staan niet meer automatisch open. Controles op `type` en lengtes van
velden. Wissen van meer dan een handvol rijen in één verzoek wordt geweigerd
(`massaverwijdering`: personen 5, groepen 10, client_data 5, chat 50). Wat
gewist of overschreven wordt, bewaart `bewaar_historie` 30 dagen in
`private.historie`, met IP, om vandalisme terug te kunnen draaien.
Site: geen CDN en geen Google Fonts meer. De bibliotheek en het lettertype
Inter (@fontsource) komen van de eigen server, en de CSP staat alleen nog
`'self'` en de database toe. Scripts: alleen `'self'`, zonder `'unsafe-inline'` (app.js apart);
in de pagina geplakte code (inline `<script>`, `onerror`, `javascript:`) voert
de browser niet uit. Tests: `csp-streng.js` (8735, met controle tegen de vorige
versie), `csp-rondgang.js` (alle schermen, 0 CSP-meldingen). Backup van vóór
deze stap: `backup/voor-strengere-csp`.

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
- Gekoppelde groepen delen hun medewerkers, ook bij weghalen: een medewerker
  uit één groep van het cluster halen haalt hem uit het hele cluster
  (`groepenWeg`, `teamVan`), verplaatsen en Zonder groep zetten hem in het hele
  team van de nieuwe groep (`groepenBij`), herstellen vult het team aan
  (`vulKoppelingAan`). Cliënten en naasten blijven per groep. Test:
  `team-koppeling.js`.
- **`invarianten.js <poort> <seed> <stappen> <aantal>`** (8734): willekeurige
  reeksen beheerhandelingen met na elke stap en na herladen vaste regels
  (niemand verwijst naar een niet-bestaande groep, iedereen is vindbaar, geen
  rechten op verdwenen mensen of zonder gedeelde groep, koppelingen kloppen,
  database = scherm). Vond de twee fouten hierboven; bij een melding eerst
  checken of het de test is (verborgen knoppen met dezelfde data-attributen).
- Groep verwijderen (`verwijderGroep`) blokkeert niet meer bij mensen erin:
  de groep gaat uit koppelingen en bij iedereen eraf, rechten zonder gedeelde
  groep worden opgeruimd. Wie alleen in die groep zat, staat onder Overig ›
  Zonder groep (`zonderGroepFlow`, teller `zondergroep-teller`; de knop staat er
  alleen als iemand geen groep heeft, `zetZonderGroepTeller`): verplaatsen,
  naar het archief, of gearchiveerd terugzetten (daar ook Inzage en, intern,
  Definitief wissen). Ook gearchiveerden gaan bij het verwijderen uit de groep,
  anders waren ze nergens meer te vinden (`archief-groep-weg.js`). Groep herstellen zet mensen,
  rechten en vertegenwoordigers terug uit `groepOntkoppeld` (organisatie_data
  `groep_ontkoppeld`). Tests: `groep-verwijderen.cjs`,
  `groep-verwijderen-db.cjs`, `groep-verwijderen-ui.cjs`.
- Mislukt opslaan is nooit stil: ook de groepenlijst (`registreerOpslag('groepen')`),
  en Opnieuw proberen verstuurt logboekregels en datalekmeldingen opnieuw
  (`nogTeVersturen`, `verstuurOpnieuw`, alleen in het geheugen). Definitief
  wissen wist eerst het dossier en pas daarna de persoon, zodat bij een storing
  de persoon in het archief blijft om opnieuw te wissen. Nog open: echt
  in één keer wissen vraagt een databasefunctie (transactie); opslag bij het
  sluiten van de pagina kan een fout niet meer tonen. Tests:
  `groep-opslagfout.cjs`, `stille-opslag-na.cjs`, `paneel-sluiten.cjs`.
- Cliënt of (non)prof. verwijderen via de Admin Tools komt niet in het archief
  dat medewerkers per groep zien (`renderGearchiveerd` slaat `doorBeheer(p)`
  over). Geen aparte knop: Cliënt herstellen / (Non)prof. herstellen tonen na de
  groepkeuze `toonBeheerArchief(g,soort)` met twee kopjes, Verwijderd via beheer
  en Archief van de groep. Tijdens het klaarzetten `p._doorBeheer`, na doorvoeren
  kolom `personen.archief_soort='beheer'` (migratie `personen_archief_soort`).
  Herstellen haalt de markering weg.
- **Definitief wissen alleen intern** (support of systeembeheer, via die
  herstellijst): `magDefinitiefWissen()` in `wisDefinitief`, en het archief van
  medewerkers heeft geen wisknop (`archiefRijHtml(p,{wissen:true})` alleen in de
  Admin Tools). Test: `verwijderd-beheer.js` (poort 8734).
- MyWepp Personal, Info-scherm: rollen van betrokkenen staan vast (tekst, geen
  keuzelijst; `personRechtenRow(id,true)`). Wijzigen alleen via Gebruikers
  beheren. Test: `rollen-vast.cjs`.

Supabase-kolommen die hiervoor zijn toegevoegd: `personen.rollen`,
`personen.gearchiveerd_reden`, `personen.archief_soort`, `logboek.soort`, `logboek.reden`.

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
