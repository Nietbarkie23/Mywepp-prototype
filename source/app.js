/* De app-code staat in een eigen bestand in plaats van in de pagina. Zo kan de
   CSP (vercel.json) script-src op 'self' zetten zonder 'unsafe-inline': als er
   ooit toch HTML met een <script> of een onclick in de pagina belandt, voert de
   browser dat niet uit. Zelfde bestand ook in source/ (zie CLAUDE.md). */
/* ============== SUPABASE ============== */
var SB_URL='https://yaooauluqhhldfuwnanq.supabase.co';
var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhb29hdWx1cWhobGRmdXduYW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzkzMTIsImV4cCI6MjEwNDk1NTMxMn0.d2zK5rGoJWF8jgn58vDmFsKK_DpFr3YsJ8qGWlahtR8';
/* Bij het sluiten van de pagina breekt de browser lopende verzoeken af. Met
   keepalive maakt hij ze nog af; dat mag alleen voor kleine verzoeken (de
   browser weigert keepalive boven 64 kB), dus alleen tijdens het afsluiten en
   onder die grens. */
var paginaSluit=false;
function sbFetch(url,opties){
 if(paginaSluit&&opties&&opties.body&&String(opties.body).length<60000)opties=Object.assign({},opties,{keepalive:true});
 return fetch(url,opties);
}
var sb=(typeof window.supabase!=='undefined')?window.supabase.createClient(SB_URL,SB_KEY,{global:{fetch:sbFetch}}):null;
/* Bij het sluiten van de pagina haalt supabase-js eerst nog asynchroon de
   sessie op voordat hij het verzoek verstuurt; soms is de pagina dan al weg en
   komt er niets aan (aangetoond: af en toe verloren). Daarom op dat moment
   rechtstreeks één keepalive-verzoek naar de database, zonder tussenstappen. */
function schrijfBijSluiten(tabel,rijen,conflictKolom){
 try{
  var body=JSON.stringify(rijen);
  fetch(SB_URL+'/rest/v1/'+tabel+'?on_conflict='+encodeURIComponent(conflictKolom),{
   method:'POST',keepalive:body.length<60000,
   headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
   body:body});
 }catch(e){/* de pagina gaat dicht; er is niemand meer om iets te melden */}
}

function el(i){return document.getElementById(i);}
/* Alles wat een gebruiker zelf intypt (namen, e-mail, groepsnamen, rapportages,
   berichten) gaat via string-concatenatie het scherm op. Zonder deze escape kan
   een naam als <img src=x onerror=...> echte code uitvoeren bij iedereen die de
   lijst opent. Gebruik esc() rond élke waarde die in een HTML-string belandt. */
function esc(s){
 return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/* Reactietellers staan in het JSON-dossier en zijn dus niet door de database op
   type gecontroleerd. Een tekst als teller werd als HTML uitgevoerd (XSS,
   aangetoond); alleen een positief geheel getal telt. */
function veiligeTeller(v){var n=Number(v);return Number.isInteger(n)&&n>0?Math.min(n,99999):0;}
var verzondenTimer=null;
function show(id){
 clearTimeout(verzondenTimer);
 ['pp-hub','pp-formulier','pp-controleren','pp-versturen','pp-verzonden','pp-digibord','pp-statistieken','pp-maaltijden','pp-profiel-client','pp-profiel-persoon','pp-gearchiveerd'].forEach(function(x){el(x).hidden=(x!==id);});
 /* Deze drie werden alleen gevuld door de link op het hubscherm. Kwam je er
    langs een andere weg — een controlesignaal, de terugknop, een sprong uit
    het zoekscherm — dan stond je voor een leeg scherm. Het vullen hoort bij
    het tonen, niet bij één specifieke knop. */
 if(id==='pp-statistieken'&&typeof renderStatTable==='function')renderStatTable();
 if(id==='pp-maaltijden'&&typeof renderMaaltijdKalender==='function')renderMaaltijdKalender();
 if(id==='pp-digibord'&&typeof renderDigibord==='function')renderDigibord();
 window.scrollTo(0,0);
}
/* maxlength in het formulier houdt alleen normale invoer tegen; geplakte of via
   de console gezette waarden moeten hier stranden, anders groeit een record
   ongelimiteerd en rekt het de hele lijst uit. */
/* De beheerkant kapte namen op 60 tekens af, maar de clientapp en Mijn profiel
   deden dat niet: daar ging 500 tekens zo de database in, en daarmee ook het
   account. Eén set grenzen voor allebei. */
var MAXLEN={naam:60,mail:120,tel:25,groep:60,functie:60,titel:80,tijd:20};
function kap(tekst,max){return String(tekst==null?'':tekst).slice(0,max);}
/* Elk woord een hoofdletter, behalve tussenvoegsels: die blijven precies zoals
   ze zijn getypt. Eerder werd "de Vries" bij elke keer opslaan "De Vries", en
   telde een ongewijzigd profiel daardoor als gewijzigd. Wie bewust "De" typt
   (bijvoorbeeld een Belgische naam), houdt dat ook. */
var TUSSENVOEGSELS=['de','der','den','van','von','het','ten','ter','te','in','op','aan','bij','uit','voor','tot','onder','over',"'t","'s","d'",'du','da','di','del','della','la','le'];
function cap(s){return (s||'').trim().split(/\s+/).map(function(w){
 if(!w||TUSSENVOEGSELS.indexOf(w.toLowerCase())>-1)return w;
 /* Ook na een streepje: Jan-Willem, Smit-de Boer. */
 return w.split('-').map(function(d){
  return !d||TUSSENVOEGSELS.indexOf(d.toLowerCase())>-1?d:d.charAt(0).toUpperCase()+d.slice(1);
 }).join('-');
}).join(' ');}
function genereerEmail(voor,achter,domein){
 function schoon(s){return (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
 var v=schoon(voor),a=schoon(achter),maxLocal=20;
 if(v.length+1+a.length>maxLocal)a=a.slice(0,Math.max(1,maxLocal-1-v.length));
 return v+'.'+a+'@'+(domein||'mywepp.nl');
}
/* Profielfoto's worden als data-URL opgeslagen. Alleen echte afbeeldings-URL's
   toelaten, en ze altijd tussen quotes in CSS zetten: een waarde met een haakje
   of aanhalingsteken zou anders uit de url(...) kunnen breken. */
var FOTO_TYPES=['image/jpeg','image/png','image/webp'];
var FOTO_MAX_BYTES=2*1024*1024;
function veiligeFotoUrl(url){
 return typeof url==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
}
function cssUrl(url){return "url('"+String(url).replace(/['"\\)]/g,'')+"')";}
function zetFotoAchtergrond(elem,url){
 elem.style.backgroundImage=cssUrl(url);
 elem.style.backgroundSize='cover';
 elem.style.backgroundPosition='center';
}
var AVCOLORS=['#4A6FA5','#3D8C7D','#B0783C','#B0555A','#6E6A96','#3E7CA6','#8C6A45','#5A8A6E'];
function avatarHash(naam){var h=0;for(var i=0;i<naam.length;i++)h=naam.charCodeAt(i)+((h<<5)-h);return Math.abs(h);}
function avatarColor(naam){return AVCOLORS[avatarHash(naam)%AVCOLORS.length];}
function avatarGradient(naam){var h=avatarHash(naam);var c1=AVCOLORS[h%AVCOLORS.length],c2=AVCOLORS[(h+3)%AVCOLORS.length];return 'linear-gradient(135deg,'+c1+','+c2+')';}
function initials(v,a){return ((v[0]||'')+(a[0]||'')).toUpperCase();}
/* ---- Toestemming (AVG art. 6 lid 1 sub a en art. 7) ----
   Een foto van iemand tonen mag alleen met toestemming, en je moet kunnen
   aantonen dat die er is. Een vinkje dat nergens op ingrijpt is schijnzekerheid,
   dus zonder toestemming laat de app de foto ook echt niet zien. */
function toestemmingVan(p){return (p&&p.toestemming)||{};}
function magFotoTonen(p){
 if(!p)return false;
 if(p.type!=='client')return true;          /* medewerkers en naasten regelen dit bij hun eigen account */
 return !!toestemmingVan(p).foto;
}
function fotoVan(p){return magFotoTonen(p)?p.foto:null;}
function avatarHtmlSized(naam,px,foto){
 if(veiligeFotoUrl(foto))return '<div class="avatar" style="width:'+px+'px;height:'+px+'px;flex:0 0 '+px+'px;background-image:'+cssUrl(foto)+';background-size:cover;background-position:center"></div>';
 return '<div class="avatar" style="width:'+px+'px;height:'+px+'px;font-size:'+Math.round(px*0.36)+'px;flex:0 0 '+px+'px;background:'+avatarGradient(naam)+'">'+esc(initials.apply(null,naam.split(' ').length>1?[naam.split(' ')[0],naam.split(' ').slice(-1)[0]]:[naam,'']))+'</div>';
}
function avatarHtml(naam,foto){return avatarHtmlSized(naam,36,foto);}
function setGrootAvatar(elId,p){
 var e=el(elId);
 if(veiligeFotoUrl(fotoVan(p))){zetFotoAchtergrond(e,p.foto);}
 else{e.style.backgroundImage='';e.style.background=avatarGradient(naam(p));}
}

/* ============== ADMIN TOOLS: data ============== */
var GROEPEN=['De Boomgaard','De Wilgenhof','Dagbesteding Centrum'];
/* Instituut > Locatie > Groep: lichte, aanvullende hiërarchie boven de bestaande groepenlijst.
   Bewust los van de bestaande huidigeGroep/GROEPEN-filtering gehouden (die blijft ongewijzigd
   op groepsnaam werken) zodat niets van de bestaande functionaliteit hierdoor kan breken. */
var INSTITUTEN=['Zorggroep Noord'];
var LOCATIES=['Hoofdlocatie'];
var locatieInstituut={'Hoofdlocatie':'Zorggroep Noord'};
var groepLocatie={'De Boomgaard':'Hoofdlocatie','De Wilgenhof':'Hoofdlocatie','Dagbesteding Centrum':'Hoofdlocatie'};
/* Rechtenset-namen overgenomen uit het echte MyWepp rechtensets-scherm (Admin Tools > Rechtensets),
   per categorie zodat elke schaal (globaal/groep/cliënten/gebruikers) zijn eigen realistische sets heeft. */
var ROLLEN={
 medewerker:{
  globaal:['Medewerker met statistiekrecht','Medewerker','Vrijwilliger','Bord inlog','Geen'],
  groep:['Groep admin','Medewerker','Nieuws redacteur','Bord inlog','Geen'],
  clienten:['Medewerker met prikbord en dossier','Medewerker met prikbord','Medewerker','Bord inlog','Geen'],
  medewerkers:['Roosteraar met bekijk recht en profiel','Roosteraar met bekijkrecht','Roosteraar','Geen'],
  /* Locatierol: wat iemand mag op locatieniveau, dus over alle groepen van een
     locatie heen (bijvoorbeeld een locatiemanager die meerdere teams aanstuurt). */
  locatie:['Locatiemanager','Locatie admin','Medewerker locatie','Geen']
 },
 naaste:{
  globaal:['Mantelzorger','Geen'],
  groep:['Mantelzorger','Mantelzorger zonder agenda met participatie 1e lijn','Mantelzorger simpel','Geen'],
  clienten:['Mantelzorger +prikbord +dossier','Mantelzorger met prikbord','Mantelzorger alleen agenda en watchphone','Mantelzorger','Geen']
 }
};
var RECHTEN={
 medewerker:[{k:'globaal',l:'Globaal (algemeen)'},{k:'groep',l:'Groep'},{k:'locatie',l:'Locatie'},{k:'clienten',l:'Cliënten (alle cliënten in de groep)'},{k:'medewerkers',l:'Recht op andere medewerkers'}],
 /* Een naaste hoort altijd bij een cliënt; de rol die hij daar standaard
    krijgt is dus net zo goed een groepsinstelling als zijn groepsrol. */
 naaste:[{k:'globaal',l:'Globaal (algemeen)'},{k:'groep',l:'Groep'},{k:'clienten',l:'Cliënt'}]
};
var orgDefault={
 medewerker:{globaal:{rol:'Medewerker',opt:[]},groep:{rol:'Medewerker',opt:['Groep admin']},locatie:{rol:'Medewerker locatie',opt:[]},clienten:{rol:'Medewerker',opt:['Medewerker met prikbord']},medewerkers:{rol:'Geen',opt:[]}},
 naaste:{globaal:{rol:'Mantelzorger',opt:[]},groep:{rol:'Mantelzorger',opt:['Mantelzorger simpel']},clienten:{rol:'Mantelzorger',opt:['Mantelzorger met prikbord']}}
};
/* De ingebouwde standaard, los bewaard: rolcategorieën die later zijn
   bijgekomen (locatie, cliënt bij naasten) ontbreken in standaarden die al in
   de database stonden. Zonder aanvulling liep het rollenscherm vast op een
   lege categorie. */
var STANDAARD_ROLLEN=JSON.parse(JSON.stringify(orgDefault));
function vulRolCategorieenAan(data,type){
 if(!data||typeof data!=='object')data={};
 RECHTEN[type].forEach(function(r){
  var d=data[r.k];
  /* Alleen rollen die de app kent. Een rolnaam komt uit de database en belandde
     ongefilterd in de pagina; een verzonnen "rol" met HTML erin voerde code
     uit (aangetoond). */
  var bekend=ROLLEN[type][r.k];
  if(!d||typeof d.rol!=='string'||bekend.indexOf(d.rol)<0)data[r.k]=JSON.parse(JSON.stringify(STANDAARD_ROLLEN[type][r.k]));
  else d.opt=Array.isArray(d.opt)?d.opt.filter(function(o){return bekend.indexOf(o)>-1;}):[];
 });
 return data;
}
var groupOverride={};
/* ---- Gekoppelde groepen ----
   Twee groepen op dezelfde locatie draaien in de praktijk vaak met één team:
   dezelfde medewerkers, maar hun eigen cliënten. Dat met de hand bijhouden gaat
   mis zodra er iemand bij komt of weggaat — dan werkt iemand wel in de ene groep
   en niet in de andere zonder dat iemand dat merkt. Een koppeling deelt daarom
   automatisch de medewerkers.
   Cliënten en naasten worden nooit gedeeld. Die horen bij één groep, en juist
   die scheiding wil je in de zorg overeind houden: een gekoppeld team betekent
   niet dat iedereen in elkaars dossiers kan. */
var groepKoppelingen=[];
function clusterVan(g){
 var c=groepKoppelingen.filter(function(k){return k.indexOf(g)>-1;})[0];
 return c?c.slice():[g];
}
function isGekoppeld(g){return clusterVan(g).length>1;}
function partnersVan(g){return clusterVan(g).filter(function(x){return x!==g;});}
/* Zet de groepen van één medewerker recht: zit hij in een gekoppelde groep, dan
   hoort hij in alle groepen van dat cluster. Geeft terug of er iets veranderde. */
function vulKoppelingAan(p){
 if(!p||p.type!=='medewerker'||!p.groepen)return false;
 var erbij=[];
 p.groepen.slice().forEach(function(g){
  clusterVan(g).forEach(function(x){
   if(p.groepen.indexOf(x)<0&&GROEPEN.indexOf(x)>-1){p.groepen.push(x);erbij.push(x);}
  });
 });
 if(!erbij.length)return false;
 if(p._state!=='nieuw')p._state='gewijzigd';
 return true;
}
/* Na het leggen of wijzigen van een koppeling iedereen in één keer bijwerken. */
function pasKoppelingenToe(){
 var aantal=0;
 people.forEach(function(p){if(!p.archived&&vulKoppelingAan(p))aantal++;});
 return aantal;
}
var bulkSel={groepen:{}, type:'medewerker', werk:{}};
GROEPEN.forEach(function(g){bulkSel.groepen[g]=false;});
function resetWerk(type){bulkSel.werk=JSON.parse(JSON.stringify(orgDefault[type]));}
resetWerk('medewerker');

var CHEVRON_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
var rolMenuOpen={};
function rolMenuKey(container,k,kind){return (container.id||'c')+'|'+k+'|'+kind;}
function closeOtherRolMenus(keepKey){Object.keys(rolMenuOpen).forEach(function(k){if(k!==keepKey)rolMenuOpen[k]=false;});}
document.addEventListener('click',function(e){
 if(e.target.closest('.roldrop')||e.target.closest('.optdrop'))return;
 var open=document.querySelectorAll('.roldrop-menu:not([hidden]), .optdrop-menu:not([hidden])');
 if(!open.length)return;
 Array.prototype.forEach.call(open,function(m){m.hidden=true;m.parentElement.classList.remove('open');});
 rolMenuOpen={};
});
function rechtenRows(container,type,data,onchange){
 container.innerHTML=RECHTEN[type].map(function(r){
  var cur=data[r.k];
  var roleKey=rolMenuKey(container,r.k,'role'),optKey=rolMenuKey(container,r.k,'opt');
  var roleOpen=!!rolMenuOpen[roleKey],optOpen=!!rolMenuOpen[optKey];
  var optRoles=ROLLEN[type][r.k].filter(function(rol){return rol!==cur.rol&&rol!=='Geen';});
  var gekozenOpt=cur.opt.filter(function(o){return optRoles.indexOf(o)>-1;});
  return '<div class="rechtrow" data-k="'+r.k+'">'+
   '<div class="top"><b>'+r.l+'</b></div>'+
   '<div class="rechtgrid">'+
    '<div class="field"><label>Standaardrol</label>'+
     '<div class="roldrop'+(roleOpen?' open':'')+'" data-role="'+r.k+'">'+
      '<button type="button" class="roldrop-btn">'+esc(cur.rol)+CHEVRON_SVG+'</button>'+
      '<div class="roldrop-menu"'+(roleOpen?'':' hidden')+'>'+ROLLEN[type][r.k].map(function(rol){
       return '<button type="button" class="roldrop-item'+(rol===cur.rol?' on':'')+'" data-rol="'+rol+'">'+rol+'</button>';
      }).join('')+'</div>'+
     '</div>'+
    '</div>'+
    '<div class="field"><label>Optionele rollen</label>'+
     '<div class="optdrop'+(optOpen?' open':'')+'" data-opt="'+r.k+'">'+
      '<button type="button" class="optdrop-btn">'+(gekozenOpt.length?gekozenOpt.join(', '):'Geen gekozen')+CHEVRON_SVG+'</button>'+
      '<div class="optdrop-menu"'+(optOpen?'':' hidden')+'>'+(optRoles.length?optRoles.map(function(rol){
       var on=cur.opt.indexOf(rol)>-1;
       return '<label class="optdrop-item"><input type="checkbox" value="'+rol+'" '+(on?'checked':'')+'>'+rol+'</label>';
      }).join(''):'<p class="mini" style="margin:6px 10px">Geen andere rollen beschikbaar.</p>')+'</div>'+
     '</div>'+
    '</div>'+
   '</div>'+
   (r.k==='groep'?'<p class="mini">Bijvoorbeeld voor groepen zoals die van Angelina: één duidelijke hoofdrol, met de rest als optie erbij.</p>':'')+
  '</div>';
 }).join('');
 Array.prototype.forEach.call(container.querySelectorAll('.roldrop-btn'),function(btn){
  btn.addEventListener('click',function(e){
   e.stopPropagation();
   var k=btn.closest('[data-role]').getAttribute('data-role'),key=rolMenuKey(container,k,'role'),willOpen=!rolMenuOpen[key];
   closeOtherRolMenus(willOpen?key:null);rolMenuOpen[key]=willOpen;
   rechtenRows(container,type,data,onchange);
  });
 });
 Array.prototype.forEach.call(container.querySelectorAll('.roldrop-item'),function(item){
  item.addEventListener('click',function(){
   var k=item.closest('[data-role]').getAttribute('data-role'),rol=item.getAttribute('data-rol');
   data[k].rol=rol;data[k].opt=data[k].opt.filter(function(o){return o!==rol;});
   rolMenuOpen[rolMenuKey(container,k,'role')]=false;
   rechtenRows(container,type,data,onchange);onchange&&onchange();
  });
 });
 Array.prototype.forEach.call(container.querySelectorAll('.optdrop-btn'),function(btn){
  btn.addEventListener('click',function(e){
   e.stopPropagation();
   var k=btn.closest('[data-opt]').getAttribute('data-opt'),key=rolMenuKey(container,k,'opt'),willOpen=!rolMenuOpen[key];
   closeOtherRolMenus(willOpen?key:null);rolMenuOpen[key]=willOpen;
   rechtenRows(container,type,data,onchange);
  });
 });
 Array.prototype.forEach.call(container.querySelectorAll('.optdrop-item input'),function(cb){
  cb.addEventListener('change',function(){
   var k=cb.closest('[data-opt]').getAttribute('data-opt');
   if(cb.checked){if(data[k].opt.indexOf(cb.value)<0)data[k].opt.push(cb.value);}else{data[k].opt=data[k].opt.filter(function(o){return o!==cb.value;});}
   rechtenRows(container,type,data,onchange);onchange&&onchange();
  });
 });
}
function initBulkTab(){
 rechtenRows(el('bulk-rechten'),bulkSel.type,bulkSel.werk);
 Array.prototype.forEach.call(el('bulk-typetabs').querySelectorAll('.typetab'),function(b){
  b.addEventListener('click',function(){
   Array.prototype.forEach.call(el('bulk-typetabs').querySelectorAll('.typetab'),function(x){x.classList.remove('on');});
   b.classList.add('on');bulkSel.type=b.getAttribute('data-type');resetWerk(bulkSel.type);
   rechtenRows(el('bulk-rechten'),bulkSel.type,bulkSel.werk);el('bulk-bevestiging').innerHTML='';
  });
 });
 /* Dit scherm ging over "een of meerdere groepen", terwijl je bij het bewerken
    van een groep toch al kiest wat daar geldt. Twee plekken voor hetzelfde
    leverden vooral de vraag op welke van de twee won. Hier staat nu de
    organisatiestandaard; een groep die daarvan afwijkt regel je bij die groep. */
 el('bulk-toepassen').addEventListener('click',function(){
  orgDefault[bulkSel.type]=JSON.parse(JSON.stringify(bulkSel.werk));
  var afwijkend=GROEPEN.filter(function(g){return groupOverride[g]&&groupOverride[g][bulkSel.type];});
  logActie('Organisatiestandaard voor '+bulkSel.type+'s opgeslagen');
  syncOrganisatieData();
  el('bulk-bevestiging').innerHTML='<div class="bevestiging reveal">Opgeslagen als organisatiestandaard voor <b>'+esc(bulkSel.type==='medewerker'?'medewerkers':'naasten')+'</b>.'+
   (afwijkend.length?' <span class="mini">'+esc(afwijkend.join(', '))+' '+(afwijkend.length===1?'wijkt':'wijken')+' hiervan af en '+(afwijkend.length===1?'houdt':'houden')+' de eigen instelling.</span>':'')+'</div>';
  renderAll();
 });
}
initBulkTab();

function effectiveFor(groep,type){
 var ov=groupOverride[groep]&&groupOverride[groep][type];
 var data=JSON.parse(JSON.stringify(ov||orgDefault[type]));
 return {data: vulRolCategorieenAan(data,type), overridden: !!ov};
}
/* Welke rollen er voor één persoon te kiezen zijn: de standaardrol van de groep
   plus de optionele rollen. Zonder optionele rollen is er één keuze en toont
   het profiel een vast veld in plaats van een keuzemenu. */
function rolKeuzes(groep,type,k){
 var d=effectiveFor(groep,type).data[k];
 if(!d)return [];
 return [d.rol].concat(d.opt.filter(function(o){return o!==d.rol&&o!=='Geen'&&ROLLEN[type][k].indexOf(o)>-1;}));
}
function basisGroepVan(p){
 return (p.groepen&&p.groepen.indexOf(huidigeGroep)>-1)?huidigeGroep:((p.groepen||[])[0]||huidigeGroep);
}
/* Een eerder gekozen rol die de groep niet meer aanbiedt valt terug op de
   standaard; anders houdt iemand een rol die niemand meer kan toekennen. */
function rolVan(p,k){
 var keuzes=rolKeuzes(basisGroepVan(p),p.type,k);
 var gekozen=(p.rollen||{})[k];
 return keuzes.indexOf(gekozen)>-1?gekozen:(keuzes[0]||'Geen');
}

function kiesAdmintab(naamVal){
 /* De tabbladenrij is opgegaan in de knoppenbalk: alles wat je kunt openen
    staat nu op één plek, en wat je aanklikt vult het scherm eronder. */
 Array.prototype.forEach.call(document.querySelectorAll('[data-admintab]'),function(x){
  x.classList.remove('on');x.removeAttribute('aria-current');
 });
 var btn=document.querySelector('[data-admintab="'+naamVal+'"]');
 if(btn){btn.classList.add('on');btn.setAttribute('aria-current','true');}
 Array.prototype.forEach.call(document.querySelectorAll('[id^="admintab-"]'),function(sec){sec.hidden=(sec.id!=='admintab-'+naamVal);});
 /* De kop "Standaardrollen voor groepen" hoort alleen bij dat scherm; hij
    stond boven Controle, AVG en de rest ook. */
 if(el('admin-intro'))el('admin-intro').hidden=(naamVal!=='bulk');
 if(naamVal==='groepen')renderSysteembeheer();
 if(naamVal==='controle')renderControle();
 if(naamVal==='matrix')renderMatrix();
 if(naamVal==='zoeken')renderZoeken();
 if(naamVal==='datalek')renderDatalekken();
 if(naamVal==='datalek')renderVerwerkingsregister();
}
Array.prototype.forEach.call(document.querySelectorAll('[data-admintab]'),function(b){
 b.addEventListener('click',function(){
  if(typeof wisActieveAdmKnop==='function')wisActieveAdmKnop();
  if(admInline){el('modal-card').innerHTML='';admPaneelUit();}
  kiesAdmintab(b.getAttribute('data-admintab'));
 });
});
/* "Groep bewerken" stond twee keer in de balk: als handeling (naam en locatie)
   en als overzicht (standaardrollen van één groep afwijken). Dat tweede hoort
   bij de standaardrollen en is daar nu vandaan te bereiken. */
/* Geen eigen Sluiten-knop in de kop van het paneel: elke handeling heeft
   onderaan al Annuleren of Sluiten, dus die knop deed hetzelfde twee keer. */

/* ============== VIEW SWITCH ============== */
var ALLVIEWS=['view-admin','view-personal','view-clientapp'];
function showView(v){
 if(v!=='admin'&&admInline)admInline=false;
 Array.prototype.forEach.call(document.querySelectorAll('.maintabs button'),function(x){x.classList.remove('on');});
 var btn=document.querySelector('.maintabs button[data-view="'+v+'"]');if(btn)btn.classList.add('on');
 ALLVIEWS.forEach(function(id){el(id).hidden=(id!=='view-'+v);});
 if(v==='clientapp')renderClientApp();
}
Array.prototype.forEach.call(document.querySelectorAll('.maintabs button'),function(b){
 b.addEventListener('click',function(){showView(b.getAttribute('data-view'));});
});
function updateAdminTabZichtbaarheid(){
 var support=el('rol-select').value==='support';
 el('tab-admin').hidden=!(support||isSysteembeheerder);
}
el('rol-select').addEventListener('change',function(){
 var support=el('rol-select').value==='support';
 zetIdentiteit(support?'support':'');
 updateAdminTabZichtbaarheid();
 renderAccountSelect();
 toonAdminWie();
 showView(support?'admin':'personal');
});

/* ============== GEBRUIKERSBEHEER: data ============== */
var PENCIL_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
var TRASH_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
var STATE_LABEL={nieuw:'nieuw',gewijzigd:'gewijzigd',verwijderd:'wordt verwijderd'};
var STATE_COLOR={nieuw:'var(--moss)',gewijzigd:'var(--amber)',verwijderd:'var(--brick)'};

var people=[
 {id:1,type:'client',voor:'Elif',achter:'Yildiz',mail:'',groepen:['De Boomgaard'],wettelijkeVertegenwoordiger:null},
 {id:2,type:'client',voor:'Bram',achter:'Smit',mail:'',groepen:['De Boomgaard'],wettelijkeVertegenwoordiger:null},
 {id:3,type:'medewerker',voor:'Marieke',achter:'de Vries',mail:'m.devries@zorggroepnoord.nl',tel:'06 12 34 56 78',groepen:['De Boomgaard'],rol:'Medewerker',contactpersoon:true,contactVolgorde:1,status:'actief',clientRechten:{1:'Medewerker met prikbord',2:'Medewerker met prikbord'}},
 {id:4,type:'medewerker',voor:'Sofie',achter:'Mulder',mail:'s.mulder@zorggroepnoord.nl',tel:'06 23 45 67 89',groepen:['De Boomgaard','De Wilgenhof'],rol:'Medewerker',contactpersoon:false,status:'actief',clientRechten:{2:'Medewerker'}},
 {id:5,type:'naaste',voor:'Ingrid',achter:'Alkema',mail:'ingrid@voorbeeld.nl',tel:'06 34 56 78 90',groepen:['De Boomgaard'],rol:'Mantelzorger',clientRechten:{1:'Mantelzorger met prikbord'}}
];
function rolOpClient(persoon,clientId){return (persoon.clientRechten||{})[clientId]||null;}
/* ---- Tijdelijke toegang ----
   Invallers, stagiairs en uitzendkrachten houden in de praktijk toegang tot
   iemand er handmatig aan denkt. Met een einddatum vervalt die vanzelf. De
   datum is de laatste dag dat iemand nog binnenkomt; leeg is onbeperkt. */
function vandaagISO(){
 var d=new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function geldigeDatum(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(new Date(v).getTime());}
function toegangVerlopen(p){
 return !!(p&&geldigeDatum(p.toegangTot)&&p.toegangTot<vandaagISO());
}
/* Aantal dagen tot en met de einddatum; negatief als die al voorbij is. */
function dagenTotVerloop(p){
 if(!p||!geldigeDatum(p.toegangTot))return null;
 var eind=new Date(p.toegangTot+'T00:00:00'),nu=new Date(vandaagISO()+'T00:00:00');
 return Math.round((eind-nu)/86400000);
}
function datumNL(iso){
 if(!geldigeDatum(iso))return '';
 var d=iso.split('-');
 return d[2]+'-'+d[1]+'-'+d[0];
}
/* Iemand met verlopen toegang telt nergens meer als toegang: niet in de
   controlesignalen, niet in "wie ziet wie" en niet als inlogbaar account. */
function heeftToegang(p){
 return !!p&&!p.archived&&!p.geblokkeerd&&!toegangVerlopen(p);
}
/* Blokkeren is iets anders dan verwijderen of archiveren: bij een incident moet
   toegang per direct weg, terwijl de gegevens moeten blijven staan om te kunnen
   uitzoeken wat er is gebeurd (AVG art. 32, en art. 33 als er iets is gelekt). */
function blokkadeChip(p){
 return p&&p.geblokkeerd
  ? ' <span class="statuschip" style="background:var(--brick-bg);color:var(--brick)">Geblokkeerd</span>'
  : '';
}
/* Een account dat lang niet is gebruikt hoort niet open te blijven staan. */
var INACTIEF_MAANDEN=6;
function maandenInactief(p){
 if(!p||p.type==='client')return null;
 return maandenSinds(p.laatsteLogin);
}
function langInactief(p){
 var m=maandenInactief(p);
 return m!==null&&m>=INACTIEF_MAANDEN&&heeftToegang(p);
}
/* --- Mijn profiel (eigen account medewerker) --- */
var MIJN_PROFIEL={voor:'Marieke',achter:'de Vries',mobiel:'06 12 34 56 78',functie:'Groep admin',geboortedatum:'',mail:'m.devries@zorggroepnoord.nl',opmerkingen:'',tweestaps:false,tweestapsDatum:'',foto:null};
var huidigeGebruikerId=3;
/* --- Contactpersonen: max 2 per groep, ziekte-failover, rechtenmodel --- */
function contactpersonenVanGroep(){
 return personenVanType('medewerker').filter(function(m){return m.contactVolgorde;}).sort(function(a,b){return a.contactVolgorde-b.contactVolgorde;});
}
/* Ziekmelden (status='ziek') is nog een twijfelgeval bij de klant — mogelijk
   verandert dit later nog (bv. een aparte "vervang mij tijdelijk"-actie i.p.v.
   automatische failover), dus deze logica bewust laten staan i.p.v. verwijderen.
   Op verzoek staat de functie uit. Uit betekent ook dat een ziek-status die al
   in de database staat nergens meer meetelt: zonder het vinkje kan niemand
   hem nog terugzetten, en dan zouden de meldingen van die contactpersoon
   voorgoed naar de ander gaan. De opgeslagen status blijft staan, zodat
   aanzetten niets kwijt is. */
var ZIEKMELDEN=false;
function isZiek(m){return ZIEKMELDEN&&!!m&&m.status==='ziek';}
function effectieveContactpersoon(){
 var lijst=contactpersonenVanGroep();
 var eerste=lijst.filter(function(m){return m.contactVolgorde===1;})[0]||null;
 var tweede=lijst.filter(function(m){return m.contactVolgorde===2;})[0]||null;
 if(isZiek(eerste)&&tweede)return tweede;
 return eerste||tweede||null;
}
/* Systeembeheer en Support horen bij geen enkele groep: de een beheert de hele
   organisatie, de ander kijkt mee namens de leverancier. Voor alles wat van
   groepslidmaatschap afhangt gelden ze daarom als "geen van de medewerkers".
   Zonder dat onderscheid erfde Support de rechten van de laatst gekozen
   medewerker — inclusief diens rol als aanspreekpunt. */
function staatBovenDeGroep(){return isSysteembeheerder||isSupport;}
function huidigeGebruiker(){return staatBovenDeGroep()?null:findPerson(huidigeGebruikerId);}
function magContactWijzigen(){
 if(staatBovenDeGroep())return true;
 var eff=effectieveContactpersoon(),ik=huidigeGebruiker();
 return !!(eff&&ik&&eff.id===ik.id);
}
function pasContactpersoonToe(p,checked){
 if(checked){
  var anderen=contactpersonenVanGroep().filter(function(x){return x.id!==p.id;});
  if(anderen.length>=2){alert('Er zijn al twee contactpersonen, je kunt niet meer toevoegen.');return false;}
  p.contactpersoon=true;
  p.contactVolgorde=anderen.some(function(x){return x.contactVolgorde===1;})?2:1;
 }else{
  var was=p.contactVolgorde;
  p.contactpersoon=false;delete p.contactVolgorde;delete p.status;
  if(was===1){
   var tweede=contactpersonenVanGroep().filter(function(x){return x.contactVolgorde===2;})[0];
   if(tweede)tweede.contactVolgorde=1;
  }
 }
 if(p._state!=='nieuw')p._state='gewijzigd';
 logActie(checked?(naam(p)+' aangewezen als contactpersoon '+p.contactVolgorde):(naam(p)+' is geen contactpersoon meer'));
 return true;
}
var nextId=6;
var huidigeGroep=GROEPEN[0];
el('pp-groep-naam').textContent=huidigeGroep;
el('hub-groepnaam').textContent=huidigeGroep;
function hubBevestig(tekst){
 el('hub-bevestiging').textContent=tekst;
 setTimeout(function(){var b=el('hub-bevestiging');if(b)b.textContent='';},2000);
}
el('hub-tweestaps').addEventListener('change',function(){
 groepTweestaps[huidigeGroep]=this.checked;
 logActie(this.checked
  ?('Tweestapsverificatie verplicht gesteld voor groep "'+huidigeGroep+'"')
  :('Tweestapsverificatie niet langer verplicht voor groep "'+huidigeGroep+'"'));
 syncOrganisatieData();
 hubBevestig('Wijziging opgeslagen.');
 if(!el('admintab-controle').hidden)renderControle();
});
el('hub-opmerking').addEventListener('blur',function(){if(el('hub-opmerking').value.trim())hubBevestig('Opmerking opgeslagen.');});

function personRowToDb(p){
 return {id:p.id,type:p.type,voor:p.voor,achter:p.achter,mail:p.mail||null,tel:p.tel||null,rol:p.rol||null,
  contactpersoon:!!p.contactpersoon,contact_volgorde:p.contactVolgorde||null,status:p.status||null,
  wettelijke_vertegenwoordiger:p.wettelijkeVertegenwoordiger||null,foto:p.foto||null,
  toegang_tot:geldigeDatum(p.toegangTot)?p.toegangTot:null,
  gearchiveerd_op:geldigeDatum(p.gearchiveerdOp)?p.gearchiveerdOp:null,
  gearchiveerd_reden:p.gearchiveerdReden||null,archief_soort:p.archiefSoort||null,
  geblokkeerd:!!p.geblokkeerd,geblokkeerd_reden:p.geblokkeerdReden||null,
  toestemming:p.toestemming||{},
  tweestaps:!!p.tweestaps,tweestaps_datum:geldigeDatum(p.tweestapsDatum)?p.tweestapsDatum:null,
  laatste_login:geldigeDatum(p.laatsteLogin)?p.laatsteLogin:null,
  groepen:p.groepen,client_rechten:p.clientRechten||{},
  medewerker_rechten:p.medewerkerRechten||{},naaste_rechten:p.naasteRechten||{},rollen:p.rollen||{},archived:!!p.archived};
}
function dbRowToPerson(r){
 var p={id:r.id,type:r.type,voor:r.voor,achter:r.achter,mail:r.mail||'',groepen:r.groepen||[]};
 if(r.tel)p.tel=r.tel;
 if(r.rol)p.rol=r.rol;
 if(r.contactpersoon)p.contactpersoon=true;
 if(r.contact_volgorde)p.contactVolgorde=r.contact_volgorde;
 if(r.status)p.status=r.status;
 if(r.wettelijke_vertegenwoordiger)p.wettelijkeVertegenwoordiger=r.wettelijke_vertegenwoordiger;
 if(r.foto)p.foto=r.foto;
 if(r.toegang_tot)p.toegangTot=String(r.toegang_tot).slice(0,10);
 if(r.gearchiveerd_op)p.gearchiveerdOp=String(r.gearchiveerd_op).slice(0,10);
 if(r.gearchiveerd_reden)p.gearchiveerdReden=r.gearchiveerd_reden;
 if(r.archief_soort==='beheer')p.archiefSoort='beheer';
 if(r.toestemming&&typeof r.toestemming==='object')p.toestemming=r.toestemming;
 if(r.tweestaps)p.tweestaps=true;
 if(r.tweestaps_datum)p.tweestapsDatum=String(r.tweestaps_datum).slice(0,10);
 if(r.geblokkeerd)p.geblokkeerd=true;
 if(r.geblokkeerd_reden)p.geblokkeerdReden=r.geblokkeerd_reden;
 if(r.laatste_login)p.laatsteLogin=String(r.laatste_login).slice(0,10);
 if(r.client_rechten&&Object.keys(r.client_rechten).length)p.clientRechten=r.client_rechten;
 if(r.medewerker_rechten&&Object.keys(r.medewerker_rechten).length)p.medewerkerRechten=r.medewerker_rechten;
 if(r.naaste_rechten&&Object.keys(r.naaste_rechten).length)p.naasteRechten=r.naaste_rechten;
 if(r.rollen&&typeof r.rollen==='object'&&Object.keys(r.rollen).length)p.rollen=r.rollen;
 if(r.archived)p.archived=true;
 return p;
}
/* Vangnet bij het laden. Twee beheerders die precies tegelijk werken, kunnen
   zonder databasetransacties de samenhang toch nog breken (een koppeling met
   een groep die een ander net verwijderde, een medewerker die het gedeelde team
   mist). Wie daarna de pagina opent, zet dat hier recht en schrijft het weg,
   zonder dat het als eigen wijziging meetelt (aangetoond met invarianten.js). */
function herstelSamenhangNaLaden(){
 var k2=voegClustersSamen(groepKoppelingen.map(function(k){return Array.isArray(k)?k.filter(function(g){return GROEPEN.indexOf(g)>-1;}):[];}));
 var koppAnders=JSON.stringify(k2)!==JSON.stringify(groepKoppelingen);
 if(koppAnders)groepKoppelingen=k2;
 var weg=gearchiveerdeGroepen.filter(function(g){return GROEPEN.indexOf(g)<0;});
 var wegAnders=weg.length!==gearchiveerdeGroepen.length;
 if(wegAnders)gearchiveerdeGroepen=weg;
 var mensen=0;
 people.forEach(function(p){
  if(p.archived)return;
  var st=p._state;
  if(vulKoppelingAan(p)){mensen++;if(st===undefined)delete p._state;else p._state=st;}
 });
 if(koppAnders||wegAnders)syncOrganisatieData();
 if(mensen)syncToSupabase();
}
/* Supabase geeft per verzoek hooguit 1000 rijen. Met meer personen (of
   dossiers, gesprekken) laadde de app er stilletjes maar 1000, en zagen de
   opruimstappen mensen voorbij de 1000 als "verdwenen" (aangetoond met
   veel-personen.js). Daarom een hele tabel altijd in delen ophalen, op een
   vaste volgorde. maak() geeft steeds een nieuwe vraag, al met .order(). */
var DEELGROOTTE=1000;
async function alleRijen(maak){
 var uit=[],van=0;
 while(true){
  var r=await maak().range(van,van+DEELGROOTTE-1);
  if(r.error)return r;
  var d=r.data||[];uit=uit.concat(d);
  if(d.length<DEELGROOTTE)break;
  van+=DEELGROOTTE;
 }
 return {data:uit,error:null};
}
/* Een vraag op een lijst id's in stukken, zodat de URL niet te lang wordt en
   geen stuk boven de 1000 rijen komt (bijvoorbeeld bij een bulkwijziging). */
async function inStukken(ids,maak){
 var uit=[];
 for(var i=0;i<ids.length;i+=200){
  var r=await maak(ids.slice(i,i+200));
  if(r.error)return r;
  uit=uit.concat(r.data||[]);
 }
 return {data:uit,error:null};
}
async function loadFromSupabase(){
 if(!sb){gegevensGeladen=null;toonLaadStatus();return;}
 gegevensGeladen=null;
 /* Pas na een korte pauze tonen: bij een snelle verbinding zou de melding
    anders alleen even flitsen. */
 setTimeout(function(){if(gegevensGeladen===null)toonLaadStatus();},800);
 try{
  var g=await alleRijen(function(){return sb.from('groepen').select('naam').order('id');});
  var p=await alleRijen(function(){return sb.from('personen').select('*').order('id');});
  var o=await alleRijen(function(){return sb.from('organisatie_data').select('sleutel,waarde').order('sleutel');});
  /* Een lege tabel is iets anders dan een mislukte vraag: bij leeg mag de app
     gewoon beginnen, bij een fout juist niet. */
  if(g.error||p.error||!p.data){gegevensGeladen=false;toonLaadStatus();return;}
  groepenTabelWasLeeg=!(g.data&&g.data.length);
  if(!p.data.length){gegevensGeladen=true;toonLaadStatus();return;}
  if(g.data&&g.data.length){GROEPEN.splice.apply(GROEPEN,[0,GROEPEN.length].concat(g.data.map(function(x){return x.naam;})));}
  if(o&&!o.error&&o.data){
   var opgeslagen={};
   o.data.forEach(function(r){opgeslagen[r.sleutel]=r.waarde;});
   if(Array.isArray(opgeslagen.instituten)&&opgeslagen.instituten.length)INSTITUTEN.splice.apply(INSTITUTEN,[0,INSTITUTEN.length].concat(opgeslagen.instituten));
   if(Array.isArray(opgeslagen.locaties)&&opgeslagen.locaties.length)LOCATIES.splice.apply(LOCATIES,[0,LOCATIES.length].concat(opgeslagen.locaties));
   if(opgeslagen.locatie_instituut)locatieInstituut=opgeslagen.locatie_instituut;
   if(opgeslagen.groep_locatie)groepLocatie=opgeslagen.groep_locatie;
   if(Array.isArray(opgeslagen.gearchiveerde_groepen))gearchiveerdeGroepen=opgeslagen.gearchiveerde_groepen;
   if(opgeslagen.groep_ontkoppeld&&typeof opgeslagen.groep_ontkoppeld==='object'&&!Array.isArray(opgeslagen.groep_ontkoppeld))groepOntkoppeld=opgeslagen.groep_ontkoppeld;
   if(opgeslagen.systeembeheer&&typeof opgeslagen.systeembeheer.tel==='string')SYSTEEMBEHEER.tel=opgeslagen.systeembeheer.tel;
   if(opgeslagen.groep_tweestaps&&typeof opgeslagen.groep_tweestaps==='object')groepTweestaps=opgeslagen.groep_tweestaps;
   if(opgeslagen.beoordeelde_signalen&&typeof opgeslagen.beoordeelde_signalen==='object')beoordeeldeSignalen=opgeslagen.beoordeelde_signalen;
   if(opgeslagen.support&&typeof opgeslagen.support.naam==='string'&&opgeslagen.support.naam)SUPPORT.naam=opgeslagen.support.naam;
   if(opgeslagen.support&&typeof opgeslagen.support.tel==='string'&&opgeslagen.support.tel)SUPPORT.tel=opgeslagen.support.tel;
   if(opgeslagen.digibord&&typeof opgeslagen.digibord==='object')digibordPerGroep=opgeslagen.digibord;
   if(opgeslagen.maaltijden&&typeof opgeslagen.maaltijden==='object')MAALTIJDRESERVERINGEN=opgeslagen.maaltijden;
   if(Array.isArray(opgeslagen.groep_koppelingen))groepKoppelingen=opgeslagen.groep_koppelingen.filter(Array.isArray);
   if(opgeslagen.groep_gegevens&&typeof opgeslagen.groep_gegevens==='object')groepGegevens=opgeslagen.groep_gegevens;
   if(opgeslagen.org_default&&opgeslagen.org_default.medewerker&&opgeslagen.org_default.naaste){
    orgDefault.medewerker=vulRolCategorieenAan(opgeslagen.org_default.medewerker,'medewerker');
    orgDefault.naaste=vulRolCategorieenAan(opgeslagen.org_default.naaste,'naaste');
   }
   if(opgeslagen.groep_rollen&&typeof opgeslagen.groep_rollen==='object'){
    groupOverride=opgeslagen.groep_rollen;
    Object.keys(groupOverride).forEach(function(gr){
     ['medewerker','naaste'].forEach(function(t){if(groupOverride[gr]&&groupOverride[gr][t])vulRolCategorieenAan(groupOverride[gr][t],t);});
    });
   }
   if(opgeslagen.toegangscontrole&&typeof opgeslagen.toegangscontrole==='object')TOEGANGSCONTROLE=opgeslagen.toegangscontrole;
  }
  var nieuwePeople=p.data.map(dbRowToPerson);
  people.splice.apply(people,[0,people.length].concat(nieuwePeople));
  onthoudDbStandPersonen(people);
  dbStandOrg={};
  if(o&&!o.error&&o.data)o.data.forEach(function(r){dbStandOrg[r.sleutel]=JSON.stringify(r.waarde);});
  nextId=Math.max.apply(null,people.map(function(x){return x.id;}).concat([0]))+1;
  if(GROEPEN.indexOf(huidigeGroep)<0)huidigeGroep=GROEPEN[0];
  /* Groepen die uit de database komen kenden nog geen locatie of bulk-selectie. */
  GROEPEN.forEach(function(gr){
   if(!groepLocatie[gr])groepLocatie[gr]=LOCATIES[0]||null;
   if(bulkSel.groepen[gr]===undefined)bulkSel.groepen[gr]=false;
  });
  verversGroepReferenties();
  /* Instellingen die nog niet in de database stonden gelden als ongewijzigd
     tot iemand ze echt aanpast; anders schreef de eerste opslag van elke
     sessie ze allemaal weg, over die van een andere beheerder heen. */
  orgRijen().forEach(function(r){if(dbStandOrg[r.sleutel]===undefined)dbStandOrg[r.sleutel]=JSON.stringify(r.waarde);});
  synchroniseerGlobaleRollen();
  await laadLogboek();
  await laadClientData();
  gegevensGeladen=true;
  toonLaadStatus();
  herstelSamenhangNaLaden();
  /* De geladen stand is de nulstand waar wijzigingen tegen worden afgezet. */
  zetBasisVoorIedereen();
  if(typeof renderAll==='function')renderAll();
  if(!el('admintab-groepen').hidden)renderSysteembeheer();
 }catch(e){
  /* Supabase niet bereikbaar. De voorbeeldgegevens blijven staan om iets te
     kunnen laten zien, maar opslaan wordt geblokkeerd. */
  gegevensGeladen=false;
  toonLaadStatus();
 }
}
/* ---- Zichtbaar maken of het opslaan lukt ----
   De meeste opslagaanroepen keken niet naar het resultaat. Ging het mis, dan
   bleef het scherm de nieuwe situatie tonen terwijl de database de oude hield;
   dat merk je pas als iemand toegang blijkt te hebben die je had ingetrokken.
   Zonder database (de demo-stand) is er niets om over te melden. */
var opslagMislukt={};
/* Groepsnamen die een andere beheerder intussen verwijderde of hernoemde. Opnieuw
   proberen helpt dan niet; herladen wel. */
var groepConflict=null;
/* Logboekregels en datalekmeldingen die niet in de database kwamen. Opnieuw
   proberen had er niets om opnieuw te versturen: de balk bleef staan en na
   herladen was de regel weg (aangetoond door Codex, stille-opslag-audit.cjs).
   Alleen in het geheugen, nooit in localStorage: het zijn gevoelige gegevens. */
var nogTeVersturen={logboek:[],datalek:[]};
/* ---- Niet geladen betekent: niet opslaan ----
   De voorbeeldgegevens hebben dezelfde id's als de eerste rijen in de database.
   Lukte het laden niet, dan stond de app vol met die voorbeelden zonder dat
   iets dat verried; wie dan op "doorvoeren" drukte schreef de voorbeelden over
   de echte rijen heen. Daarom wordt opslaan geweigerd zolang er niet is
   geladen — een waarschuwing alleen is te weinig, die klik je weg. */
var gegevensGeladen=null;   /* null = nog bezig, true = geladen, false = mislukt */
function laadMislukt(){return !!sb&&gegevensGeladen===false;}
/* Schrijven mag pas als de echte gegevens binnen zijn. Tijdens het laden staan
   de voorbeeldgegevens nog in het geheugen; één klik (bijvoorbeeld
   tweestapsverificatie omzetten) schreef die dan over de echte administratie
   heen: instellingen, personen met dezelfde id's, en het verwijderde zelfs
   groepen die niet in de voorbeeldlijst stonden. Alle schrijfacties naar de
   database gaan daarom langs deze ene controle. */
function opslagGeblokkeerd(){return !!sb&&gegevensGeladen!==true;}
function toonLaadStatus(){
 var balk=el('laad-balk');if(!balk)return;
 /* Laadt de databasebibliotheek zelf niet (storing bij het CDN, geen
    internet), dan is er geen verbinding en dus ook geen foutmelding van de
    database. De app toonde dan zonder enige waarschuwing de voorbeeldgegevens
    alsof het de echte administratie was, en bewaarde niets. */
 if(!sb){
  balk.hidden=false;
  balk.classList.add('bovenaan');
  var main=document.querySelector('main');
  if(main&&main.firstElementChild!==balk)main.insertBefore(balk,main.firstChild);
  balk.innerHTML='<span class="tekst"><b>Geen verbinding met de database.</b> Je ziet nu voorbeeldgegevens, niet de echte administratie. Wat je wijzigt wordt niet bewaard.</span>'+
   '<button type="button" class="primary" id="laad-opnieuw">Pagina opnieuw laden</button>';
  el('laad-opnieuw').addEventListener('click',function(){location.reload();});
  return;
 }
 /* Tijdens het laden: rustige melding, zodat duidelijk is waarom opslaan nog
    even niet kan. */
 if(gegevensGeladen===null){
  balk.hidden=false;
  balk.classList.add('bovenaan','laden');
  var hoofd=document.querySelector('main');
  if(hoofd&&hoofd.firstElementChild!==balk)hoofd.insertBefore(balk,hoofd.firstChild);
  balk.innerHTML='<span class="tekst"><b>Gegevens worden geladen…</b> Wat je nu wijzigt kan pas worden opgeslagen als dit klaar is.</span>';
  return;
 }
 balk.classList.remove('bovenaan','laden');
 balk.hidden=!laadMislukt();
 if(balk.hidden)return;
 balk.innerHTML='<span class="tekst"><b>Gegevens niet geladen.</b> Je ziet nu voorbeeldgegevens, niet de echte administratie. '+
  'Opslaan is uitgeschakeld, anders zouden deze voorbeelden de echte gegevens overschrijven.</span>'+
  '<button type="button" class="primary" id="laad-opnieuw">Opnieuw laden</button>';
 el('laad-opnieuw').addEventListener('click',async function(){
  var knop=el('laad-opnieuw');
  knop.disabled=true;knop.textContent='Bezig…';
  await loadFromSupabase();
  if(laadMislukt()){knop.disabled=false;knop.textContent='Opnieuw laden';}
 });
}
function registreerOpslag(soort,gelukt){
 if(!sb)return gelukt;
 if(gelukt)delete opslagMislukt[soort]; else opslagMislukt[soort]=true;
 toonOpslagStatus();
 return gelukt;
}
var OPSLAGNAMEN={personen:'gebruikers en rechten',groepen:'de groepenlijst',organisatie:'instituten, locaties en groepen',
 clientdata:'gegevens uit de cliënt-app',chat:'chatberichten',logboek:'het logboek',datalek:'de datalekmelding'};
function toonOpslagStatus(){
 var balk=el('opslag-balk');if(!balk)return;
 var soorten=Object.keys(opslagMislukt);
 balk.hidden=!soorten.length;
 if(!soorten.length)return;
 var wat=soorten.map(function(k){return OPSLAGNAMEN[k]||k;}).join(' en ');
 if(groepConflict&&groepConflict.length){
  balk.innerHTML='<span class="tekst"><b>Niet opgeslagen.</b> Een andere beheerder heeft intussen de groep '+
   groepConflict.map(function(g){return '"'+esc(g)+'"';}).join(', ')+' verwijderd of hernoemd. Wat je in die groep deed, is niet opgeslagen. Herlaad de pagina om met de actuele groepen verder te werken.</span>'+
   '<button type="button" class="primary" id="opslag-herlaad">Pagina herladen</button>';
  el('opslag-herlaad').addEventListener('click',function(){location.reload();});
  return;
 }
 balk.innerHTML='<span class="tekst"><b>Niet opgeslagen.</b> De wijziging in '+esc(wat)+
  ' staat wel op je scherm, maar is niet in de database beland. Sluit dit venster niet zonder het opnieuw te proberen.</span>'+
  '<button type="button" class="primary" id="opslag-opnieuw">Opnieuw proberen</button>';
 el('opslag-opnieuw').addEventListener('click',probeerOpslagOpnieuw);
}
/* Een voor een opnieuw versturen; wat weer mislukt blijft in de rij staan. */
async function verstuurOpnieuw(soort,verstuur){
 var rij=nogTeVersturen[soort].slice();nogTeVersturen[soort]=[];
 for(var i=0;i<rij.length;i++){
  var ok=false;try{ok=await verstuur(rij[i]);}catch(e){}
  if(!ok)nogTeVersturen[soort].push(rij[i]);
 }
 registreerOpslag(soort,nogTeVersturen[soort].length===0);
}
async function probeerOpslagOpnieuw(){
 var knop=el('opslag-opnieuw');
 if(knop){knop.disabled=true;knop.textContent='Bezig…';}
 if(opslagMislukt.personen)await syncToSupabase();
 if(opslagMislukt.groepen)await syncGroepenToSupabase();
 if(opslagMislukt.logboek)await verstuurOpnieuw('logboek',function(r){
  return sb.from('logboek').insert([r]).then(function(res){return !(res&&res.error);},function(){return false;});
 });
 if(opslagMislukt.datalek)await verstuurOpnieuw('datalek',bewaarDatalek);
 if(opslagMislukt.organisatie)await syncOrganisatieData();
 if(opslagMislukt.clientdata&&typeof caClientId!=='undefined'&&caClientId)bewaarClientDataNu(caClientId);
 if(opslagMislukt.chat&&typeof caChatKey!=='undefined'&&caChatKey)bewaarChatThreadNu(caChatKey);
 toonOpslagStatus();
 var nogSteeds=Object.keys(opslagMislukt).length;
 if(nogSteeds){
  var k2=el('opslag-opnieuw');
  if(k2){k2.disabled=false;k2.textContent='Opnieuw proberen';}
 }
}
/* ---- Alleen wegschrijven wat deze sessie heeft veranderd ----
   Eerst ging bij elke opslag de hele personentabel en alle instellingen mee,
   met de stand uit het eigen geheugen. Had een tweede beheerder de pagina
   open, dan draaide diens volgende opslag jouw wijzigingen terug, ook bij
   mensen die hij nooit had aangeraakt (aangetoond met twee tabbladen). Nu
   onthouden we wat er het laatst uit de database kwam of erin ging, en gaat
   alleen mee wat daarvan afwijkt. Wijzigen twee mensen tegelijk dezelfde
   persoon, dan wint nog steeds de laatste; dat is een echt conflict. */
var dbStandPersonen={},dbStandOrg={};
var OBJECTVELDEN=['client_rechten','medewerker_rechten','naaste_rechten','rollen','toestemming'];
var OBJECTVELD_PROP={client_rechten:'clientRechten',medewerker_rechten:'medewerkerRechten',naaste_rechten:'naasteRechten',rollen:'rollen',toestemming:'toestemming'};
function onthoudDbStandPersonen(lijst){
 dbStandPersonen={};
 lijst.forEach(function(p){dbStandPersonen[p.id]=JSON.stringify(personRowToDb(p));});
}
/* ---- Nieuwe id's die niet botsen ----
   Elke sessie deelt id's uit vanaf "hoogste bij het laden + 1". Maakten twee
   beheerders tegelijk iemand aan, dan kregen beide personen hetzelfde id en
   overschreef de tweede de eerste (aangetoond). Vlak voor het wegschrijven
   vragen we daarom het hoogste id in de database op en nummeren we een nieuwe
   persoon die daarmee botst om, inclusief alle verwijzingen naar hem. */
function hernummerPersoon(oud,nieuw){
 var p=findPerson(oud);if(!p)return;
 p.id=nieuw;
 people.forEach(function(x){
  ['clientRechten','medewerkerRechten','naasteRechten'].forEach(function(veld){
   if(x[veld]&&x[veld][oud]!==undefined){x[veld][nieuw]=x[veld][oud];delete x[veld][oud];}
  });
  if(x.wettelijkeVertegenwoordiger===oud)x.wettelijkeVertegenwoordiger=nieuw;
 });
 [CLIENTDATA,GEHEUGEN,CA_INSTELLINGEN,TOEGANGSCONTROLE,MAALTIJDRESERVERINGEN].forEach(function(opslag){
  if(opslag&&opslag[oud]!==undefined){opslag[nieuw]=opslag[oud];delete opslag[oud];}
 });
 if(huidigProfielId===oud)huidigProfielId=nieuw;
 if(caClientId===oud)caClientId=nieuw;
}
async function maakNieuweIdsVrij(){
 var nieuw=people.filter(function(p){return p._state!=='nieuw'&&dbStandPersonen[p.id]===undefined;});
 if(!nieuw.length)return true;
 var res=await sb.from('personen').select('id').order('id',{ascending:false}).limit(1);
 if(res.error)return false;
 var hoogste=res.data&&res.data[0]?res.data[0].id:0;
 var bezet={};people.forEach(function(p){bezet[p.id]=true;});
 var volgende=Math.max(hoogste,nextId-1)+1;
 nieuw.forEach(function(p){
  if(p.id>hoogste)return;
  while(bezet[volgende])volgende++;
  var oud=p.id;hernummerPersoon(oud,volgende);bezet[volgende]=true;volgende++;
 });
 nextId=Math.max(nextId,volgende);
 return true;
}
/* Een recht hoort alleen te bestaan tussen mensen die een groep delen, en alleen
   op iemand die nog bestaat. Opruimen gebeurde alleen bij de mensen die deze
   sessie kende; wie een andere beheerder intussen had aangemaakt, hield zo
   toegang tot een cliënt buiten zijn groep, of een recht op een gewiste persoon
   (aangetoond met invarianten.js ... twee). Daarom na het wegschrijven in de
   database zelf nakijken, voor de mensen die net veranderden (geraakt) en voor
   rechten op gewiste id's (gewist). Gearchiveerden houden hun rechten: die
   komen terug bij herstellen. */
async function ruimRechtenOpInDatabase(geraakt,gewist){
 var q=await alleRijen(function(){return sb.from('personen').select('id,groepen,archived,client_rechten,medewerker_rechten,naaste_rechten').order('id');});
 if(q.error||!q.data)return false;
 var per={};q.data.forEach(function(r){per[r.id]=r;});
 var deelt=function(a,b){return (a.groepen||[]).some(function(g){return (b.groepen||[]).indexOf(g)>-1;});};
 var velden=['client_rechten','medewerker_rechten','naaste_rechten'];
 for(var i=0;i<q.data.length;i++){
  var r=q.data[i],wijz={};
  velden.forEach(function(v){
   var o=r[v]||{},n=null;
   Object.keys(o).forEach(function(k){
    var t=per[+k],weg=false;
    if(!t)weg=gewist.indexOf(+k)>-1||geraakt.indexOf(r.id)>-1;
    else if(!r.archived&&!t.archived&&(geraakt.indexOf(r.id)>-1||geraakt.indexOf(+k)>-1)&&!deelt(r,t))weg=true;
    if(weg){n=n||Object.assign({},o);delete n[k];}
   });
   if(n)wijz[v]=n;
  });
  if(!Object.keys(wijz).length)continue;
  var res=await sb.from('personen').update(wijz).eq('id',r.id);
  if(res.error)return false;
  var p=findPerson(r.id);
  /* Alleen de weggehaalde rechten ook op het scherm weghalen. */
  Object.keys(wijz).forEach(function(v){
   var loc=p&&p[OBJECTVELD_PROP[v]];if(!loc)return;
   Object.keys(r[v]||{}).forEach(function(k){if(!(k in wijz[v]))delete loc[k];});
  });
  if(dbStandPersonen[r.id]){var st=JSON.parse(dbStandPersonen[r.id]);Object.assign(st,wijz);dbStandPersonen[r.id]=JSON.stringify(st);}
 }
 return true;
}
/* Gekoppelde groepen delen hun medewerkers. Een medewerker die een andere
   beheerder (met een oude stand) in één van die groepen zette, of die er al in
   zat toen deze sessie koppelde zonder hem te kennen, kwam niet in het hele
   team (aangetoond met invarianten.js ... twee). Hier met de koppelingen en
   groepen uit de database aanvullen: voor de meegegeven id's, of (null) voor
   iedereen. */
async function vulTeamsAanInDatabase(ids){
 var kq=await sb.from('organisatie_data').select('sleutel,waarde').in('sleutel',['groep_koppelingen']);
 if(kq.error)return false;
 var kopp=((kq.data||[])[0]||{}).waarde;
 if(!Array.isArray(kopp)||!kopp.length)return true;
 var gq=await alleRijen(function(){return sb.from('groepen').select('naam').order('id');});
 if(gq.error||!gq.data)return false;
 var bestaand=gq.data.map(function(r){return r.naam;});
 var q=await alleRijen(function(){return sb.from('personen').select('id,type,groepen,archived').order('id');});
 if(q.error||!q.data)return false;
 for(var i=0;i<q.data.length;i++){
  var r=q.data[i];
  if(r.type!=='medewerker'||r.archived||(ids&&ids.indexOf(r.id)<0))continue;
  var g=(r.groepen||[]).slice(),erbij=false;
  kopp.forEach(function(k){
   if(!Array.isArray(k)||!k.some(function(x){return g.indexOf(x)>-1;}))return;
   k.forEach(function(x){if(g.indexOf(x)<0&&bestaand.indexOf(x)>-1){g.push(x);erbij=true;}});
  });
  if(!erbij)continue;
  var res=await sb.from('personen').update({groepen:g}).eq('id',r.id);
  if(res.error)return false;
  var p=findPerson(r.id);
  if(p)g.forEach(function(x){if((r.groepen||[]).indexOf(x)<0&&p.groepen.indexOf(x)<0&&GROEPEN.indexOf(x)>-1)p.groepen.push(x);});
  if(dbStandPersonen[r.id]){var st=JSON.parse(dbStandPersonen[r.id]);st.groepen=g;dbStandPersonen[r.id]=JSON.stringify(st);}
 }
 return true;
}
/* Alle schrijfacties van deze sessie op volgorde. Ze werden los van elkaar
   gestart (koppelen, dan meteen een groep verwijderen) en liepen dan door
   elkaar heen: een nakijkstap las een oude databasestand en zette een net
   verwijderde groep terug (aangetoond met invarianten.js). Bij het sluiten van
   de pagina wordt niet gewacht, anders komt het verzoek te laat. */
var opslagRij=Promise.resolve();
function inRij(fn){
 if(paginaSluit)return fn();
 var nu=opslagRij.then(fn,fn);
 opslagRij=nu.catch(function(){});
 return nu;
}
function syncToSupabase(){return inRij(schrijfPersonenWeg);}
async function schrijfPersonenWeg(){
 if(!sb)return false;
 if(opslagGeblokkeerd())return false;    /* zou de voorbeeldgegevens over de echte heen schrijven */
 try{
  /* Een nieuwe persoon gaat pas naar de database bij Wijzigingen doorvoeren.
     Of iemand "nieuw" is wordt niet opgeslagen; een persoon die tussendoor
     werd weggeschreven (dat gebeurt bij veel handelingen) was na herladen
     dus een gewoon actief account, zonder controle en soms zonder naam. */
  /* Bestaande personen: alleen de velden die anders zijn dan wat er het laatst
     uit de database kwam. Een hele rij terugschrijven zette ook velden terug
     die een ander intussen had gewijzigd. Nieuwe personen gaan in hun geheel. */
  if(!(await maakNieuweIdsVrij()))return registreerOpslag('personen',false);
  var nieuweRijen=[],updates=[];
  people.filter(function(p){return p._state!=='nieuw';}).map(personRowToDb).forEach(function(r){
   var oud=dbStandPersonen[r.id],js=JSON.stringify(r);
   if(oud===js)return;
   if(oud===undefined){nieuweRijen.push(r);return;}
   var vorig=JSON.parse(oud),diff={};
   Object.keys(r).forEach(function(k){if(JSON.stringify(r[k])!==JSON.stringify(vorig[k]))diff[k]=r[k];});
   updates.push({rij:r,diff:diff});
  });
  if(!nieuweRijen.length&&!updates.length)return registreerOpslag('personen',true);
  var fout=false;
  /* Twee beheerders tegelijk: B werkt met een oude stand terwijl A een groep
     hernoemde of verwijderde. Zonder deze stap schreef B mensen weg met een
     groepsnaam die niet meer bestaat; die waren daarna nergens meer te vinden
     (aangetoond met invarianten.js ... twee). Daarom: de groepen van een
     persoon per naam samenvoegen met de databasestand (alleen wat deze sessie
     toevoegde of weghaalde), en niets wegschrijven met een groep die niet
     (meer) bestaat. */
  var metGroepen=updates.filter(function(u){return 'groepen' in u.diff;});
  if(metGroepen.length||nieuweRijen.length){
   var gq=await alleRijen(function(){return sb.from('groepen').select('naam').order('id');});
   if(gq.error||!gq.data)return registreerOpslag('personen',false);
   var bestaand=gq.data.map(function(r){return r.naam;}).concat(groepMutaties.erbij);
   if(metGroepen.length){
    var hq=await inStukken(metGroepen.map(function(u){return u.rij.id;}),function(d){return sb.from('personen').select('id,groepen').in('id',d);});
    if(hq.error)return registreerOpslag('personen',false);
    metGroepen.forEach(function(u){
     var db=((hq.data||[]).filter(function(r){return r.id===u.rij.id;})[0]||{}).groepen;
     if(!Array.isArray(db))return;
     var vorig=JSON.parse(dbStandPersonen[u.rij.id]).groepen||[];
     var mijn=u.rij.groepen||[];
     var samen=voegLijstSamen(db,vorig,mijn);
     u.diff.groepen=samen;u.rij.groepen=samen;
     /* Op het scherm: wat een ander deed erbij, zonder wat de gebruiker
        intussen zelf nog veranderde terug te draaien. */
     var p=findPerson(u.rij.id);if(p)p.groepen=voegLijstSamen(samen,mijn,p.groepen||[]);
    });
   }
   var weg=function(r){return (r.groepen||[]).filter(function(g){return bestaand.indexOf(g)<0;});};
   var conflict=[];
   var houd=function(r){var mis=weg(r);mis.forEach(function(g){if(conflict.indexOf(g)<0)conflict.push(g);});return !mis.length;};
   updates=updates.filter(function(u){return !('groepen' in u.diff)||houd(u.rij);});
   nieuweRijen=nieuweRijen.filter(houd);
   if(conflict.length){groepConflict=conflict;fout=true;}
  }
  if(nieuweRijen.length){
   /* insert, geen upsert: een botsing die er toch doorheen komt geeft een
      fout in plaats van stilletjes iemand te overschrijven. */
   var res=await sb.from('personen').insert(nieuweRijen);
   if(res.error)fout=true; else nieuweRijen.forEach(function(r){dbStandPersonen[r.id]=JSON.stringify(r);});
  }
  /* Rechten, rolkeuze en toestemming zijn objecten per persoon. Het hele object
     terugschrijven zette een recht dat een ander net had ingetrokken weer aan
     (of gaf er een weg). Daarom per sleutel: alleen wat deze sessie heeft
     toegevoegd, gewijzigd of weggehaald, toegepast op wat er nu in de database
     staat. */
  var objectVelden=updates.filter(function(u){return OBJECTVELDEN.some(function(k){return k in u.diff;});});
  if(objectVelden.length){
   var huidig=await inStukken(objectVelden.map(function(u){return u.rij.id;}),function(d){return sb.from('personen').select('id,'+OBJECTVELDEN.join(',')).in('id',d);});
   if(huidig.error)return registreerOpslag('personen',false);
   objectVelden.forEach(function(u){
    var db=(huidig.data||[]).filter(function(r){return r.id===u.rij.id;})[0]||{};
    var vorig=JSON.parse(dbStandPersonen[u.rij.id]);
    OBJECTVELDEN.forEach(function(k){
     if(!(k in u.diff))return;
     var samen=Object.assign({},db[k]||{}),oud=vorig[k]||{},nu=u.rij[k]||{};
     Object.keys(nu).forEach(function(s){if(JSON.stringify(nu[s])!==JSON.stringify(oud[s]))samen[s]=nu[s];});
     Object.keys(oud).forEach(function(s){if(!(s in nu))delete samen[s];});
     u.diff[k]=samen;u.rij[k]=samen;
     /* Ook in beeld de samengevoegde stand, zodat je ziet wat een ander deed. */
     var p=findPerson(u.rij.id);if(p)p[OBJECTVELD_PROP[k]]=samen;
    });
   });
  }
  var uitkomsten=await Promise.all(updates.map(function(u){return sb.from('personen').update(u.diff).eq('id',u.rij.id);}));
  uitkomsten.forEach(function(res,i){if(res.error)fout=true; else dbStandPersonen[updates[i].rij.id]=JSON.stringify(updates[i].rij);});
  var geraakt=nieuweRijen.map(function(r){return r.id;}).concat(updates.filter(function(u){
   return ['groepen','archived'].concat(OBJECTVELDEN).some(function(k){return k in u.diff;});}).map(function(u){return u.rij.id;}));
  if(geraakt.length&&!(await vulTeamsAanInDatabase(geraakt)))fout=true;
  if(geraakt.length&&!(await ruimRechtenOpInDatabase(geraakt,[])))fout=true;
  return registreerOpslag('personen',!fout);
 }
 catch(e){return registreerOpslag('personen',false);}
}

function naam(p){return p.voor+' '+p.achter;}
function personenVanType(t){return people.filter(function(p){return p.type===t&&!p.archived&&p.groepen.indexOf(huidigeGroep)>-1;});}

/* De globale rol volgt altijd de standaardrollen van de groep en is nergens met de
   hand te zetten. Hij wordt hier berekend i.p.v. blind uit p.rol gelezen, zodat een
   rol die ooit is opgeslagen en daarna uit de rechtensets verdween nooit meer kan
   opduiken (zoals de verwijderde adminrollen deden). */
function globaleRolVoor(p){
 if(p.type==='client')return '';
 var r=rolVan(p,'globaal');
 return r!=='Geen'?r:ROLLEN[p.type].globaal[0];
}
/* Eenmalige datacorrectie na het laden: schrijf afwijkende opgeslagen rollen recht,
   zodat de database niet met ongeldige waarden blijft staan. */
function synchroniseerGlobaleRollen(){
 var aangepast=false;
 people.forEach(function(p){
  if(p.type==='client'||p.archived)return;
  var juist=globaleRolVoor(p);
  if(p.rol!==juist){p.rol=juist;aangepast=true;}
 });
 if(aangepast)syncToSupabase();
}

function mailInGebruik(mail,negeerId){
 if(!mail)return false;
 return people.some(function(x){return x.id!==negeerId&&!x.archived&&x.mail&&x.mail.toLowerCase()===mail.toLowerCase();});
}
function mailGeldig(mail){return !mail||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);}
/* Twee mensen met exact dezelfde naam in één groep is in de zorg een reëel
   verwisselingsrisico, dus dat melden we — blokkeren doen we niet, want
   naamgenoten bestaan echt. */
function naamgenootInGroep(p,voor,achter){
 var volledig=(cap(voor)+' '+cap(achter)).toLowerCase();
 return people.filter(function(x){
  return x.id!==p.id&&!x.archived&&x._state!=='verwijderd'&&
   x.groepen.some(function(g){return (p.groepen||[]).indexOf(g)>-1;})&&
   naam(x).toLowerCase()===volledig;
 })[0]||null;
}
/* Geeft de foutmelding terug, of '' als het adres bruikbaar is. */
function mailFout(mail,negeerId){
 if(!mailGeldig(mail))return 'Dit is geen geldig e-mailadres.';
 if(mailInGebruik(mail,negeerId))return 'Dit e-mailadres is al in gebruik door iemand anders.';
 return '';
}
/* Een rode rand alleen zag niet iedereen, en zei niet wat er mis was: wie de
   achternaam leeg liet dacht dat de knop het niet deed. Met null/null worden
   de meldingen alleen gewist (bij het openen van een profiel). */
function toonNaamFout(prefix,voor,achter){
 var wis=voor===null&&achter===null;
 var paren=[['voornaam',voor],['achternaam',achter]],ok=true;
 paren.forEach(function(x){
  var leeg=!wis&&!x[1];
  el(prefix+'-'+x[0]).style.borderColor=leeg?'var(--brick)':'';
  el(prefix+'-'+x[0]+'-fout').hidden=!leeg;
  if(leeg)ok=false;
 });
 return ok;
}
function toonMailFout(inputId,foutId,tekst){
 el(inputId).style.borderColor=tekst?'var(--brick)':'';
 el(foutId).textContent=tekst;
 el(foutId).hidden=!tekst;
 return !tekst;
}

function clientRechtenRow(p,t){
 var clients=personenVanType('client');
 if(!clients.length)return '<p class="empty-msg">Geen cliënten in deze groep.</p>';
 var rollen=ROLLEN[t].clienten.filter(function(r){return r!=='Geen';});
 return clients.map(function(c){
  var huidig=(p.clientRechten||{})[c.id]||'';
  return '<div class="personrow" style="box-shadow:none">'+avatarHtml(naam(c),fotoVan(c))+'<div class="pinfo"><div class="naam">'+esc(naam(c))+'</div></div>'+
   '<select data-clientrol="'+c.id+'" data-id="'+p.id+'" aria-label="Rol van '+esc(naam(p))+' op '+esc(naam(c))+'" style="width:auto;min-width:150px"><option value="">Geen toegang</option>'+
   rollen.map(function(r){return '<option'+(r===huidig?' selected':'')+'>'+r+'</option>';}).join('')+'</select></div>';
 }).join('');
}
function wireClientRechten(container,t,onchange){
 Array.prototype.forEach.call(container.querySelectorAll('[data-clientrol]'),function(sel){
  sel.addEventListener('change',function(){
   var p=findPerson(+sel.getAttribute('data-id')),clientId=+sel.getAttribute('data-clientrol');
   var client=findPerson(clientId);
   p.clientRechten=p.clientRechten||{};
   if(sel.value)p.clientRechten[clientId]=sel.value; else delete p.clientRechten[clientId];
   logActie(client?(sel.value
    ? naam(p)+' kreeg rol "'+sel.value+'" op cliënt '+naam(client)
    : 'Toegang van '+naam(p)+' tot cliënt '+naam(client)+' ingetrokken'):'');
   if(p._state!=='nieuw')p._state='gewijzigd';
   onchange&&onchange();
  });
 });
}
function rolOpNaaste(medewerker,naasteId){return (medewerker.naasteRechten||{})[naasteId]||null;}
function naasteRechtenRow(p){
 var naasten=personenVanType('naaste');
 if(!naasten.length)return '<p class="empty-msg">Geen naasten in deze groep.</p>';
 var rollen=ROLLEN.naaste.groep.filter(function(r){return r!=='Geen';});
 return naasten.map(function(n){
  var huidig=(p.naasteRechten||{})[n.id]||'';
  return '<div class="personrow" style="box-shadow:none">'+avatarHtml(naam(n),fotoVan(n))+'<div class="pinfo"><div class="naam">'+esc(naam(n))+'</div></div>'+
   '<select data-naasterol="'+n.id+'" data-id="'+p.id+'" aria-label="Rol van '+esc(naam(p))+' op '+esc(naam(n))+'" style="width:auto;min-width:150px"><option value="">Geen toegang</option>'+
   rollen.map(function(r){return '<option'+(r===huidig?' selected':'')+'>'+r+'</option>';}).join('')+'</select></div>';
 }).join('');
}
function wireNaasteRechten(container,onchange){
 Array.prototype.forEach.call(container.querySelectorAll('[data-naasterol]'),function(sel){
  sel.addEventListener('change',function(){
   var p=findPerson(+sel.getAttribute('data-id')),naasteId=+sel.getAttribute('data-naasterol');
   p.naasteRechten=p.naasteRechten||{};
   if(sel.value)p.naasteRechten[naasteId]=sel.value; else delete p.naasteRechten[naasteId];
   if(p._state!=='nieuw')p._state='gewijzigd';
   onchange&&onchange();
  });
 });
}
function medewerkerRechtenRow(naasteId){
 var medewerkers=personenVanType('medewerker');
 if(!medewerkers.length)return '<p class="empty-msg">Geen medewerkers in deze groep.</p>';
 var rollen=ROLLEN.naaste.groep.filter(function(r){return r!=='Geen';});
 return medewerkers.map(function(m){
  var huidig=rolOpNaaste(m,naasteId)||'';
  return '<div class="personrow" style="box-shadow:none">'+avatarHtml(naam(m),fotoVan(m))+'<div class="pinfo"><div class="naam">'+esc(naam(m))+'</div></div>'+
   '<select data-medewerkerrol="'+m.id+'" data-naasteid="'+naasteId+'" aria-label="Rol van '+esc(naam(m))+' op deze naaste" style="width:auto;min-width:150px"><option value="">Geen toegang</option>'+
   rollen.map(function(r){return '<option'+(r===huidig?' selected':'')+'>'+r+'</option>';}).join('')+'</select></div>';
 }).join('');
}
function wireMedewerkerRechten(container,onchange){
 Array.prototype.forEach.call(container.querySelectorAll('[data-medewerkerrol]'),function(sel){
  sel.addEventListener('change',function(){
   var m=findPerson(+sel.getAttribute('data-medewerkerrol')),naasteId=+sel.getAttribute('data-naasteid');
   m.naasteRechten=m.naasteRechten||{};
   if(sel.value)m.naasteRechten[naasteId]=sel.value; else delete m.naasteRechten[naasteId];
   if(m._state!=='nieuw')m._state='gewijzigd';
   onchange&&onchange();
  });
 });
}
function rolOpMedewerker(medewerker,otherId){return (medewerker.medewerkerRechten||{})[otherId]||null;}
function medewerkerPeerRow(p){
 var peers=personenVanType('medewerker').filter(function(m){return m.id!==p.id;});
 if(!peers.length)return '<p class="empty-msg">Geen andere medewerkers in deze groep.</p>';
 var rollen=ROLLEN.medewerker.medewerkers.filter(function(r){return r!=='Geen';});
 return peers.map(function(m){
  var huidig=(p.medewerkerRechten||{})[m.id]||'';
  return '<div class="personrow" style="box-shadow:none">'+avatarHtml(naam(m),fotoVan(m))+'<div class="pinfo"><div class="naam">'+esc(naam(m))+'</div></div>'+
   '<select data-medewerkerpeerrol="'+m.id+'" data-id="'+p.id+'" aria-label="Rol van '+esc(naam(p))+' op '+esc(naam(m))+'" style="width:auto;min-width:150px"><option value="">Geen toegang</option>'+
   rollen.map(function(r){return '<option'+(r===huidig?' selected':'')+'>'+r+'</option>';}).join('')+'</select></div>';
 }).join('');
}
function wireMedewerkerPeerRechten(container,onchange){
 Array.prototype.forEach.call(container.querySelectorAll('[data-medewerkerpeerrol]'),function(sel){
  sel.addEventListener('change',function(){
   var p=findPerson(+sel.getAttribute('data-id')),otherId=+sel.getAttribute('data-medewerkerpeerrol');
   p.medewerkerRechten=p.medewerkerRechten||{};
   if(sel.value)p.medewerkerRechten[otherId]=sel.value; else delete p.medewerkerRechten[otherId];
   if(p._state!=='nieuw')p._state='gewijzigd';
   onchange&&onchange();
  });
 });
}
/* Verlopen toegang moet opvallen in de lijst, niet alleen in het profiel: het is
   de reden dat iemand niet meer kan inloggen. Bijna verlopen krijgt een zachtere
   kleur, zodat je het op tijd ziet zonder dat het als fout leest. */
function toegangChip(p){
 var dagen=dagenTotVerloop(p);
 if(dagen===null)return '';
 if(dagen<0)return ' <span class="statuschip" style="background:var(--brick-bg);color:var(--brick)">Toegang verlopen</span>';
 if(dagen<=14)return ' <span class="statuschip" style="background:var(--amber-bg);color:var(--amber)">Nog '+dagen+' dag'+(dagen===1?'':'en')+'</span>';
 return ' <span class="statuschip" style="background:var(--accent-bg);color:var(--accent)">Tot '+esc(datumNL(p.toegangTot))+'</span>';
}
function rowHtml(p,t){
 var staged=p._state==='verwijderd';
 var stateTag=p._state?' <span class="mini" style="color:'+STATE_COLOR[p._state]+'">— '+STATE_LABEL[p._state]+'</span>':'';
 var contactBadge=(t==='medewerker'&&p.contactpersoon)?' <span class="countchip" style="color:var(--accent)">Contactpersoon</span>':'';
 var toegangBadge=blokkadeChip(p)+toegangChip(p);
 var gekozen=selectie[t]&&selectie[t][p.id];
 var head='<div class="uhead">'+
  '<input type="checkbox" class="rowkies" data-kies="'+p.id+'" '+(gekozen?'checked':'')+' aria-label="Selecteer '+esc(naam(p))+'">'+
  avatarHtml(naam(p),fotoVan(p))+
  '<div class="pinfo"><div class="naam">'+esc(naam(p))+contactBadge+toegangBadge+stateTag+'</div><div class="mail">'+esc(p.mail||(p.type==='client'?'—':''))+'</div></div>'+
  '<div class="rowbtns">'+
   '<button type="button" class="iconbtn" data-editrow="'+p.id+'" aria-label="Bewerken">'+PENCIL_SVG+'</button>'+
   '<button type="button" class="iconbtn danger" data-trashrow="'+p.id+'" aria-label="Verwijderen">'+TRASH_SVG+'</button>'+
  '</div></div>';
 return '<div class="urow'+(staged?' staged':'')+'" data-row="'+p.id+'">'+head+'</div>';
}

/* Meerdere mensen tegelijk koppelen, verplaatsen of archiveren. Zonder dit moet
   je bij elke verhuizing of nieuwe collega iedereen los aanklikken. */
var selectie={client:{},medewerker:{},naaste:{}};
/* Alleen wie nu echt in de lijst staat telt mee. Anders blijft een selectie uit
   een andere groep actief en zou "Verwijderen" iemand raken die je niet ziet. */
function gekozenIds(t){
 var zichtbaar={};
 personenVanType(t).forEach(function(p){zichtbaar[p.id]=true;});
 return Object.keys(selectie[t]).filter(function(id){return selectie[t][id]&&zichtbaar[id];}).map(Number);
}
/* De lijst zoals hij nu op het scherm staat, inclusief de zoekterm. */
function gefilterdePersonen(t){
 var term=(lijstZoek[t]||'').trim().toLowerCase();
 var alles=personenVanType(t);
 if(!term)return alles;
 return alles.filter(function(p){
  return naam(p).toLowerCase().indexOf(term)>-1||(p.mail||'').toLowerCase().indexOf(term)>-1;
 });
}
function schoonSelectie(t){
 var zichtbaar={};
 personenVanType(t).forEach(function(p){zichtbaar[p.id]=true;});
 Object.keys(selectie[t]).forEach(function(id){if(!zichtbaar[id])delete selectie[t][id];});
}
function wisSelectie(t){selectie[t]={};}
function renderBulkbar(t){
 var balk=el('bulkbar-'+t),ids=gekozenIds(t);
 if(!ids.length){balk.hidden=true;balk.innerHTML='';return;}
 balk.hidden=false;
 var inBeeld={};
 gefilterdePersonen(t).forEach(function(p){inBeeld[p.id]=true;});
 var verborgen=ids.filter(function(id){return !inBeeld[id];}).length;
 balk.innerHTML='<b>'+ids.length+' geselecteerd</b>'+
  (verborgen?'<span class="mini" style="color:var(--amber)">waarvan '+verborgen+' buiten je zoekresultaat</span>':'')+
  '<button type="button" data-bulk="koppel">Koppelen aan groep…</button>'+
  (t==='medewerker'?'<button type="button" data-bulk="rol">Rol op alle cliënten…</button>':'')+
  '<button type="button" class="danger" data-bulk="verwijder">Verwijderen</button>'+
  '<button type="button" class="ghost" data-bulk="wis">Selectie wissen</button>';
 Array.prototype.forEach.call(balk.querySelectorAll('[data-bulk]'),function(b){
  b.addEventListener('click',function(){bulkActie(t,b.getAttribute('data-bulk'),gekozenIds(t));});
 });
}
function bulkActie(t,actie,ids){
 if(actie==='wis'){wisSelectie(t);renderAcc(t);return;}
 var personen=ids.map(findPerson).filter(Boolean);
 if(!personen.length)return;
 if(actie==='koppel'){
  kiesUitLijstModal('Aan welke groep koppelen?',GROEPEN,function(g){return g;},function(g){
   var aantal=0;
   personen.forEach(function(p){
    if(p.groepen.indexOf(g)<0){p.groepen.push(g);if(p._state!=='nieuw')p._state='gewijzigd';aantal++;}
   });
   logActie(aantal+' '+TYPELABEL[t].toLowerCase()+'(en) gekoppeld aan groep "'+g+'"');
   wisSelectie(t);renderAll();
   openMelding('Gekoppeld',aantal+' van de '+personen.length+' gekoppeld aan "'+g+'". De rest zat er al in.');
  });
  return;
 }
 if(actie==='rol'){
  var rollen=ROLLEN.medewerker.clienten;
  kiesUitLijstModal('Welke rol op alle cliënten in deze groep?',rollen,function(r){return r;},function(rol){
   var clienten=personenVanType('client');
   personen.forEach(function(m){
    m.clientRechten=m.clientRechten||{};
    clienten.forEach(function(c){
     if(rol==='Geen')delete m.clientRechten[c.id]; else m.clientRechten[c.id]=rol;
    });
    if(m._state!=='nieuw')m._state='gewijzigd';
   });
   logActie(personen.length+' medewerker(s) kregen rol "'+rol+'" op alle '+clienten.length+' cliënten van '+huidigeGroep);
   wisSelectie(t);renderAll();
   openMelding('Rollen aangepast',personen.length+' medewerker(s) hebben nu de rol "'+rol+'" op alle cliënten in deze groep.');
  });
  return;
 }
 if(actie==='verwijder'){
  /* Wie ook elders zit wordt niet verwijderd maar losgekoppeld. Dat hoort hier te
     staan, want per persoon een venster openen zou dit venster overschrijven. */
  var blijvers=personen.filter(blijftElders);
  var elderszin=blijvers.length
   ? '<p>Let op: '+esc(blijvers.map(naam).join(', '))+' '+(blijvers.length>1?'zitten':'zit')+
     ' ook in een andere groep en '+(blijvers.length>1?'worden':'wordt')+
     ' alleen losgekoppeld van <b>'+esc(huidigeGroep)+'</b>. De rechten binnen deze groep vervallen daarbij.</p>'
   : '';
  openModal('<h3>'+personen.length+' '+esc(TYPELABEL[t].toLowerCase())+'(en) verwijderen</h3><div class="msec"><p>'+
   esc(personen.map(naam).join(', '))+'</p><p>Ze worden gemarkeerd om verwijderd te worden. Dit wordt pas definitief bij "Wijzigingen doorvoeren".</p>'+elderszin+'</div>'+
   '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-bevestig').addEventListener('click',function(){
   personen.forEach(function(p){markeerVerwijderd(p.id,t);});
   logActie(personen.length+' '+TYPELABEL[t].toLowerCase()+'(en) gemarkeerd om te verwijderen');
   wisSelectie(t);closeModal();renderAll();
  });
 }
}
function openMelding(titel,tekst){
 openModal('<h3>'+esc(titel)+'</h3><div class="msec"><p>'+esc(tekst)+'</p></div>'+
  '<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
}
/* Een melding met twee knoppen: er was alleen een variant om iets te bevestigen
   die je niet kon tegenhouden. De tekst is bewust html, zodat een waarschuwing
   de groepsnaam kan benadrukken. */
function bevestigModal(titel,htmlTekst,knopLabel,onJa){
 openModal('<h3>'+esc(titel)+'</h3><div class="msec">'+htmlTekst+'</div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="danger" id="modal-bevestig">'+esc(knopLabel)+'</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-bevestig').addEventListener('click',function(){closeModal();onJa();});
}
/* Gekoppelde groepen delen hun medewerkers ("haal je er een weg, dan gebeurt
   dat daar ook"). Een medewerker uit de huidige groep halen haalt hem dus uit
   het hele cluster; anders klopte het gedeelde team niet meer (aangetoond met
   invarianten.js). Cliënten en naasten blijven per groep. */
function teamVan(g){return clusterVan(g).filter(function(x){return GROEPEN.indexOf(x)>-1;});}
function groepenWeg(p){
 var weg=p.type==='medewerker'?teamVan(huidigeGroep):[huidigeGroep];
 return weg.filter(function(g){return (p.groepen||[]).indexOf(g)>-1;});
}
/* In welke groepen iemand komt als hij in groep g wordt gezet. */
function groepenBij(p,g){return p.type==='medewerker'?teamVan(g):[g];}
/* De groepen waar iemand ook nog in zit, dus zonder de groep waar je nu werkt
   (en, bij een medewerker, zonder de groepen die daaraan gekoppeld zijn). */
function andereGroepenVan(p){
 var weg=groepenWeg(p);
 return (p.groepen||[]).filter(function(g){return g!==huidigeGroep&&weg.indexOf(g)<0;});
}
/* Dezelfde voorwaarde die het doorvoeren gebruikt om te kiezen tussen ontkoppelen
   en archiveren, zodat waarschuwing, label en uitkomst niet uit elkaar lopen. */
function blijftElders(p){return andereGroepenVan(p).length>0;}
/* Iemand uit een groep halen terwijl hij elders nog gekoppeld is, is iets heel
   anders dan iemand verwijderen: hij blijft gewoon bestaan, inclusief rechten.
   Zonder deze waarschuwing lijkt het alsof je iemand weggooit. */
function waarschuwOntkoppelen(p,onJa){
 var anderen=andereGroepenVan(p);
 if(!blijftElders(p)||!anderen.length){onJa();return;}
 bevestigModal(
  esc(naam(p))+' blijft bestaan',
  '<p>'+esc(naam(p))+' werkt ook in <b>'+anderen.map(esc).join('</b>, <b>')+'</b> en blijft daar gewoon staan. Je haalt '+esc(naam(p))+' alleen weg uit <b>'+esc(huidigeGroep)+'</b>.</p>'+
  '<p>Alle toegang binnen '+esc(huidigeGroep)+' vervalt. Koppel je '+esc(naam(p))+' later terug, dan moet je die opnieuw instellen.</p>',
  'Ja, alleen uit '+huidigeGroep+' halen',onJa);
}
var TYPELABEL={client:'Cliënt',medewerker:'Medewerker',naaste:'Naaste'};
var lijstLimiet={client:5,medewerker:3,naaste:3};
var lijstUitgeklapt={client:false,medewerker:false,naaste:false};
var lijstZoek={client:'',medewerker:'',naaste:''};
function renderAcc(t){
 var alles=personenVanType(t);
 el('count-'+t).textContent=alles.length;
 /* Het zoekveld verschijnt pas als de lijst lang genoeg is om te moeten zoeken. */
 var zoekveld=el('zoek-'+t);
 var zoekZinvol=alles.length>lijstLimiet[t];
 zoekveld.hidden=!zoekZinvol;
 if(!zoekZinvol&&lijstZoek[t]){lijstZoek[t]='';zoekveld.value='';}
 var term=lijstZoek[t].trim().toLowerCase();
 var volledig=gefilterdePersonen(t);
 var limiet=lijstLimiet[t],uitgeklapt=lijstUitgeklapt[t]||volledig.length<=limiet;
 var lijst=uitgeklapt?volledig:volledig.slice(0,limiet);
 var box=el('rows-'+t);
 var leegTekst=term?'Niemand gevonden voor "'+term+'".':'Nog niemand in deze groep.';
 box.innerHTML=lijst.length? lijst.map(function(p){return rowHtml(p,t);}).join('') : '<p class="empty-msg">'+esc(leegTekst)+'</p>';
 var toonmeerBtn=el('acc-'+t).querySelector('[data-toonmeer]');
 if(toonmeerBtn){
  var verborgen=volledig.length-limiet;
  if(verborgen>0){
   toonmeerBtn.hidden=false;
   toonmeerBtn.textContent=uitgeklapt?'Toon minder':'Toon meer (+'+verborgen+')';
   toonmeerBtn.onclick=function(){lijstUitgeklapt[t]=!lijstUitgeklapt[t];renderAcc(t);};
  }else{
   toonmeerBtn.hidden=true;
  }
 }
 Array.prototype.forEach.call(box.querySelectorAll('[data-editrow]'),function(b){
  b.addEventListener('click',function(){
   var id=+b.getAttribute('data-editrow');
   if(t==='client')openProfielClient(id); else openProfielPersoon(id,t);
  });
 });
 Array.prototype.forEach.call(box.querySelectorAll('[data-trashrow]'),function(b){
  b.addEventListener('click',function(){trashRow(+b.getAttribute('data-trashrow'),t);});
 });
 schoonSelectie(t);
 Array.prototype.forEach.call(box.querySelectorAll('[data-kies]'),function(c){
  c.addEventListener('click',function(e){e.stopPropagation();});
  c.addEventListener('change',function(){
   selectie[t][+c.getAttribute('data-kies')]=c.checked;
   renderBulkbar(t);
  });
 });
 renderBulkbar(t);
}
['client','medewerker','naaste'].forEach(function(t){
 el('zoek-'+t).addEventListener('input',function(){lijstZoek[t]=this.value;renderAcc(t);});
});
function findPerson(id){return people.filter(function(x){return x.id===id;})[0];}

/* --- Volledig profiel: cliënt --- */
var huidigProfielId=null;
function persoonRechtRij(b,clientId,alleenLezen){
 var huidig=rolOpClient(b,clientId)||'';
 var rollen=ROLLEN[b.type].clienten.filter(function(r){return r!=='Geen';});
 var kop='<div class="personrow">'+avatarHtml(naam(b),fotoVan(b))+'<div class="pinfo"><div class="naam">'+esc(naam(b))+'</div><div class="mail">'+esc(b.mail||'')+'</div></div>';
 if(alleenLezen)return kop+'<span class="rolvast'+(huidig?'':' geen')+'">'+esc(huidig||'Geen toegang')+'</span></div>';
 return kop+
  '<select data-persoonrol="'+b.id+'" data-clientid="'+clientId+'" aria-label="Rol van '+esc(naam(b))+' op deze cliënt" style="width:auto;min-width:150px"><option value="">Geen toegang</option>'+
  rollen.map(function(r){return '<option'+(r===huidig?' selected':'')+'>'+r+'</option>';}).join('')+'</select></div>';
}
function personRechtenRow(clientId,alleenLezen){
 var medewerkers=personenVanType('medewerker'),naasten=personenVanType('naaste');
 if(!medewerkers.length&&!naasten.length)return '<p class="empty-msg">Nog niemand gekoppeld.</p>';
 return '<div class="sublistlabel">Medewerkers</div>'+
  (medewerkers.length?medewerkers.map(function(b){return persoonRechtRij(b,clientId,alleenLezen);}).join(''):'<p class="empty-msg">Geen medewerkers in deze groep.</p>')+
  '<div class="sublistlabel">Naasten</div>'+
  (naasten.length?naasten.map(function(b){return persoonRechtRij(b,clientId,alleenLezen);}).join(''):'<p class="empty-msg">Geen naasten in deze groep.</p>');
}
function wirePersoonRechten(container,onchange){
 Array.prototype.forEach.call(container.querySelectorAll('[data-persoonrol]'),function(sel){
  sel.addEventListener('change',function(){
   var persoon=findPerson(+sel.getAttribute('data-persoonrol')),clientId=+sel.getAttribute('data-clientid');
   var client=findPerson(clientId);
   persoon.clientRechten=persoon.clientRechten||{};
   if(sel.value)persoon.clientRechten[clientId]=sel.value; else delete persoon.clientRechten[clientId];
   logActie(client?(sel.value
    ? naam(persoon)+' kreeg rol "'+sel.value+'" op cliënt '+naam(client)
    : 'Toegang van '+naam(persoon)+' tot cliënt '+naam(client)+' ingetrokken'):'');
   if(persoon._state!=='nieuw')persoon._state='gewijzigd';
   onchange&&onchange();
  });
 });
}
function vertegenwoordigerOpties(client){
 var betrokkenen=people.filter(function(x){return (x.type==='medewerker'||x.type==='naaste')&&x.groepen.indexOf(huidigeGroep)>-1;});
 return '<option value="">Geen</option>'+betrokkenen.map(function(b){return '<option value="'+b.id+'"'+(client.wettelijkeVertegenwoordiger===b.id?' selected':'')+'>'+esc(naam(b))+'</option>';}).join('');
}
/* De vinkjes vullen en vertellen wanneer en door wie de toestemming is
   vastgelegd: zonder dat kun je niet aantonen dát er toestemming was. */
function toonToestemming(p){
 var t=toestemmingVan(p);
 el('pc-toestemming-foto').checked=!!t.foto;
 el('pc-toestemming-media').checked=!!t.media;
 el('pc-toestemming-chat').checked=!!t.chat;
 var info=el('pc-toestemming-info');
 if(t.vastgelegdOp){
  info.textContent='Laatst vastgelegd op '+datumNL(t.vastgelegdOp)+(t.door?' door '+t.door:'')+'.';
  info.style.color='';
 }else{
  info.textContent='Nog niets vastgelegd.';
  info.style.color='var(--amber)';
 }
 if(p.foto&&!t.foto){
  info.textContent+=' Er staat een foto klaar, maar die wordt niet getoond zolang er geen toestemming is.';
 }
}
/* Waar een profiel vandaan is geopend. Na opslaan of annuleren ga je daar weer
   naartoe: wie vanuit de Admin Tools een medewerker bewerkte, stond na het
   opslaan ineens in het groepsprofiel en moest zelf de weg terug zoeken.
   Wordt vastgelegd bij het openen, zolang de Admin Tools nog in beeld zijn
   (de flows schakelen pas daarna naar het groepsprofiel). */
var profielHerkomst=null;
function legHerkomstVast(id){
 if(huidigProfielId===id&&(!el('pp-profiel-persoon').hidden||!el('pp-profiel-client').hidden)&&el('view-admin').hidden)return;
 if(!el('view-admin').hidden){
  var tab=document.querySelector('[data-admintab].on');
  profielHerkomst={view:'admin',tab:tab?tab.getAttribute('data-admintab'):null};
 }else{
  profielHerkomst=null;
 }
}
function naarHerkomst(){
 var h=profielHerkomst;profielHerkomst=null;
 if(h&&h.view==='admin'){
  showView('admin');
  if(h.tab)kiesAdmintab(h.tab);
  window.scrollTo(0,0);
  return;
 }
 show('pp-formulier');
}
function openProfielClient(id){
 var p=findPerson(id);if(!p)return;
 legHerkomstVast(id);
 huidigProfielId=id;
 el('pc-titel').textContent=naam(p)+' — volledig profiel';
 setGrootAvatar('pc-foto',p);
 el('pc-voornaam').value=p.voor;el('pc-achternaam').value=p.achter;el('pc-mail').value=p.mail||'';el('pc-tel').value=p.tel||'';
 toonNaamFout('pc',null,null);
 toonMailFout('pc-mail','pc-mail-fout','');
 mailAuto.pc=!p.mail||p.mail===genereerEmail(p.voor,p.achter);
 toonToestemming(p);
 renderGroepenKeuze(p,'pc-groepen-keuze','pc-groepen-hint');
 el('pc-vertegenwoordiger').innerHTML=vertegenwoordigerOpties(p);
 el('pc-rechten').innerHTML=personRechtenRow(id);
 wirePersoonRechten(el('pc-rechten'),function(){updateTally();renderAcc('medewerker');renderAcc('naaste');});
 var magVertOk=magContactWijzigen();
 el('pc-vertegenwoordiger').disabled=!magVertOk;
 el('pc-vertegenwoordiger-hint').textContent=magVertOk?'':'Alleen de huidige contactpersoon kan de wettelijke vertegenwoordiger wijzigen.';
 show('pp-profiel-client');
}
el('pc-opslaan').addEventListener('click',function(){
 var p=findPerson(huidigProfielId);if(!p)return;
 var voor=el('pc-voornaam').value.trim(),achter=el('pc-achternaam').value.trim(),ok=true;
 if(!toonNaamFout('pc',voor,achter))ok=false;
 var ingevuldeMail=el('pc-mail').value.trim();
 if(!toonMailFout('pc-mail','pc-mail-fout',mailFout(ingevuldeMail,p.id)))ok=false;
 if(!ok)return;
 var dubbelC=naamgenootInGroep(p,voor,achter);
 p.voor=kap(cap(voor),MAXLEN.naam);p.achter=kap(cap(achter),MAXLEN.naam);
 p.mail=kap(ingevuldeMail||genereerEmail(p.voor,p.achter),MAXLEN.mail);
 p.tel=kap(el('pc-tel').value.trim(),MAXLEN.tel);
 var oudT=toestemmingVan(p);
 var nieuwT={foto:el('pc-toestemming-foto').checked,media:el('pc-toestemming-media').checked,chat:el('pc-toestemming-chat').checked};
 var veranderd=['foto','media','chat'].some(function(k){return !!oudT[k]!==nieuwT[k];});
 if(veranderd){
  nieuwT.vastgelegdOp=vandaagISO();
  nieuwT.door=wieBenIk();
  p.toestemming=nieuwT;
  var aan=['foto','media','chat'].filter(function(k){return nieuwT[k];});
  logActie('Toestemming van '+naam(p)+' vastgelegd: '+(aan.length?aan.join(', '):'niets toegestaan'));
 }else if(p.toestemming){
  p.toestemming.foto=nieuwT.foto;p.toestemming.media=nieuwT.media;p.toestemming.chat=nieuwT.chat;
 }
 if(magContactWijzigen()){
  var nieuweVert=el('pc-vertegenwoordiger').value?+el('pc-vertegenwoordiger').value:null;
  if(nieuweVert!==(p.wettelijkeVertegenwoordiger||null)){
   var vertPersoon=nieuweVert?findPerson(nieuweVert):null;
   logActie('Wettelijk vertegenwoordiger van '+naam(p)+' '+(vertPersoon?('gezet op '+naam(vertPersoon)):'verwijderd'));
  }
  p.wettelijkeVertegenwoordiger=nieuweVert;
 }
 if(p._state!=='nieuw')p._state='gewijzigd';
 renderAcc('client');updateTally();
 if(dubbelC)naamgenootMelding(dubbelC,p); else naarHerkomst();
});
function openFotoModal(elId,persoon){
 var p=persoon||findPerson(huidigProfielId);if(!p)return;
 var voorbeeldStyle=veiligeFotoUrl(p.foto)?('background-image:'+cssUrl(p.foto)+';background-size:cover;background-position:center'):('background:'+avatarGradient(naam(p)));
 var nieuweFoto=p.foto||null;
 openModal('<h3>Profielfoto wijzigen</h3>'+
  '<div class="msec" style="display:flex;flex-direction:column;align-items:center;gap:14px">'+
  '<div class="hubavatar" id="foto-preview" style="width:88px;height:88px;flex:0 0 88px;'+voorbeeldStyle+'"></div>'+
  '<input type="file" accept="image/*" id="foto-input" style="display:none">'+
  '<div style="display:flex;gap:16px;align-items:center">'+
  '<button type="button" class="small" id="foto-kiezen">Kies een foto…</button>'+
  (p.foto?'<button type="button" class="removelink" id="foto-verwijderen">Verwijderen</button>':'')+
  '</div>'+
  '<p class="mini" style="text-align:center;margin:0">JPG of PNG.</p>'+
  '</div>'+
  '<div class="modal-actions"><button type="button" id="foto-annuleren">Annuleren</button><button type="button" class="primary" id="foto-opslaan">Opslaan</button></div>');
 el('foto-kiezen').addEventListener('click',function(){el('foto-input').click();});
 el('foto-input').addEventListener('change',function(e){
  var file=e.target.files[0];if(!file)return;
  /* accept="image/*" is alleen een filter in het keuzevenster en zegt niets over
     wat er echt gekozen is. Zonder controle belandt een bestand van tientallen
     MB's als base64 in het geheugen én in de database, bij elke synchronisatie
     opnieuw. Vandaar een echte type- en groottecontrole. */
  if(FOTO_TYPES.indexOf(file.type)<0){
   alert('Kies een JPG-, PNG- of WebP-bestand.');
   e.target.value='';return;
  }
  if(file.size>FOTO_MAX_BYTES){
   alert('Deze foto is te groot ('+Math.round(file.size/1048576)+' MB). Kies er een van maximaal '+(FOTO_MAX_BYTES/1048576)+' MB.');
   e.target.value='';return;
  }
  var reader=new FileReader();
  reader.onerror=function(){alert('Het lezen van dit bestand is niet gelukt.');};
  reader.onload=function(ev){
   if(!veiligeFotoUrl(ev.target.result)){alert('Dit bestand wordt niet herkend als afbeelding.');return;}
   nieuweFoto=ev.target.result;
   zetFotoAchtergrond(el('foto-preview'),nieuweFoto);
  };
  reader.readAsDataURL(file);
 });
 var verwijderBtn=el('foto-verwijderen');
 if(verwijderBtn)verwijderBtn.addEventListener('click',function(){
  nieuweFoto=null;
  el('foto-preview').style.backgroundImage='';
  el('foto-preview').style.background=avatarGradient(naam(p));
 });
 el('foto-annuleren').addEventListener('click',closeModal);
 el('foto-opslaan').addEventListener('click',function(){
  var was=p.foto||null;
  p.foto=nieuweFoto;
  setGrootAvatar(elId,p);
  closeModal();
  if(was===(nieuweFoto||null))return;
  /* Dit venster wordt ook gebruikt voor "Mijn profiel" in de clientapp, en dat
     is geen persoon uit de lijst: die heeft geen type, waardoor renderAcc op
     een niet-bestaande teller uitkwam en de handler halverwege afbrak. */
  var isPersoon=people.indexOf(p)>-1;
  if(isPersoon){
   /* Een foto wijzigen ging meteen naar de database, zonder logregel en zonder
      mee te tellen als wijziging — terwijl elke andere aanpassing wacht op
      "doorvoeren". Bij een foto van een cliënt wil je juist kunnen zien wie hem
      erop heeft gezet. */
   if(p._state!=='nieuw')p._state='gewijzigd';
   logActie(nieuweFoto?('Profielfoto van '+naam(p)+' gewijzigd'):('Profielfoto van '+naam(p)+' verwijderd'));
   renderAcc(p.type);
   updateTally();
  }else{
   /* Mijn profiel: de foto hoort ook bij het account zelf. */
   if(typeof zetProfielOpAccount==='function')zetProfielOpAccount();
  }
 });
}
el('pc-foto-wijzigen').addEventListener('click',function(){openFotoModal('pc-foto');});

/* --- Volledig profiel: medewerker / naaste --- */
/* Het datamodel kende al meerdere groepen per persoon (p.groepen), maar er was
   nergens een manier om die te wijzigen. Hiermee kun je iemand koppelen aan een
   extra groep of juist verplaatsen door de oude uit te vinken. */
function renderGroepenKeuze(p,keuzeId,hintId){
 var meervoud=(p.groepen||[]).length>1;
 el(keuzeId).innerHTML=GROEPEN.map(function(g){
  var aan=(p.groepen||[]).indexOf(g)>-1;
  return '<label class="chip'+(aan?' on':'')+'"><input type="checkbox" data-pgroep="'+esc(g)+'" '+(aan?'checked':'')+'>'+esc(g)+(g===huidigeGroep?' (huidig)':'')+'</label>';
 }).join('');
 el(hintId).textContent=meervoud
  ? 'Werkt in meerdere groepen. Vink een groep uit om daar weg te halen.'
  : 'Vink aan bij welke groepen deze persoon hoort.';
 Array.prototype.forEach.call(el(keuzeId).querySelectorAll('[data-pgroep]'),function(c){
  c.addEventListener('change',function(){
   var g=c.getAttribute('data-pgroep');
   if(c.checked){
    if(p.groepen.indexOf(g)<0)p.groepen.push(g);
   }else{
    if(p.groepen.length<=1){alert('Iemand moet aan minimaal één groep gekoppeld blijven.');c.checked=true;return;}
    /* Ook hier geldt: hij blijft elders bestaan. Het vinkje gaat pas uit als je
       die uitleg hebt gezien, anders springt het terug. */
    c.checked=true;
    bevestigModal('Loskoppelen van '+g,
     '<p>'+esc(naam(p))+' blijft in <b>'+
     p.groepen.filter(function(x){return x!==g;}).map(esc).join('</b>, <b>')+'</b>.</p>'+
     '<p>Alle toegang binnen '+esc(g)+' vervalt. Opnieuw koppelen zet die niet terug.</p>',
     'Ja, loskoppelen van '+g,function(){
      p.groepen=p.groepen.filter(function(x){return x!==g;});
      ruimRechtenZonderGedeeldeGroepOp(p);
      if(p._state!=='nieuw')p._state='gewijzigd';
      renderGroepenKeuze(p,keuzeId,hintId);updateTally();renderAll();
     });
    return;
   }
   if(p._state!=='nieuw')p._state='gewijzigd';
   renderGroepenKeuze(p,keuzeId,hintId);updateTally();
  });
 });
}
function zetContactBlok(p,t){
 var toon=t==='medewerker';
 el('pp-lbl-contact').hidden=!toon;
 el('pp-contact-blok').hidden=!toon;
 if(!toon)return;
 var magWijzigen=magContactWijzigen();
 el('pp-contactpersoon').checked=!!p.contactpersoon;
 el('pp-contactpersoon').disabled=!magWijzigen;
 if(el('pp-ziek-row')){
  el('pp-ziek-row').hidden=!p.contactVolgorde;
  el('pp-ziek').checked=p.status==='ziek';
  el('pp-ziek').disabled=!magWijzigen;
 }
 el('pp-contact-hint').textContent=magWijzigen?(p.contactVolgorde?('Dit is contactpersoon '+p.contactVolgorde+' van deze groep.'):''):'Alleen de huidige contactpersoon kan dit wijzigen.';
 el('pp-contactpersoon').onchange=function(){
  var ok=pasContactpersoonToe(p,this.checked);
  if(!ok)this.checked=false;
  zetContactBlok(p,t);renderContactpersonen();renderContactBanner();
 };
 if(el('pp-ziek'))el('pp-ziek').onchange=function(){
  p.status=this.checked?'ziek':'actief';
  if(p._state!=='nieuw')p._state='gewijzigd';
  renderContactBanner();
 };
}
/* De hint vertelt wat de ingevulde datum betekent: al verlopen, bijna verlopen
   of nog ruim geldig. Anders moet je zelf gaan rekenen. */
function toonToegangHint(p){
 var hint=el('pp-toegang-hint');if(!hint)return;
 var standaard='Leeg laten bij vaste medewerkers. Vul een datum in bij een invaller of stagiair; daarna stopt de toegang vanzelf.';
 var veld=el('pp-toegang-tot');
 var datum=veld?veld.value:'';
 if(!geldigeDatum(datum)){hint.textContent=standaard;hint.style.color='';return;}
 var dagen=dagenTotVerloop({toegangTot:datum});
 if(dagen<0){hint.textContent='Verlopen op '+datumNL(datum)+'. '+naam(p)+' kan niet meer inloggen.';hint.style.color='var(--brick)';}
 else if(dagen===0){hint.textContent='Vandaag is de laatste dag. Morgen vervalt de toegang.';hint.style.color='var(--amber)';}
 else if(dagen<=14){hint.textContent='Nog '+dagen+' dag'+(dagen===1?'':'en') +' toegang, tot en met '+datumNL(datum)+'.';hint.style.color='var(--amber)';}
 else {hint.textContent='Toegang tot en met '+datumNL(datum)+' ('+dagen+' dagen).';hint.style.color='';}
}
/* Rolvelden in het profiel. Heeft de groep voor een categorie optionele rollen,
   dan kies je hier welke rol deze persoon krijgt; anders is er niets te kiezen
   en blijft het een vast veld. De keuze telt pas bij Opslaan, zodat Annuleren
   hem net als de andere velden weggooit. */
var PROFIEL_ROLVELDEN={
 medewerker:[['globaal','pp-globaal-display'],['groep','pp-groepsrol-display'],['locatie','pp-locatierol-display']],
 naaste:[['globaal','pp-globaal-display'],['groep','pp-groepsrol-display'],['clienten','pp-clientrol-display']]
};
function toonProfielRollen(p,t){
 var groep=basisGroepVan(p),kiesbaar=0;
 el('pp-locatierol-veld').hidden=t!=='medewerker';
 el('pp-clientrol-veld').hidden=t!=='naaste';
 el('pp-client-veld').hidden=t!=='naaste';
 if(t==='naaste'){
  var clienten=Object.keys(p.clientRechten||{}).map(function(id){return findPerson(+id);})
   .filter(function(c){return c&&!c.archived&&c._state!=='verwijderd';});
  el('pp-client-display').textContent=clienten.length?clienten.map(naam).join(', '):'Nog niet gekoppeld';
 }
 (PROFIEL_ROLVELDEN[t]||[]).forEach(function(v){
  var k=v[0],vak=el(v[1]),keuzes=rolKeuzes(groep,t,k),huidig=rolVan(p,k);
  if(keuzes.length>1){
   kiesbaar++;
   vak.className='';
   vak.innerHTML='<select data-rolkeuze="'+k+'" aria-label="Rol kiezen">'+keuzes.map(function(r,i){
    return '<option value="'+esc(r)+'"'+(r===huidig?' selected':'')+'>'+esc(r)+(i===0?' (standaard)':'')+'</option>';
   }).join('')+'</select>';
  }else{
   vak.className='lockedfield';
   vak.textContent=k==='globaal'?globaleRolVoor(p):huidig;
  }
 });
 el('pp-rollen-hint').textContent=kiesbaar
  ?'Waar een keuzemenu staat, heeft de groep meer rollen. Kies welke rol deze persoon krijgt.'
  :'Deze rollen komen uit de instellingen van de groep.';
}
/* Leest de gekozen rollen uit het profiel. Een keuze gelijk aan de standaard
   wordt niet bewaard, zodat de persoon meebeweegt als de groep zijn standaard
   later wijzigt. Geeft de lijst gewijzigde categorieën terug. */
function leesProfielRollen(p){
 var nieuw=JSON.parse(JSON.stringify(p.rollen||{})),gewijzigd=[];
 Array.prototype.forEach.call(document.querySelectorAll('#pp-profiel-persoon [data-rolkeuze]'),function(sel){
  var k=sel.getAttribute('data-rolkeuze'),standaard=rolKeuzes(basisGroepVan(p),p.type,k)[0];
  if(sel.value===rolVan(p,k))return;
  if(sel.value===standaard)delete nieuw[k]; else nieuw[k]=sel.value;
  gewijzigd.push({k:k,rol:sel.value});
 });
 return {rollen:nieuw,gewijzigd:gewijzigd};
}
var ROLCATEGORIE_LABEL={globaal:'algemene rol',groep:'groepsrol',locatie:'locatierol',clienten:'rol bij cliënt'};
/* Wat je in het profiel hebt ingetikt maar nog niet hebt opgeslagen. Het profiel
   wordt na elke rechtenwijziging opnieuw opgebouwd (bijvoorbeeld na het kiezen
   van een collega bij Rechten overnemen); zonder dit sprong je terug naar boven
   en stonden de velden weer op de oude waarden, wat voelde als een herladen
   pagina waarin je werk verdwenen was. */
function leesProfielConcept(){
 var c={scroll:window.scrollY,velden:{},rollen:{}};
 ['pp-voornaam','pp-achternaam','pp-mail','pp-tel','pp-toegang-tot'].forEach(function(i){c.velden[i]=el(i).value;});
 Array.prototype.forEach.call(document.querySelectorAll('#pp-profiel-persoon [data-rolkeuze]'),function(sel){c.rollen[sel.getAttribute('data-rolkeuze')]=sel.value;});
 return c;
}
function zetProfielConceptTerug(c,p){
 Object.keys(c.velden).forEach(function(i){el(i).value=c.velden[i];});
 Array.prototype.forEach.call(document.querySelectorAll('#pp-profiel-persoon [data-rolkeuze]'),function(sel){
  var k=sel.getAttribute('data-rolkeuze');
  if(c.rollen[k]&&Array.prototype.some.call(sel.options,function(o){return o.value===c.rollen[k];}))sel.value=c.rollen[k];
 });
 toonToegangHint(p);
 window.scrollTo(0,c.scroll);
}
function openProfielPersoon(id,t){
 var p=findPerson(id);if(!p)return;
 var zelfdeProfiel=huidigProfielId===id&&!el('pp-profiel-persoon').hidden;
 var concept=zelfdeProfiel?leesProfielConcept():null;
 if(!zelfdeProfiel)legHerkomstVast(id);
 huidigProfielId=id;
 el('pp-titel').textContent=naam(p)+' — volledig profiel';
 setGrootAvatar('pp-foto',p);
 el('pp-voornaam').value=p.voor;el('pp-achternaam').value=p.achter;el('pp-mail').value=p.mail||'';el('pp-tel').value=p.tel||'';
 el('pp-toegang-tot').value=geldigeDatum(p.toegangTot)?p.toegangTot:'';
 toonToegangHint(p);
 toonBlokkadeKnop(p);
 toonTweestapsStatus(p);
 toonNaamFout('pp',null,null);
 toonMailFout('pp-mail','pp-mail-fout','');
 el('pp-typerol-display').textContent=t==='medewerker'?'Medewerker':'Naaste';
 el('pp-groep-display').textContent=huidigeGroep;
 toonProfielRollen(p,t);
 el('pp-clienten').innerHTML=clientRechtenRow(p,t);
 /* Na één rechtenwijziging niet het hele profiel opnieuw opbouwen: het
    keuzemenu toont de nieuwe waarde al. Bij een grote groep (1.200 cliënten)
    kostte dat herbouwen ruim een seconde per keuze (gemeten). */
 var naRecht=function(){updateTally();};
 wireClientRechten(el('pp-clienten'),t,naRecht);
 if(t==='medewerker'){
  el('pp-lbl-medewerkers').textContent='Recht op medewerkers';
  el('pp-medewerkers').innerHTML=medewerkerPeerRow(p);
  wireMedewerkerPeerRechten(el('pp-medewerkers'),naRecht);
  el('pp-lbl-naasten').textContent='Naasten';
  el('pp-naasten').innerHTML=naasteRechtenRow(p);
  wireNaasteRechten(el('pp-naasten'),naRecht);
 }else{
  el('pp-lbl-medewerkers').textContent='Medewerkers met recht op deze naaste';
  el('pp-medewerkers').innerHTML=medewerkerRechtenRow(p.id);
  wireMedewerkerRechten(el('pp-medewerkers'),naRecht);
 }
 ['pp-lbl-medewerkers'].forEach(function(id2){el(id2).hidden=false;});
 el('pp-lbl-naasten').hidden=(t==='naaste');
 renderGroepenKeuze(p,'pp-groepen-keuze','pp-groepen-hint');
 zetContactBlok(p,t);
 var nieuw=p._state==='nieuw';
 if(el('pp-blokkeer'))el('pp-blokkeer').hidden=nieuw;
 el('pp-verwijder').hidden=nieuw;
 /* Inzage (AVG) laat zien wat er over iemand is vastgelegd; bij een nieuwe
    persoon is er nog niets, dus de knop hoort alleen bij bewerken. */
 el('pp-avg-inzage').hidden=nieuw;
 /* .actions heeft een eigen display; hidden werkt daar niet, dus via style. */
 el('pp-accountacties').style.display=nieuw?'none':'';
 if(nieuw)el('pp-blokkade-uitleg').hidden=true;
 el('pp-titel').textContent=nieuw?('Nieuwe '+TYPELABEL[t].toLowerCase()+' aanmaken'):(naam(p)+' — volledig profiel');
 show('pp-profiel-persoon');
 if(concept)zetProfielConceptTerug(concept,p);
}
el('pp-persoon-opslaan').addEventListener('click',function(){
 var p=findPerson(huidigProfielId);if(!p)return;
 var voor=el('pp-voornaam').value.trim(),achter=el('pp-achternaam').value.trim(),ok=true;
 if(!toonNaamFout('pp',voor,achter))ok=false;
 var ingevuldeMail=el('pp-mail').value.trim();
 /* Medewerkers en naasten loggen in met hun e-mailadres; zonder adres is er
    een account waar niemand mee kan inloggen. (Bij cliënten wordt het adres
    zo nodig gegenereerd, dus daar blijft het optioneel.) */
 if(!toonMailFout('pp-mail','pp-mail-fout',ingevuldeMail?mailFout(ingevuldeMail,p.id):'Vul een e-mailadres in.'))ok=false;
 if(!ok)return;
 var dubbelP=naamgenootInGroep(p,voor,achter);
 p.voor=kap(cap(voor),MAXLEN.naam);p.achter=kap(cap(achter),MAXLEN.naam);
 p.mail=kap(ingevuldeMail,MAXLEN.mail);
 p.tel=kap(el('pp-tel').value.trim(),MAXLEN.tel);
 var datum=el('pp-toegang-tot').value;
 var oudeDatum=p.toegangTot||'';
 if(geldigeDatum(datum))p.toegangTot=datum; else delete p.toegangTot;
 if((p.toegangTot||'')!==oudeDatum){
  logActie(p.toegangTot
   ? naam(p)+' heeft toegang tot en met '+datumNL(p.toegangTot)
   : naam(p)+' heeft weer toegang zonder einddatum');
 }
 var rolKeuze=leesProfielRollen(p);
 if(rolKeuze.gewijzigd.length){
  if(Object.keys(rolKeuze.rollen).length)p.rollen=rolKeuze.rollen; else delete p.rollen;
  p.rol=globaleRolVoor(p);
  rolKeuze.gewijzigd.forEach(function(g){logActie(naam(p)+': '+ROLCATEGORIE_LABEL[g.k]+' gewijzigd naar "'+g.rol+'"');});
 }
 if(p._state!=='nieuw')p._state='gewijzigd';
 renderAll();
 if(dubbelP)naamgenootMelding(dubbelP,p); else naarHerkomst();
});
/* Annuleren gooide ingevulde gegevens zonder waarschuwing weg. Bij een nieuw
   aangemaakte persoon is dat extra vervelend: die verdwijnt dan half ingevuld
   in de lijst. */
function profielGewijzigd(p,prefix){
 if(!p)return false;
 var v=el(prefix+'-voornaam').value.trim(),a=el(prefix+'-achternaam').value.trim();
 if(prefix==='pp'&&leesProfielRollen(p).gewijzigd.length)return true;
 return cap(v)!==p.voor||cap(a)!==p.achter||
  el(prefix+'-mail').value.trim()!==(p.mail||'')||
  el(prefix+'-tel').value.trim()!==(p.tel||'')||
  (el(prefix+'-toegang-tot')?el(prefix+'-toegang-tot').value!==(p.toegangTot||''):false);
}
function naamgenootMelding(bestaande,nieuwe){
 openModal('<h3>Let op: dezelfde naam bestaat al</h3><div class="msec"><p>Er staat al een '+
  esc(TYPELABEL[bestaande.type].toLowerCase())+' met de naam <b>'+esc(naam(bestaande))+'</b> in deze groep'+
  (bestaande.mail?' ('+esc(bestaande.mail)+')':'')+'.</p>'+
  '<p>De wijziging is opgeslagen. Controleer of je niet per ongeluk twee keer dezelfde persoon hebt aangemaakt — verwisseling is in de zorg een reëel risico.</p></div>'+
  '<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Begrepen</button></div>');
 el('modal-snap').addEventListener('click',function(){closeModal();naarHerkomst();});
}
/* doel: het scherm waar de terugpijl of kruimel naartoe wil. Zonder doel
   (de knop Annuleren) gaat het terug naar waar het profiel vandaan kwam. */
function annuleerProfiel(prefix,doel){
 var ga=function(){if(doel){profielHerkomst=null;show(doel);}else naarHerkomst();};
 var p=findPerson(huidigProfielId);
 var nieuwEnLeeg=p&&p._state==='nieuw';
 if(p&&(profielGewijzigd(p,prefix)||nieuwEnLeeg)){
  openModal('<h3>Wijzigingen niet opgeslagen</h3><div class="msec"><p>'+
   (nieuwEnLeeg?'Deze persoon is nog niet opgeslagen. Als je nu teruggaat, wordt hij niet aangemaakt.'
              :'Je hebt gegevens aangepast die nog niet zijn opgeslagen. Als je nu teruggaat, gaan ze verloren.')+
   '</p></div><div class="modal-actions"><button type="button" id="modal-blijf">Blijf hier</button><button type="button" class="danger" id="modal-weg">Toch teruggaan</button></div>');
  el('modal-blijf').addEventListener('click',closeModal);
  el('modal-weg').addEventListener('click',function(){
   if(nieuwEnLeeg&&!p.voor&&!p.achter){people=people.filter(function(x){return x.id!==p.id;});}
   closeModal();renderAll();ga();
  });
  return;
 }
 ga();
}
el('pc-annuleren').addEventListener('click',function(){annuleerProfiel('pc');});
el('pp-annuleren').addEventListener('click',function(){annuleerProfiel('pp');});

['pc-voornaam','pc-achternaam','pp-voornaam','pp-achternaam'].forEach(function(i){el(i).addEventListener('input',function(){
 if(!this.value.trim())return;
 this.style.borderColor='';el(i+'-fout').hidden=true;
});});
[['pc-mail','pc-mail-fout'],['pp-mail','pp-mail-fout']].forEach(function(paar){
 el(paar[0]).addEventListener('input',function(){toonMailFout(paar[0],paar[1],'');});
});
var mailAuto={pc:true};
['pc'].forEach(function(prefix){
 el(prefix+'-voornaam').addEventListener('input',function(){
  if(mailAuto[prefix])el(prefix+'-mail').value=genereerEmail(el(prefix+'-voornaam').value,el(prefix+'-achternaam').value);
 });
 el(prefix+'-achternaam').addEventListener('input',function(){
  if(mailAuto[prefix])el(prefix+'-mail').value=genereerEmail(el(prefix+'-voornaam').value,el(prefix+'-achternaam').value);
 });
 el(prefix+'-mail').addEventListener('input',function(){mailAuto[prefix]=(this.value.trim()==='');});
});
el('pp-foto-wijzigen').addEventListener('click',function(){openFotoModal('pp-foto');});
/* ---- Rechten overnemen van een collega ----
   Een nieuwe medewerker krijgt in de praktijk dezelfde toegang als iemand die
   hetzelfde werk doet. Dat vakje voor vakje overtikken kost tijd en gaat mis;
   dit kopieert alleen wat binnen de huidige groep geldt. */
function rechtenBronnen(p){
 return personenVanType(p.type).filter(function(x){
  return x.id!==p.id&&!x.archived&&x._state!=='verwijderd';
 });
}
function telRechtenInGroep(bron,type){
 var clienten=personenVanType('client'),n=0;
 clienten.forEach(function(c){if((bron.clientRechten||{})[c.id])n++;});
 if(type==='medewerker'){
  personenVanType('medewerker').forEach(function(m){if((bron.medewerkerRechten||{})[m.id])n++;});
  personenVanType('naaste').forEach(function(x){if((bron.naasteRechten||{})[x.id])n++;});
 }
 return n;
}
/* Alleen de mensen die in deze groep zitten worden overgenomen. Rechten van de
   bron in een andere groep gaan niet mee: daar hoort de ontvanger misschien
   niet eens bij. */
function neemRechtenOver(doel,bron){
 var gewijzigd=0;
 var kopieer=function(veld,lijst){
  doel[veld]=doel[veld]||{};
  lijst.forEach(function(ander){
   if(ander.id===doel.id)return;
   var nieuw=(bron[veld]||{})[ander.id]||null;
   var oud=doel[veld][ander.id]||null;
   if(nieuw===oud)return;
   if(nieuw)doel[veld][ander.id]=nieuw; else delete doel[veld][ander.id];
   gewijzigd++;
  });
 };
 kopieer('clientRechten',personenVanType('client'));
 if(doel.type==='medewerker'){
  kopieer('medewerkerRechten',personenVanType('medewerker'));
  kopieer('naasteRechten',personenVanType('naaste'));
 }
 if(gewijzigd&&doel._state!=='nieuw')doel._state='gewijzigd';
 return gewijzigd;
}
/* Wat er concreet verandert als doel de rechten van bron overneemt: de rechten
   die erbij komen of anders worden, en de rechten die vervallen. Dezelfde
   lijsten als neemRechtenOver, zodat het overzicht niet kan afwijken van wat
   er daarna echt gebeurt. */
function rechtenVerschil(doel,bron){
 var krijgt=[],vervalt=[];
 var vergelijk=function(veld,lijst,soort){
  lijst.forEach(function(ander){
   if(ander.id===doel.id)return;
   var nieuw=(bron[veld]||{})[ander.id]||null,oud=(doel[veld]||{})[ander.id]||null;
   if(nieuw)krijgt.push({naam:naam(ander),soort:soort,rol:nieuw,zelfde:nieuw===oud});
   else if(oud)vervalt.push({naam:naam(ander),soort:soort,rol:oud});
  });
 };
 vergelijk('clientRechten',personenVanType('client'),'cliënt');
 if(doel.type==='medewerker'){
  vergelijk('medewerkerRechten',personenVanType('medewerker'),'medewerker');
  vergelijk('naasteRechten',personenVanType('naaste'),'naaste');
 }
 return {krijgt:krijgt,vervalt:vervalt};
}
var OVERZICHT_KORT=4;
function rechtenOverzichtHtml(doel,bron,uitgeklapt){
 var v=rechtenVerschil(doel,bron);
 if(!v.krijgt.length&&!v.vervalt.length)return '<p class="mini" style="margin:0">'+esc(naam(bron))+' heeft in '+esc(huidigeGroep)+' geen rechten. Overnemen haalt dus niets weg en voegt niets toe.</p>';
 var regels=v.krijgt.map(function(r){return '<li>'+esc(r.naam)+' <span class="mini">('+esc(r.soort)+')</span> — '+esc(r.rol)+(r.zelfde?' <span class="mini">(had al)</span>':'')+'</li>';})
  .concat(v.vervalt.map(function(r){return '<li class="vervalt">'+esc(r.naam)+' <span class="mini">('+esc(r.soort)+')</span> — vervalt</li>';}));
 var zichtbaar=uitgeklapt?regels:regels.slice(0,OVERZICHT_KORT);
 var rest=regels.length-zichtbaar.length;
 return '<b style="font-size:13px">'+esc(naam(doel))+' krijgt '+v.krijgt.length+' recht'+(v.krijgt.length===1?'':'en')+
  (v.vervalt.length?', '+v.vervalt.length+' vervalt':'')+'</b><ul>'+zichtbaar.join('')+'</ul>'+
  (regels.length>OVERZICHT_KORT?'<button type="button" class="ghost small" id="modal-toonmeer">'+(uitgeklapt?'Toon minder':'Toon meer ('+rest+')')+'</button>':'');
}
function openRechtenOvernemen(){
 var doel=findPerson(huidigProfielId);
 if(!doel)return;
 var bronnen=rechtenBronnen(doel);
 if(!bronnen.length){
  openMelding('Geen collega beschikbaar','Er is in deze groep niemand anders van hetzelfde type om rechten van over te nemen.');
  return;
 }
 /* Het profiel eronder wordt bij het kiezen van een collega niet opnieuw
    opgebouwd: alleen het overzicht in dit venster verandert. Zo blijft wat je
    in het profiel al had ingevuld gewoon staan. */
 var concept=leesProfielConcept();
 openModal('<h3>Rechten overnemen van een collega</h3><div class="msec">'+
  '<p>Kies een collega die hetzelfde werk doet. <b>'+esc(naam(doel))+'</b> krijgt dan in <b>'+esc(huidigeGroep)+'</b> precies dezelfde rechten als die collega.</p>'+
  '<p class="mini">Rechten die de collega niet heeft, vervallen ook bij '+esc(naam(doel))+'. Andere groepen blijven zoals ze zijn.</p></div>'+
  '<fieldset class="admblok"><legend>Collega</legend><div class="admveld"><label for="modal-bron-zoek">Overnemen van<span class="verplicht">*</span></label>'+
  zoekKeuzeHtml('modal-bron','Typ de naam van een collega…')+'</div>'+
  '<div class="overzicht-rechten" id="modal-overzicht" aria-live="polite"></div></fieldset>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="modal-opslaan">Rechten overnemen</button></div>');
 var uitgeklapt=false,bronKeuze=null;
 function toonOverzicht(){
  var bron=bronKeuze&&bronKeuze.waarde()!==null?findPerson(bronKeuze.waarde()):null;
  el('modal-opslaan').disabled=!bron;
  el('modal-overzicht').innerHTML=bron?rechtenOverzichtHtml(doel,bron,uitgeklapt):'<p class="mini" style="margin:0">Kies een collega om te zien wat er verandert.</p>';
  var knop=el('modal-toonmeer');
  if(knop)knop.addEventListener('click',function(){uitgeklapt=!uitgeklapt;toonOverzicht();});
 }
 bronKeuze=koppelZoekKeuze('modal-bron',bronnen.map(function(b){
  var n=telRechtenInGroep(b,doel.type);
  return {waarde:b.id,label:naam(b),detail:(b.mail||'geen e-mailadres')+' · '+n+' recht'+(n===1?'':'en')+' in deze groep'};
 }),{leegTekst:'Geen collega met deze naam.',naKeuze:function(){uitgeklapt=false;toonOverzicht();}});
 toonOverzicht();
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var bron=bronKeuze.waarde()!==null?findPerson(bronKeuze.waarde()):null;
  if(!bron)return;
  var aantal=neemRechtenOver(doel,bron);
  closeModal();
  if(aantal){
   logActie(naam(doel)+' nam de rechten van '+naam(bron)+' over in '+huidigeGroep+' ('+aantal+' wijziging'+(aantal===1?'':'en')+')');
   syncToSupabase();
  }
  renderAll();
  openProfielPersoon(doel.id,doel.type);
  zetProfielConceptTerug(concept,doel);
  openMelding(aantal?'Rechten overgenomen':'Niets te wijzigen',
   aantal? naam(doel)+' heeft nu dezelfde rechten als '+naam(bron)+' in '+huidigeGroep+'. Er zijn '+aantal+' recht(en) aangepast.'
         : naam(doel)+' had al precies dezelfde rechten als '+naam(bron)+'.');
 });
}
el('pp-rechten-overnemen').addEventListener('click',openRechtenOvernemen);
el('pp-avg-inzage').addEventListener('click',function(){openAvgDossier(huidigProfielId);});

/* Blokkeren trekt de toegang per direct in zonder iets te wissen. Bij een
   vermoeden van misbruik is dat de eerste stap: gegevens moeten blijven staan
   om te kunnen uitzoeken wat er is gebeurd. */
/* Een account zonder tweede stap is met alleen een uitgelekt wachtwoord te
   misbruiken. Of dat erg is hangt af van wat de groep vereist, dus dat staat
   erbij. Aanzetten doet de persoon zelf in zijn eigen app; hier alleen tonen. */
function toonTweestapsStatus(p){
 var e=el('pp-tweestaps-status');if(!e)return;
 var vereist=(p.groepen||[]).filter(eistTweestaps);
 if(p.tweestaps){
  e.textContent='Tweestapsverificatie staat aan'+(p.tweestapsDatum?' sinds '+datumNL(p.tweestapsDatum):'')+'.';
  e.style.color='var(--moss)';
 }else if(vereist.length){
  e.textContent='Tweestapsverificatie staat uit, maar is verplicht in '+vereist.join(' en ')+'. Deze persoon moet dat zelf aanzetten in de app.';
  e.style.color='var(--brick)';
 }else{
  e.textContent='Tweestapsverificatie staat uit. Deze groep stelt dat niet verplicht.';
  e.style.color='var(--ink-soft)';
 }
}
function toonBlokkadeKnop(p){
 var knop=el('pp-blokkeer'),uitleg=el('pp-blokkade-uitleg');
 /* De knop kan weg zijn (op verzoek); de uitleg bij een bestaande blokkade
    moet dan juist blijven staan, anders zie je niet waarom iemand niet kan
    inloggen. */
 if(knop){
  knop.textContent=p.geblokkeerd?'Blokkade opheffen':'Toegang blokkeren';
  knop.classList.toggle('danger',!p.geblokkeerd);
 }
 uitleg.hidden=!p.geblokkeerd;
 if(p.geblokkeerd){
  uitleg.style.color='var(--brick)';
  uitleg.textContent='Geblokkeerd'+(p.geblokkeerdReden?': '+p.geblokkeerdReden:'')+'. Deze persoon kan niet inloggen en telt nergens meer als toegang. De gegevens en rechten blijven staan.';
 }
}
function wisselBlokkade(){
 var p=findPerson(huidigProfielId);if(!p)return;
 if(p.geblokkeerd){
  bevestigModal('Blokkade opheffen',
   '<p><b>'+esc(naam(p))+'</b> kan daarna weer inloggen, met dezelfde rechten als voor de blokkade.</p>'+
   (p.geblokkeerdReden?'<p>Reden van de blokkade was: '+esc(p.geblokkeerdReden)+'</p>':''),
   'Ja, blokkade opheffen',function(){
    p.geblokkeerd=false;delete p.geblokkeerdReden;
    if(p._state!=='nieuw')p._state='gewijzigd';
    logActie('Blokkade van '+naam(p)+' opgeheven',{soort:'Blokkade opgeheven'});
    syncToSupabase();
    openProfielPersoon(p.id,p.type);renderAll();
   });
  return;
 }
 openModal('<h3>Toegang blokkeren</h3><div class="msec">'+
  '<p><b>'+esc(naam(p))+'</b> kan daarna niet meer inloggen en telt nergens meer als toegang tot een cliënt.</p>'+
  '<p>De gegevens, groepen en rechten blijven staan. Gebruik dit bij een vermoeden van misbruik of een verloren telefoon: verwijderen zou het onmogelijk maken om uit te zoeken wat er is gebeurd.</p></div>'+
  '<fieldset class="admblok"><legend>Blokkade</legend>'+
  '<div class="admveld"><label for="modal-blok-reden">Reden<span class="verplicht">*</span></label>'+
  '<input class="admin" id="modal-blok-reden" maxlength="120" placeholder="Bijvoorbeeld: telefoon kwijt, uit dienst per direct"></div>'+
  '<p class="mini" style="margin:2px 0 0">De reden komt in het logboek te staan.</p></fieldset>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="danger" id="modal-bevestig">Blokkeren</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-bevestig').addEventListener('click',function(){
  var reden=kap(el('modal-blok-reden').value.trim(),120);
  p.geblokkeerd=true;
  if(reden)p.geblokkeerdReden=reden; else delete p.geblokkeerdReden;
  if(p._state!=='nieuw')p._state='gewijzigd';
  closeModal();
  logActie('Toegang van '+naam(p)+' geblokkeerd',{soort:'Blokkade',reden:reden});
  syncToSupabase();
  openProfielPersoon(p.id,p.type);renderAll();
 });
}
if(el('pp-blokkeer'))el('pp-blokkeer').addEventListener('click',wisselBlokkade);
/* Verwijderen vanuit het profiel volgt dezelfde regel als het doorvoeren:
   zit iemand ook in een andere groep, dan wordt hij alleen uit deze groep
   gehaald; is dit zijn laatste groep, dan gaat hij naar het archief. Uit het
   archief is hij terug te zetten, en de gegevens blijven de wettelijke
   bewaartermijn staan. De reden is optioneel maar komt in het logboek. */
function verwijderVanuitProfiel(){
 var p=findPerson(huidigProfielId);if(!p||p._state==='nieuw')return;
 var anderen=andereGroepenVan(p),elders=blijftElders(p)&&anderen.length;
 var uitleg=elders
  ? '<p>'+esc(naam(p))+' zit ook in <b>'+anderen.map(esc).join('</b>, <b>')+'</b> en blijft daar gewoon staan. Je haalt '+esc(naam(p))+' alleen uit <b>'+esc(huidigeGroep)+'</b>; de rechten binnen deze groep vervallen.</p>'
  : '<p><b>'+esc(huidigeGroep)+'</b> is de enige groep van '+esc(naam(p))+'. Verwijderen zet '+esc(naam(p))+' in het <b>archief</b>: inloggen kan dan niet meer, maar de gegevens blijven bewaard en '+esc(naam(p))+' is terug te zetten.</p>';
 openModal('<h3>'+(elders?'Uit deze groep halen':'Verwijderen')+'</h3><div class="msec">'+uitleg+
  '<p class="mini">Het wordt definitief bij "Wijzigingen doorvoeren".</p></div>'+
  '<fieldset class="admblok"><legend>Reden</legend><div class="admveld"><label for="modal-verwijder-reden">Reden (optioneel)</label>'+
  '<input class="admin" id="modal-verwijder-reden" maxlength="120" placeholder="Bijvoorbeeld: uit dienst, verhuisd"></div></fieldset>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="danger" id="modal-bevestig">'+(elders?'Alleen uit '+esc(huidigeGroep)+' halen':'Verwijderen')+'</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-bevestig').addEventListener('click',function(){
  var reden=kap(el('modal-verwijder-reden').value.trim(),120);
  if(reden)p._verwijderReden=reden; else delete p._verwijderReden;
  closeModal();
  markeerVerwijderd(p.id,p.type);
  logActie(elders?naam(p)+' klaargezet om los te koppelen van '+huidigeGroep:naam(p)+' klaargezet om te archiveren',{soort:'Verwijdering',reden:reden});
  renderAll();
  show('pp-formulier');
 });
}
el('pp-verwijder').addEventListener('click',verwijderVanuitProfiel);
/* De uitleg onder de datum moet meelopen terwijl je typt of kiest; anders zie je
   pas na opslaan en heropenen wat de ingevulde datum betekent. */
['input','change'].forEach(function(ev){
 el('pp-toegang-tot').addEventListener(ev,function(){
  var p=findPerson(huidigProfielId);
  if(p)toonToegangHint(p);
 });
});
/* Wie uit de groep gaat, mag nergens anders meer aan hangen: anders blijven er
   rechten en een wettelijke vertegenwoordiger staan die naar niemand meer wijzen. */
function verwijderVerwijzingenNaar(id){
 people.forEach(function(x){
  ['clientRechten','medewerkerRechten','naasteRechten'].forEach(function(veld){
   if(x[veld]&&x[veld][id]!==undefined)delete x[veld][id];
  });
  if(x.wettelijkeVertegenwoordiger===id)x.wettelijkeVertegenwoordiger=null;
 });
}
var RECHTVELDEN=['clientRechten','medewerkerRechten','naasteRechten'];
function deeltGroepMet(a,b){
 return (a.groepen||[]).some(function(g){return (b.groepen||[]).indexOf(g)>-1;});
}
/* Een recht slaat altijd op iemand binnen dezelfde groep. Wie een groep verlaat,
   hoort daar dus geen toegang meer te hebben — niet op cliënten en niet op
   collega's. Rechten op mensen met wie hij nog ergens samen zit blijven staan.
   Roep dit aan nadat de groep uit p.groepen is gehaald. */
function ruimRechtenZonderGedeeldeGroepOp(p){
 var aantal=0;
 RECHTVELDEN.forEach(function(veld){
  if(!p[veld])return;
  Object.keys(p[veld]).forEach(function(sleutel){
   var ander=findPerson(+sleutel);
   if(!ander||!deeltGroepMet(p,ander)){delete p[veld][sleutel];aantal++;}
  });
 });
 people.forEach(function(x){
  if(x.id===p.id||deeltGroepMet(p,x))return;
  RECHTVELDEN.forEach(function(veld){
   if(x[veld]&&x[veld][p.id]!==undefined){delete x[veld][p.id];aantal++;}
  });
  /* Een vertegenwoordiger die niet meer bij de cliënt in de groep zit, is geen
     vertegenwoordiger meer; anders blijft er een naam staan zonder toegang. */
  if(x.wettelijkeVertegenwoordiger===p.id){x.wettelijkeVertegenwoordiger=null;aantal++;}
 });
 if(p.wettelijkeVertegenwoordiger){
  var eigen=findPerson(p.wettelijkeVertegenwoordiger);
  if(!eigen||!deeltGroepMet(p,eigen)){p.wettelijkeVertegenwoordiger=null;aantal++;}
 }
 return aantal;
}
/* Het markeren zelf, zonder venster. Flows die al een eigen bevestiging tonen
   (bulk, de adminknoppen) gebruiken deze; anders stapelen de vensters zich op. */
function markeerVerwijderd(id,t){
 var p=findPerson(id);if(!p)return;
 if(p._state==='nieuw'){people=people.filter(function(x){return x.id!==id;});}
 else{p._state='verwijderd';}
 renderAcc(t);updateTally();renderAccountSelect();
}
function trashRow(id,t){
 var p=findPerson(id);if(!p)return;
 if(p._state==='nieuw'){markeerVerwijderd(id,t);return;}
 waarschuwOntkoppelen(p,function(){markeerVerwijderd(id,t);});
}
function renderContactpersonen(){
 var lijst=contactpersonenVanGroep();
 el('contactpersonen-lijst').innerHTML=lijst.length? lijst.map(function(m){
  return '<div class="personrow" style="box-shadow:none">'+avatarHtml(naam(m),fotoVan(m))+'<div class="pinfo"><div class="naam">'+esc(naam(m))+' <span class="mini">(contactpersoon '+m.contactVolgorde+')</span></div><div class="mail">'+esc(m.mail||'—')+'</div></div></div>';
 }).join('') : '<p class="empty-msg">Nog geen medewerkers gemarkeerd als contactpersoon.</p>';
}
function renderContactBanner(){
 var lijst=contactpersonenVanGroep(),eff=effectieveContactpersoon();
 el('contact-banner-lijst').innerHTML=lijst.length? lijst.map(function(m){
  var isEff=eff&&eff.id===m.id;
  return '<span style="display:inline-flex;align-items:center;margin:0 14px 4px 0">'+esc(naam(m))+
   (isZiek(m)?'<span class="statuschip ziek">Ziek</span>':'')+
   (isEff?'<span class="statuschip" style="background:var(--moss-bg);color:var(--moss)">Actief aanspreekpunt</span>':'')+
   '</span>';
 }).join('') : '<p class="empty-msg" style="padding:0">Nog geen contactpersonen aangewezen voor deze groep.</p>';
 /* De systeembeheerder hoort bij geen enkele groep, maar is wel degene die je
    belt als er iets technisch mis is. Daarom staat hij hier los onder. */
 var regel=el('contact-banner-systeembeheer');
 if(regel){
  regel.hidden=!SYSTEEMBEHEER.tel;
  if(SYSTEEMBEHEER.tel){
   regel.innerHTML='Systeembeheer <a href="tel:'+esc(SYSTEEMBEHEER.tel.replace(/[^0-9+]/g,''))+'">'+
    esc(SYSTEEMBEHEER.tel)+'</a> <span class="mini">voor technische vragen</span>';
  }
 }
}
var isSysteembeheerder=false;
/* De systeembeheerder is geen persoon in "people" en had dus nergens gegevens.
   Het nummer hoort bij de organisatie, niet bij een groep, en staat daarom bij
   de overige organisatiegegevens. */
var SYSTEEMBEHEER={tel:'088 123 45 67'};
/* MyWepp Support werkt namens de leverancier, niet namens een groep. Wie dat
   is hoorde nergens te staan: de balk toonde gewoon de vorige medewerker, en
   het logboek schreef diens naam onder handelingen die Support deed. */
var SUPPORT={naam:'MyWepp Support',tel:'088 555 20 20'};
/* Wie je bent komt uit één plek: de keuzelijst "Ingelogd als". Support en
   systeembeheer sluiten elkaar uit — je kijkt mee namens de leverancier óf je
   bent de beheerder van de organisatie, niet allebei tegelijk. */
var isSupport=false;
function inSupportweergave(){return isSupport;}
function zetIdentiteit(wat){
 isSupport=(wat==='support');
 isSysteembeheerder=(wat==='systeembeheer');
}
/* Wie in deze groep werkt, en verder niemand: vanuit een groep hoor je niet te
   zien wie er in een andere groep zit. Iemand die aan meerdere groepen is
   gekoppeld verschijnt uiteraard in elk van die groepen. */
function accountsInGroep(){
 return people.filter(function(p){
  return (p.type==='medewerker'||p.type==='naaste')&&!p.archived&&p._state!=='verwijderd'&&
   !p.geblokkeerd&&!toegangVerlopen(p)&&p.groepen.indexOf(huidigeGroep)>-1;
 });
}
/* Na een groepswissel kan de "ingelogde" persoon hier niet meer werken; dan
   verder gaan als iemand die er wel bij hoort, anders blijf je hangen als
   iemand die in deze groep niet bestaat. */
function borgGeldigeGebruiker(){
 if(staatBovenDeGroep())return;
 /* Precies dezelfde voorwaarde als de lijst zelf. Stonden ze uit elkaar, dan
    verdween je uit de keuzelijst zonder dat hier iets gebeurde: de balk toonde
    dan de eerste optie ("Systeembeheerder") terwijl je dat niet was, en het
    logboek schreef je handelingen nog op de oude naam. */
 var toegestaan=accountsInGroep();
 if(toegestaan.some(function(x){return x.id===huidigeGebruikerId;}))return;
 var vervanger=toegestaan[0];
 /* Is er niemand meer die hier kan werken, dan is er ook niemand ingelogd.
    Blijven wijzen naar de vorige persoon betekende dat het logboek zijn naam
    schreef onder handelingen terwijl zijn account geblokkeerd of verlopen was. */
 if(!vervanger){huidigeGebruikerId=null;return;}
 huidigeGebruikerId=vervanger.id;
 MIJN_PROFIEL.voor=vervanger.voor;MIJN_PROFIEL.achter=vervanger.achter;
 MIJN_PROFIEL.mail=vervanger.mail||'';MIJN_PROFIEL.mobiel=vervanger.tel||'';
}
function renderAccountSelect(){
 borgGeldigeGebruiker();
 var opties=accountsInGroep();
 var systeembeheerOptie='<option value="systeembeheer"'+(isSysteembeheerder?' selected':'')+'>Systeembeheerder — alle groepen</option>';
 var eigenGekozen=!isSysteembeheerder&&!isSupport;
 /* In de supportweergave is dit geen keuze maar een vaststelling: je kijkt mee
    als Support, niet als een medewerker van de groep. */
 var supportOptie=(isSupport||el('rol-select').value==='support')
  ? '<option value="support"'+(isSupport?' selected':'')+'>'+esc(SUPPORT.naam)+' — meekijken</option>'
  : '';
 /* Wie namens de leverancier meekijkt, hoort niet in de huid van een medewerker
    of naaste te kunnen stappen. Dat zou twee dingen kapotmaken: het logboek
    schrijft dan hun naam onder handelingen die Support deed, en Support krijgt
    de rechten van die persoon op cliënten waar hij niets te zoeken heeft.
    Terug naar een gewoon account gaat via Weergave, precies zoals je hier
    binnenkwam. */
 if(isSupport){
  el('account-select').innerHTML=supportOptie;
  return;
 }
 /* Zonder bruikbaar account in deze groep koos de browser vanzelf de eerste
    optie, en dat was Systeembeheerder. De balk zei dan dat je de beheerder was
    terwijl het logboek "Onbekend" schreef. Liever eerlijk melden dat er niets
    te kiezen valt. */
 if(!opties.length&&eigenGekozen){
  el('account-select').innerHTML='<option value="" selected>Geen account in deze groep</option>'+supportOptie+systeembeheerOptie;
  return;
 }
 el('account-select').innerHTML=supportOptie+systeembeheerOptie+opties.map(function(p){
  var label=naam(p)+' — '+(p.type==='medewerker'?'Medewerker':'Naaste')+(p.contactVolgorde?', contactpersoon '+p.contactVolgorde:'');
  return '<option value="'+p.id+'"'+(eigenGekozen&&p.id===huidigeGebruikerId?' selected':'')+'>'+esc(label)+'</option>';
 }).join('');
}
function verlaatSysteembeheer(){
 zetIdentiteit('');
 toonAdminWie();
 updateAdminTabZichtbaarheid();
 if(el('rol-select').value!=='support'&&!el('view-admin').hidden)showView('personal');
}
el('account-select').addEventListener('change',function(){
 var waarde=el('account-select').value;
 if(waarde==='support'){
  zetIdentiteit('support');
  toonAdminWie();
  updateAdminTabZichtbaarheid();
  renderAccountSelect();
  showView('admin');
  return;
 }
 if(waarde==='systeembeheer'){
  zetIdentiteit('systeembeheer');
  toonAdminWie();
  updateAdminTabZichtbaarheid();
  showView('admin');
  kiesAdmintab('groepen');
  return;
 }
 var gekozen=findPerson(+waarde);
 if(!gekozen)return;
 verlaatSysteembeheer();
 huidigeGebruikerId=gekozen.id;
 /* In een echt systeem legt de inlog dit vast; hier is het wisselen van account
    het dichtstbijzijnde equivalent, zodat "lang niet gebruikt" werkt. */
 gekozen.laatsteLogin=vandaagISO();
 MIJN_PROFIEL.voor=gekozen.voor;MIJN_PROFIEL.achter=gekozen.achter;
 MIJN_PROFIEL.mail=gekozen.mail||'';MIJN_PROFIEL.mobiel=gekozen.tel||'';
 renderAll();
});
/* De actieve groep hoort altijd in de titel te staan. Je wisselt vanuit de
   Admin Tools, het controlescherm of het zoekscherm ongemerkt van groep, en
   een wijziging in de verkeerde groep is in de zorg een echte fout. Daarom
   hier, in renderAll, en niet alleen bij de groepskeuze. */
function toonGroepInTitel(){
 var t=el('formulier-titel-groep');
 if(t)t.textContent=huidigeGroep?' \u2013 '+huidigeGroep:'';
}
function renderAll(){
 toonGroepInTitel();
 ['client','medewerker','naaste'].forEach(renderAcc);renderContactpersonen();renderContactBanner();renderAccountSelect();updateTally();
 zetZonderGroepTeller();
 toonKoppelingInFormulier();
 toonAdminWie();
 if(el('admintab-controle')&&!el('admintab-controle').hidden)renderControle();
}

/* ============== SYSTEEMBEHEER (boven groepsniveau) ============== */
function sbCounts(g){
 return {
  m:people.filter(function(p){return p.type==='medewerker'&&!p.archived&&p.groepen.indexOf(g)>-1;}).length,
  n:people.filter(function(p){return p.type==='naaste'&&!p.archived&&p.groepen.indexOf(g)>-1;}).length,
  c:people.filter(function(p){return p.type==='client'&&!p.archived&&p.groepen.indexOf(g)>-1;}).length
 };
}
function sbBevestig(tekst){
 el('sb-groep-bevestiging').textContent=tekst;
 setTimeout(function(){var b=el('sb-groep-bevestiging');if(b)b.textContent='';},2500);
}
/* Staat in het formulier van een gekoppelde groep, zodat je vóór je iets
   wijzigt weet dat het team gedeeld is. */
function toonKoppelingInFormulier(){
 var vak=el('formulier-koppeling');if(!vak)return;
 var partners=partnersVan(huidigeGroep).filter(function(g){return GROEPEN.indexOf(g)>-1;});
 vak.hidden=!partners.length;
 if(!partners.length)return;
 vak.innerHTML='<b>Let op: deze groep werkt samen met '+partners.map(esc).join(' en ')+'.</b> '+
  'Voeg je hier een medewerker toe of haal je er een weg, dan gebeurt dat daar ook. Cliënten en naasten veranderen niet mee.';
}
/* ---- Groepsgegevens (adres, telefoon, e-mail) ----
   Stonden vast in de pagina en waren dus voor elke groep gelijk en nergens te
   wijzigen. Nu per groep, te bewerken via het potlood op het groepsprofiel.
   Een groep zonder eigen gegevens toont de oude voorbeeldwaarden, zodat er
   niets leeg komt te staan tot iemand ze invult. */
var GROEP_STANDAARD={straat:'Tomatstraat',huisnr:'20-1',postcode:'1332CE',plaats:'Almere',tel:'036 96 93 555',mail:'groep.clownvis@zomedo.nl'};
var ADRESDELEN=['straat','huisnr','postcode','plaats'];
var groepGegevens={};
var hubBewerken=false;
/* Het adres stond eerst als één regel opgeslagen. Zo'n oude regel wordt hier
   in delen gesplitst ("Straat 12, 1234AB Plaats"); lukt dat niet, dan komt de
   hele regel bij Straat, zodat er niets verloren gaat. */
function splitsAdres(regel){
 var m=/^(.*?)\s+(\S+),\s*(\d{4}\s?[A-Za-z]{2})\s+(.+)$/.exec(String(regel||'').trim());
 return m?{straat:m[1],huisnr:m[2],postcode:m[3],plaats:m[4]}:{straat:String(regel||''),huisnr:'',postcode:'',plaats:''};
}
function gegevensVan(g){
 var eigen=groepGegevens[g]||{};
 if(eigen.adres!==undefined&&eigen.straat===undefined){
  var delen=splitsAdres(eigen.adres);
  eigen=Object.assign({},eigen,delen);
 }
 var uit={};
 ADRESDELEN.concat(['tel','mail']).forEach(function(k){uit[k]=eigen[k]!==undefined?eigen[k]:GROEP_STANDAARD[k];});
 return uit;
}
function adresTekst(d){
 var regel1=[d.straat,d.huisnr].filter(Boolean).join(' ');
 var regel2=[d.postcode,d.plaats].filter(Boolean).join(' ');
 return [regel1,regel2].filter(Boolean).join(', ');
}
function renderHubGegevens(){
 var box=el('hub-gegevens');if(!box)return;
 var d=gegevensVan(huidigeGroep);
 /* .iconbtn heeft display:flex, dus hidden werkt hier niet. */
 el('hub-bewerk').style.display=hubBewerken?'none':'';
 if(!hubBewerken){
  box.className='hubfields';
  box.innerHTML='<div><b>Adres</b> '+esc(adresTekst(d)||'—')+'</div><div><b>Telefoon</b> '+esc(d.tel||'—')+'</div><div><b>E-mail</b> '+esc(d.mail||'—')+'</div>';
  return;
 }
 /* Indeling zoals de klant hem aanleverde: labels links, het adres in
    Straat/Huisnr en Postcode/Plaats. */
 var veld=function(id,label,waarde,max,klasse){
  return '<label for="'+id+'" class="hubsub">'+label+'</label><input id="'+id+'" maxlength="'+max+'" value="'+esc(waarde)+'"'+(klasse?' class="'+klasse+'"':'')+'>';
 };
 box.className='hubform';
 box.innerHTML='<div class="hubgrid">'+
  '<label for="hub-naam" class="hubkop">Groepsnaam: <span class="verplicht" aria-hidden="true">*</span></label>'+
  '<input id="hub-naam" maxlength="'+MAXLEN.groep+'" required aria-required="true" value="'+esc(huidigeGroep)+'">'+
  '<span class="hubkop boven">Adres:</span>'+
  '<div class="hubadres">'+
   '<div class="hubrij">'+veld('hub-straat','Straat:',d.straat,80)+veld('hub-huisnr','Huisnr:',d.huisnr,10,'kort')+'</div>'+
   '<div class="hubrij">'+veld('hub-postcode','Postcode:',d.postcode,7,'kort')+veld('hub-plaats','Plaats:',d.plaats,60)+'</div>'+
  '</div>'+
  '<label for="hub-tel" class="hubkop">Telefoon:</label><input id="hub-tel" maxlength="'+MAXLEN.tel+'" value="'+esc(d.tel)+'">'+
  '<label for="hub-mail" class="hubkop">E-mail:</label><input id="hub-mail" maxlength="'+MAXLEN.mail+'" value="'+esc(d.mail)+'">'+
  '</div>'+
  '<p class="mini veldfout" id="hub-gegevens-fout" hidden></p>'+
  '<div class="actions"><button type="button" id="hub-annuleer">Annuleren</button><button type="button" class="primary" id="hub-opslaan">Opslaan</button></div>';
 el('hub-naam').focus();
 el('hub-annuleer').addEventListener('click',function(){hubBewerken=false;renderHubGegevens();});
 el('hub-opslaan').addEventListener('click',bewaarHubGegevens);
}
function bewaarHubGegevens(){
 var waarde=function(id,max){return kap(el(id).value.trim(),max);};
 var naamNieuw=waarde('hub-naam',MAXLEN.groep);
 var nieuw={straat:waarde('hub-straat',80),huisnr:waarde('hub-huisnr',10),
  postcode:waarde('hub-postcode',7).toUpperCase(),plaats:waarde('hub-plaats',60),
  tel:waarde('hub-tel',MAXLEN.tel),mail:waarde('hub-mail',MAXLEN.mail)};
 var oudeNaam=huidigeGroep,fout='',foutVeld='';
 if(!naamNieuw){fout='Vul een groepsnaam in.';foutVeld='hub-naam';}
 else if(naamNieuw!==oudeNaam&&GROEPEN.indexOf(naamNieuw)>-1){fout='Er bestaat al een groep met deze naam.';foutVeld='hub-naam';}
 else if(nieuw.postcode&&!/^\d{4}\s?[A-Z]{2}$/.test(nieuw.postcode)){fout='Vul een postcode in als 1234AB, of laat het leeg.';foutVeld='hub-postcode';}
 else if(nieuw.tel&&!telGeldig(nieuw.tel)){fout='Vul een geldig telefoonnummer in (minimaal 9 cijfers), of laat het leeg.';foutVeld='hub-tel';}
 else if(!mailGeldig(nieuw.mail)){fout='Vul een geldig e-mailadres in, of laat het leeg.';foutVeld='hub-mail';}
 ['hub-naam','hub-postcode','hub-tel','hub-mail'].forEach(function(id){el(id).style.borderColor=id===foutVeld?'var(--brick)':'';});
 if(fout){el('hub-gegevens-fout').textContent=fout;el('hub-gegevens-fout').hidden=false;return;}
 var oud=gegevensVan(oudeNaam),veranderd=[];
 if(naamNieuw!==oudeNaam)veranderd.push('naam');
 if(ADRESDELEN.some(function(k){return oud[k]!==nieuw[k];}))veranderd.push('adres');
 if(oud.tel!==nieuw.tel)veranderd.push('telefoon');
 if(oud.mail!==nieuw.mail)veranderd.push('e-mail');
 hubBewerken=false;
 if(veranderd.length){
  groepGegevens[oudeNaam]=nieuw;
  if(naamNieuw!==oudeNaam){
   hernoemGroepOveral(oudeNaam,naamNieuw);
   logActie('Groep "'+oudeNaam+'" hernoemd naar "'+naamNieuw+'"',{soort:'Instelling'});
   syncGroepenToSupabase();
  }
  var rest=veranderd.filter(function(v){return v!=='naam';});
  if(rest.length)logActie('Gegevens van groep "'+naamNieuw+'" aangepast: '+rest.join(', '),{soort:'Instelling'});
  syncOrganisatieData();
  verversGroepReferenties();renderAll();
 }
 renderHubGegevens();
 hubBevestig(veranderd.length?'Gegevens opgeslagen.':'Niets gewijzigd.');
}
el('hub-bewerk').innerHTML=PENCIL_SVG;
el('hub-bewerk').addEventListener('click',function(){hubBewerken=true;renderHubGegevens();});
renderHubGegevens();
function verversGroepReferenties(){
 el('pp-groep-naam').textContent=huidigeGroep;
 /* Bij een groepswissel nooit half bewerkte gegevens van de vorige groep
    laten staan: die zouden anders bij de nieuwe groep worden opgeslagen. */
 hubBewerken=false;renderHubGegevens();
 toonGroepInTitel();
 el('hub-groepnaam').textContent=huidigeGroep;
 if(el('hub-tweestaps'))el('hub-tweestaps').checked=eistTweestaps(huidigeGroep);
 toonKoppelingInFormulier();
}
var gearchiveerdeGroepen=[];
/* Per verwijderde groep: wie erin zat en welke rechten en vertegenwoordigers
   bij het verwijderen zijn opgeruimd. Zonder dit kwam bij Groep herstellen een
   lege groep terug en was iedereen zijn rollen kwijt. */
var groepOntkoppeld={};
function rechtenMomentopname(){
 var m={};
 people.forEach(function(p){
  var r={};
  RECHTVELDEN.forEach(function(v){if(p[v]&&Object.keys(p[v]).length)r[v]=JSON.parse(JSON.stringify(p[v]));});
  if(p.wettelijkeVertegenwoordiger)r.vertegenwoordiger=p.wettelijkeVertegenwoordiger;
  m[p.id]=r;
 });
 return m;
}
/* Wat er in de momentopname stond en nu weg is. */
function opgeruimdSinds(voor){
 var weg={};
 Object.keys(voor).forEach(function(id){
  var p=findPerson(+id);if(!p)return;
  RECHTVELDEN.forEach(function(v){
   Object.keys(voor[id][v]||{}).forEach(function(k){
    if(!p[v]||!(k in p[v])){weg[id]=weg[id]||{};weg[id][v]=weg[id][v]||{};weg[id][v][k]=voor[id][v][k];}
   });
  });
  if(voor[id].vertegenwoordiger&&!p.wettelijkeVertegenwoordiger){weg[id]=weg[id]||{};weg[id].vertegenwoordiger=voor[id].vertegenwoordiger;}
 });
 return weg;
}
/* De schakelaar "Tweestapsverificatie verplicht" zei alleen "opgeslagen" maar
   bewaarde niets en deed niets. Nu staat het per groep vast, zodat de controle
   kan melden wie er niet aan voldoet. */
var groepTweestaps={};
function eistTweestaps(g){return groepTweestaps[g]!==false;}
function voegGroepToe(naamVal){
 naamVal=kap((naamVal||'').trim(),MAXLEN.groep);
 if(!naamVal)return false;
 if(GROEPEN.indexOf(naamVal)>-1){alert('Er bestaat al een groep met deze naam.');return false;}
 GROEPEN.push(naamVal);
 groepErbij(naamVal);
 groepLocatie[naamVal]=LOCATIES[0]||null;
 bulkSel.groepen[naamVal]=false;
 verversGroepReferenties();
 renderSysteembeheer();
 syncGroepenToSupabase();
 logActie('Groep "'+naamVal+'" aangemaakt');
 sbBevestig('Groep "'+naamVal+'" toegevoegd.');
 return true;
}
/* De standaardrollen van één groep stonden op een eigen tabblad met een eigen
   groepskeuze, los van het scherm waar je de groep bewerkt. Je koos daar dus nog
   een keer een groep, terwijl je er al in zat. Ze horen hier, bij de groep zelf. */
var groepBewerkType='medewerker';
/* Een groep hernoemen. Veel staat op groepsnaam opgeslagen; alles daarvan moet
   mee, anders valt het stilletjes terug op de standaard. Eén functie voor
   Groep bewerken en het potlood op het groepsprofiel, zodat die twee nooit
   uit elkaar lopen. Alleen aanroepen bij een échte naamswijziging: anders wist
   het verplaatsen naar dezelfde sleutel de waarde. */
/* Oude naam -> nieuwe naam, voor de groepen die deze sessie hernoemde. Nodig om
   in de database ook de mensen mee te nemen die een andere beheerder intussen
   in de oude groep had gezet (die kent deze sessie niet). */
var groepHernoemd={};
function hernoemGroepOveral(g,nieuw){
 GROEPEN[GROEPEN.indexOf(g)]=nieuw;
 groepWeg(g);groepErbij(nieuw);
 groepHernoemd[g]=nieuw;
 people.forEach(function(p){
  var idx=p.groepen.indexOf(g);
  if(idx>-1){p.groepen[idx]=nieuw;if(p._state!=='nieuw')p._state='gewijzigd';}
 });
 var verhuis=function(opslag){if(opslag&&opslag[g]!==undefined){opslag[nieuw]=opslag[g];delete opslag[g];}};
 verhuis(groupOverride);
 verhuis(groepGegevens);
 /* Deze twee gingen eerder verloren bij hernoemen: de groep stond daarna
    weer op "tweestaps verplicht" en een standaard-Digibord. */
 verhuis(groepTweestaps);
 verhuis(digibordPerGroep);
 verhuis(groepLocatie);
 /* Koppelingen staan op groepsnaam. Zonder dit viel een hernoemde groep
    stilletjes uit zijn koppeling. */
 groepKoppelingen=groepKoppelingen.map(function(k){return k.map(function(x){return x===g?nieuw:x;});});
 bulkSel.groepen[nieuw]=bulkSel.groepen[g]||false;delete bulkSel.groepen[g];
 if(huidigeGroep===g)huidigeGroep=nieuw;
}
function hernoemGroep(g){
 groepBewerkType='medewerker';
 var werk={medewerker:effectiveFor(g,'medewerker').data,naaste:effectiveFor(g,'naaste').data};
 var partners=partnersVan(g);
 /* Koppelen gebeurt hier, bij de groep zelf. De naam van de groep die je
    bewerkt staat in de titel en in de zin boven het keuzemenu, en die groep
    staat zelf niet in het menu: zo koppel je nooit per ongeluk de verkeerde. */
 var koppelOpties=GROEPEN.filter(function(x){return clusterVan(g).indexOf(x)<0;});
 var koppelBlok='<fieldset class="admblok"><legend>Gekoppelde groep</legend>'+
  '<p class="mini" style="margin:0 0 8px">Je bewerkt <b>'+esc(g)+'</b>. Gekoppelde groepen hebben dezelfde medewerkers; cliënten en naasten blijven per groep.</p>'+
  (partners.length
   ? '<p style="margin:0 0 6px">Nu gekoppeld aan: <b>'+partners.map(esc).join('</b>, <b>')+'</b></p>'+
     '<label class="contactcheck" style="margin:0 0 10px"><input type="checkbox" id="modal-groep-ontkoppel">Koppeling van '+esc(g)+' opheffen</label>'
   : '<p style="margin:0 0 6px">Nu niet gekoppeld.</p>')+
  '<div class="admveld"><label for="modal-groep-koppel">Koppelen aan</label><select class="admin" id="modal-groep-koppel">'+
   '<option value="">'+(partners.length?'Geen extra groep':'Niet koppelen')+'</option>'+
   koppelOpties.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('')+
  '</select></div></fieldset>';
 openModal('<h3>Groep bewerken: '+esc(g)+'</h3>'+
  (partners.length?'<div class="admwaarschuwing"><b>Gekoppelde groep</b><p class="mini" style="margin:0">Deze groep deelt haar team met <b>'+partners.map(esc).join('</b>, <b>')+'</b>. Wat je hier voor medewerkers instelt, geldt alleen voor deze groep — maar de medewerkers zelf zijn dezelfde.</p></div>':'')+
  '<fieldset class="admblok"><legend>Groep</legend>'+
  '<div class="admveld"><label for="modal-groep-naam">Naam<span class="verplicht">*</span></label><input class="admin" id="modal-groep-naam" value="'+esc(g)+'"></div>'+
  '<div class="admveld"><label for="modal-groep-locatie">Locatie</label><select class="admin" id="modal-groep-locatie">'+LOCATIES.map(function(l){return '<option'+(l===groepLocatie[g]?' selected':'')+'>'+esc(l)+'</option>';}).join('')+'</select></div>'+
  '</fieldset>'+
  koppelBlok+
  '<fieldset class="admblok"><legend>Standaardrollen in deze groep</legend>'+
  '<p class="mini" style="margin:0 0 10px">Wat iemand hier standaard mag. Laat je dit staan, dan volgt de groep de organisatiestandaard uit Standaardrollen.</p>'+
  '<div class="typetabs" id="modal-groep-typetabs">'+
   '<button type="button" class="typetab on" data-type="medewerker">Medewerker</button>'+
   '<button type="button" class="typetab" data-type="naaste">Naaste</button>'+
  '</div>'+
  '<div id="modal-groep-rechten"></div>'+
  '<button type="button" class="small" id="modal-groep-reset" style="margin-top:8px">Terug naar organisatiestandaard</button>'+
  '</fieldset>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
 var toonRechten=function(){
  var eff=effectiveFor(g,groepBewerkType);
  var vlag=JSON.stringify(werk[groepBewerkType])!==JSON.stringify(orgDefault[groepBewerkType]);
  el('modal-groep-rechten').innerHTML='<div class="mini" style="margin-bottom:10px"><span class="tag '+(vlag?'override':'inherit')+'">'+
   (vlag?'Wijkt af van de organisatiestandaard':'Volgt de organisatiestandaard')+'</span></div><div id="modal-groep-rechten-inner"></div>';
  rechtenRows(el('modal-groep-rechten-inner'),groepBewerkType,werk[groepBewerkType],toonRechten);
 };
 toonRechten();
 /* Opheffen en een nieuwe koppeling tegelijk zou twee bevestigingen achter
    elkaar geven; één ding per keer houdt het overzichtelijk. */
 if(el('modal-groep-ontkoppel'))el('modal-groep-ontkoppel').addEventListener('change',function(){
  el('modal-groep-koppel').disabled=this.checked;
  if(this.checked)el('modal-groep-koppel').value='';
 });
 Array.prototype.forEach.call(el('modal-groep-typetabs').querySelectorAll('.typetab'),function(b){
  b.addEventListener('click',function(){
   Array.prototype.forEach.call(el('modal-groep-typetabs').querySelectorAll('.typetab'),function(x){x.classList.remove('on');});
   b.classList.add('on');groepBewerkType=b.getAttribute('data-type');toonRechten();
  });
 });
 el('modal-groep-reset').addEventListener('click',function(){
  werk[groepBewerkType]=JSON.parse(JSON.stringify(orgDefault[groepBewerkType]));
  toonRechten();
 });
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var nieuw=kap(el('modal-groep-naam').value.trim(),MAXLEN.groep);
  var nieuweLocatie=el('modal-groep-locatie').value;
  var koppelAan=el('modal-groep-koppel').value;
  var ontkoppelen=!!(el('modal-groep-ontkoppel')&&el('modal-groep-ontkoppel').checked);
  if(!nieuw)return;
  if(nieuw!==g&&GROEPEN.indexOf(nieuw)>-1){alert('Er bestaat al een groep met deze naam.');return;}
  var hernoemd=nieuw!==g;
  var locatieGewijzigd=groepLocatie[g]!==nieuweLocatie;
  if(hernoemd)hernoemGroepOveral(g,nieuw);
  groepLocatie[nieuw]=nieuweLocatie;
  /* Standaardrollen die gelijk zijn aan de organisatiestandaard slaan we niet op
     als afwijking: anders blijft een groep straks achter als de organisatie
     verandert, zonder dat iemand dat zo bedoeld heeft. */
  var rolwijzigingen=[];
  ['medewerker','naaste'].forEach(function(t){
   var afwijkend=JSON.stringify(werk[t])!==JSON.stringify(orgDefault[t]);
   var hadAfwijking=!!(groupOverride[nieuw]&&groupOverride[nieuw][t]);
   if(afwijkend){
    groupOverride[nieuw]=groupOverride[nieuw]||{};
    if(JSON.stringify(groupOverride[nieuw][t])!==JSON.stringify(werk[t]))rolwijzigingen.push(t);
    groupOverride[nieuw][t]=JSON.parse(JSON.stringify(werk[t]));
   }else if(hadAfwijking){
    delete groupOverride[nieuw][t];rolwijzigingen.push(t);
   }
  });
  verversGroepReferenties();
  closeModal();
  renderSysteembeheer();
  renderAll();
  syncGroepenToSupabase();
  /* Alleen melden wat er echt is veranderd; anders schreef het logboek een
     locatiewijziging op terwijl je alleen een rol had aangepast. */
  if(hernoemd)logActie('Groep "'+g+'" hernoemd naar "'+nieuw+'"');
  if(locatieGewijzigd)logActie('Locatie van groep "'+nieuw+'" gewijzigd naar "'+nieuweLocatie+'"');
  if(rolwijzigingen.length)logActie('Standaardrollen van groep "'+nieuw+'" gewijzigd voor '+rolwijzigingen.join(' en '));
  if(hernoemd)syncOrganisatieData();
  /* Eerst is de rest opgeslagen; de koppeling vraagt daarna nog om een eigen
     bevestiging, omdat hij medewerkers over groepen heen verplaatst. */
  if(ontkoppelen)ontkoppelGroep(nieuw);
  else if(koppelAan&&GROEPEN.indexOf(koppelAan)>-1)koppelGroepen(nieuw,koppelAan);
  sbBevestig(hernoemd?('Groep hernoemd naar "'+nieuw+'".')
   :(rolwijzigingen.length?('Standaardrollen van "'+nieuw+'" bijgewerkt.')
   :(locatieGewijzigd?('Locatie van "'+nieuw+'" bijgewerkt.'):('Niets gewijzigd aan "'+nieuw+'".'))));
 });
}
/* Een groep met mensen erin kon niet weg: eerst moest je iedereen een voor een
   ontkoppelen of verplaatsen. Op verzoek gaat dat nu in een keer. De groep
   verdwijnt uit koppelingen en bij iedereen die erin zat. Wie ook in een andere
   groep zit, houdt die; wie alleen in deze groep zat blijft bestaan en komt in
   Zonder groep, waar de beheerder zelf beslist (verwijderen of verplaatsen).
   Niemand verdwijnt dus ongemerkt. */
function verwijderGroep(g){
 if(GROEPEN.length<=1){alert('Er moet minimaal één groep overblijven.');return;}
 var inGroep=people.filter(function(p){return !p.archived&&p.groepen.indexOf(g)>-1;});
 var zonder=inGroep.filter(function(p){return p.groepen.length===1;});
 /* Ook gearchiveerden gaan uit de groep. Anders hielden ze de naam van een
    groep die niet meer bestaat en waren ze nergens meer te vinden: niet bij
    Herstellen (die toont alleen bestaande groepen) en niet bij Zonder groep,
    dus ook nooit meer te herstellen of te wissen (aangetoond). */
 var archiefInGroep=people.filter(function(p){return p.archived&&(p.groepen||[]).indexOf(g)>-1;});
 var elders=inGroep.length-zonder.length;
 var partners=partnersVan(g);
 var tekst='<p>Weet je zeker dat je de groep <b>'+esc(g)+'</b> wilt verwijderen? Je kunt haar daarna terugzetten via "Groep herstellen".</p>'+
  (inGroep.length?'<p>De groep wordt bij '+inGroep.length+' perso'+(inGroep.length===1?'on':'nen')+' weggehaald'+
   (elders?'; '+elders+' daarvan blij'+(elders===1?'ft':'ven')+' in hun andere groep':'')+'.</p>':'')+
  (zonder.length?'<p><b>'+zonder.length+' perso'+(zonder.length===1?'on zit':'nen zitten')+' alleen in deze groep.</b> Die '+(zonder.length===1?'komt':'komen')+' onder Overig › Zonder groep te staan. Daar verwijder of verplaats je '+(zonder.length===1?'hem':'hen')+' zelf.</p>':'')+
  (partners.length?'<p>De koppeling met <b>'+partners.map(esc).join('</b>, <b>')+'</b> vervalt.</p>':'');
 bevestigModal('Groep verwijderen',tekst,'Ja, verwijderen',function(){
  var voor=rechtenMomentopname();
  inGroep.forEach(function(p){
   p.groepen=p.groepen.filter(function(x){return x!==g;});
   /* Rechten op iemand met wie je geen groep meer deelt, horen niet te blijven
      staan: dezelfde opruiming als bij losmaken uit een groep. */
   ruimRechtenZonderGedeeldeGroepOp(p);
  });
  archiefInGroep.forEach(function(p){p.groepen=p.groepen.filter(function(x){return x!==g;});});
  groepOntkoppeld[g]={personen:inGroep.concat(archiefInGroep).map(function(p){return p.id;}),opgeruimd:opgeruimdSinds(voor)};
  GROEPEN.splice(GROEPEN.indexOf(g),1);
  groepWeg(g);
  gearchiveerdeGroepen.push(g);
  /* Anders bleef de partnergroep "gekoppeld aan" een groep die niet meer
     bestaat. Een koppeling van twee valt daarmee helemaal weg. */
  groepKoppelingen=groepKoppelingen.map(function(k){return k.filter(function(x){return x!==g;});}).filter(function(k){return k.length>1;});
  delete groupOverride[g];
  delete bulkSel.groepen[g];
  if(huidigeGroep===g)huidigeGroep=GROEPEN[0];
  verversGroepReferenties();
  renderSysteembeheer();
  renderAll();
  /* syncGroepenToSupabase schrijft eerst de personen weg en haalt dan pas de
     groep uit de database; de tweede ronde vangt een groep die nog niet in de
     database stond. */
  syncGroepenToSupabase().then(function(){return syncToSupabase();});
  logActie('Groep "'+g+'" verwijderd'+(inGroep.length?'; ontkoppeld bij '+inGroep.length+' perso'+(inGroep.length===1?'on':'nen')+(zonder.length?', '+zonder.length+' zonder groep':''):''),{soort:'Verwijdering'});
  if(zonder.length)openMelding('Groep verwijderd','"'+g+'" is verwijderd. '+zonder.length+' perso'+(zonder.length===1?'on staat':'nen staan')+' nu onder Overig › Zonder groep.');
  else sbBevestig('Groep "'+g+'" verwijderd.');
 });
}
function herstelGroep(g){
 var idx=gearchiveerdeGroepen.indexOf(g);
 if(idx<0)return;
 gearchiveerdeGroepen.splice(idx,1);
 var vrijeNaam=g;
 if(GROEPEN.indexOf(vrijeNaam)>-1)vrijeNaam=g+' (hersteld)';
 GROEPEN.push(vrijeNaam);
 groepErbij(vrijeNaam);
 groepLocatie[vrijeNaam]=LOCATIES[0]||null;
 bulkSel.groepen[vrijeNaam]=false;
 /* Wie er bij het verwijderen in zat, komt terug, met de rechten en
    vertegenwoordigers die toen zijn opgeruimd. Alleen waar beide personen er nog
    zijn en weer een groep delen: een recht op iemand die intussen is
    gearchiveerd of elders zit, komt niet ongemerkt terug. */
 var bewaard=groepOntkoppeld[g]||{},terug=0,rechtenTerug=0;
 (Array.isArray(bewaard)?bewaard:(bewaard.personen||[])).forEach(function(id){
  var p=findPerson(id);
  /* Gearchiveerden komen ook terug in de groep, en blijven gearchiveerd. */
  if(p&&p.groepen.indexOf(vrijeNaam)<0){p.groepen.push(vrijeNaam);terug++;}
 });
 var opgeruimd=bewaard.opgeruimd||{};
 Object.keys(opgeruimd).forEach(function(id){
  var p=findPerson(+id);if(!p||p.archived)return;
  RECHTVELDEN.forEach(function(v){
   Object.keys(opgeruimd[id][v]||{}).forEach(function(k){
    var ander=findPerson(+k);
    if(!ander||ander.archived||!deeltGroepMet(p,ander))return;
    p[v]=p[v]||{};
    if(!(k in p[v])){p[v][k]=opgeruimd[id][v][k];rechtenTerug++;}
   });
  });
  var vt=findPerson(opgeruimd[id].vertegenwoordiger);
  if(vt&&!vt.archived&&!p.wettelijkeVertegenwoordiger&&deeltGroepMet(p,vt)){p.wettelijkeVertegenwoordiger=vt.id;rechtenTerug++;}
 });
 delete groepOntkoppeld[g];
 verversGroepReferenties();
 renderSysteembeheer();
 renderAll();
 syncGroepenToSupabase().then(function(){return syncToSupabase();});
 if(terug)logActie(terug+' perso'+(terug===1?'on':'nen')+(rechtenTerug?' en '+rechtenTerug+' recht'+(rechtenTerug===1?'':'en'):'')+' terug in groep "'+vrijeNaam+'" na herstellen',{soort:'Herstel'});
}

/* ============== CONTROLE: signalen over alle groepen heen ==============
   Een prototype laat makkelijk situaties ontstaan die in de praktijk pas
   opvallen als het misgaat: een cliënt waar niemand toegang toe heeft, een
   groep zonder aanspreekpunt, of een zieke contactpersoon zonder vervanger.
   Deze controle maakt dat vooraf zichtbaar. */
function actieveIn(groep,type){
 return people.filter(function(p){return p.type===type&&!p.archived&&p._state!=='verwijderd'&&p.groepen.indexOf(groep)>-1;});
}
function controleSignalen(){
 var signalen=[];
 GROEPEN.forEach(function(g){
  var clienten=actieveIn(g,'client'),medewerkers=actieveIn(g,'medewerker'),naasten=actieveIn(g,'naaste');
  /* 1. Cliënt zonder enige medewerker met toegang: niemand kan iets voor
        deze persoon vastleggen of zien. */
  clienten.forEach(function(c){
   /* Een medewerker met verlopen toegang kan niet inloggen en telt dus niet. */
   var metToegang=medewerkers.filter(function(m){return rolOpClient(m,c.id)&&heeftToegang(m);});
   if(!metToegang.length){
    signalen.push({ernst:'hoog',groep:g,tekst:naam(c)+' heeft geen enkele medewerker met toegang.',
     actie:{soort:'client',id:c.id,groep:g,label:'Toegang regelen'}});
   }
  });
  /* 2. Groep zonder contactpersoon: naasten hebben geen aanspreekpunt. */
  var contacten=medewerkers.filter(function(m){return m.contactVolgorde;});
  if(medewerkers.length&&!contacten.length){
   signalen.push({ernst:'hoog',groep:g,tekst:'Geen contactpersoon aangewezen voor deze groep.',
    actie:{soort:'groep',groep:g,label:'Groep openen'}});
  }
  /* 3. Enige contactpersoon is ziek: meldingen komen nergens aan. */
  var ziek=contacten.filter(isZiek);
  if(contacten.length&&ziek.length===contacten.length){
   signalen.push({ernst:'hoog',groep:g,tekst:'De contactperso(o)n(en) van deze groep staan allemaal op ziek.',
    actie:{soort:'groep',groep:g,label:'Groep openen'}});
  }
  /* 4. Eén contactpersoon: bij ziekte is er geen terugval. */
  if(contacten.length===1&&medewerkers.length>1){
   signalen.push({ernst:'laag',groep:g,tekst:'Maar één contactpersoon — bij ziekte is er geen vervanger.',
    actie:{soort:'groep',groep:g,label:'Groep openen'}});
  }
  /* 5. Medewerkers en naasten zonder e-mailadres kunnen niet inloggen. */
  medewerkers.concat(naasten).forEach(function(p){
   if(!p.mail)signalen.push({ernst:'laag',groep:g,tekst:naam(p)+' heeft geen e-mailadres en kan dus niet inloggen.',
    actie:{soort:'persoon',id:p.id,type:p.type,groep:g,label:'Profiel openen'}});
  });
  /* 6. Naamgenoten in dezelfde groep: verwisselingsrisico. */
  var gezien={};
  clienten.concat(medewerkers,naasten).forEach(function(p){
   var sleutel=naam(p).toLowerCase();
   if(gezien[sleutel]){
    signalen.push({ernst:'laag',groep:g,tekst:'Twee keer dezelfde naam in deze groep: '+naam(p)+'.',
     actie:{soort:'groep',groep:g,label:'Groep openen'}});
   }
   gezien[sleutel]=true;
  });
 });
 /* 7. Tijdelijke toegang die is verlopen of bijna verloopt. Dit hangt aan de
       persoon en niet aan een groep: wie in twee groepen zit, verloor anders
       twee keer dezelfde toegang en stond hier dus dubbel. */
 people.filter(function(pp){
  return (pp.type==='medewerker'||pp.type==='naaste')&&!pp.archived&&pp._state!=='verwijderd'&&(pp.groepen||[]).length;
 }).forEach(function(pp){
  var dagen=dagenTotVerloop(pp);
  if(dagen===null)return;
  var waar=pp.groepen.join(', ');
  if(dagen<0){
   signalen.push({ernst:'hoog',groep:waar,tekst:naam(pp)+' had toegang tot '+datumNL(pp.toegangTot)+' en kan niet meer inloggen.',
    actie:{soort:'persoon',id:pp.id,type:pp.type,groep:pp.groepen[0],label:'Profiel openen'}});
  }else if(dagen<=14){
   signalen.push({ernst:'laag',groep:waar,tekst:'Toegang van '+naam(pp)+' verloopt over '+dagen+' dag'+(dagen===1?'':'en')+' ('+datumNL(pp.toegangTot)+').',
    actie:{soort:'persoon',id:pp.id,type:pp.type,groep:pp.groepen[0],label:'Profiel openen'}});
  }
 });
 /* 8. Bewaartermijn: gearchiveerde gegevens mogen niet onbeperkt blijven staan
       (AVG art. 5 lid 1 sub e). Zonder signaal blijft het archief eeuwig groeien. */
 people.filter(bewaartermijnVerstreken).forEach(function(pp){
  var maanden=maandenSinds(pp.gearchiveerdOp);
  signalen.push({ernst:'hoog',groep:(pp.groepen||[]).join(', '),
   tekst:naam(pp)+' staat sinds '+datumNL(pp.gearchiveerdOp)+' in het archief. De bewaartermijn van '+bewaartermijnTekst()+' is verstreken; wissen of onderbouwen waarom dat niet kan.',
   actie:{soort:'herstellen',herstel:pp.type==='client'?'client':'persoon',groep:(pp.groepen||[])[0]||huidigeGroep,label:'Archief openen'}});
 });
 /* 9. Geblokkeerde accounts: een blokkade hoort tijdelijk te zijn. Blijft hij
       staan, dan moet er een besluit komen (opheffen of de persoon eruit). */
 people.filter(function(pp){return pp.geblokkeerd&&!pp.archived&&pp._state!=='verwijderd';}).forEach(function(pp){
  signalen.push({ernst:'laag',groep:(pp.groepen||[]).join(', '),
   tekst:naam(pp)+' is geblokkeerd'+(pp.geblokkeerdReden?' ('+pp.geblokkeerdReden+')':'')+'. Opheffen kan niet meer via het profiel; komt deze persoon niet terug, verwijder het account dan.',
   actie:{soort:'persoon',id:pp.id,type:pp.type,groep:(pp.groepen||[])[0]||huidigeGroep,label:'Profiel openen'}});
 });
 /* 10. Accounts die al lang niet zijn gebruikt: openstaande toegang die
        niemand nodig heeft is een risico dat niemand opmerkt. */
 people.filter(langInactief).forEach(function(pp){
  var m=maandenInactief(pp);
  signalen.push({ernst:'laag',groep:(pp.groepen||[]).join(', '),
   tekst:naam(pp)+' heeft het account '+m+' maanden niet gebruikt, maar heeft nog wel toegang.',
   actie:{soort:'persoon',id:pp.id,type:pp.type,groep:(pp.groepen||[])[0]||huidigeGroep,label:'Profiel openen'}});
 });
 /* 11. Cliënten zonder vastgelegde toestemming. Zolang dat ontbreekt toont de
        app geen foto, maar het hoort gewoon geregeld te zijn. */
 GROEPEN.forEach(function(g){
  actieveIn(g,'client').forEach(function(c){
   if(toestemmingVan(c).vastgelegdOp)return;
   signalen.push({ernst:'laag',groep:g,
    tekst:'Van '+naam(c)+' is geen toestemming vastgelegd voor foto\'s en groepschat.',
    actie:{soort:'client',id:c.id,groep:g,label:'Profiel openen'}});
  });
 });
 /* 12. Accounts zonder tweede stap terwijl een groep die eist. Met alleen een
        uitgelekt wachtwoord ligt het dossier dan open. Dit hangt aan de persoon
        en niet aan de groep: wie in twee groepen zit stond er anders dubbel in,
        terwijl het om één account met één ontbrekende tweede stap gaat. */
 people.filter(function(pp){
  return (pp.type==='medewerker'||pp.type==='naaste')&&!pp.archived&&pp._state!=='verwijderd'&&
   !pp.tweestaps&&heeftToegang(pp)&&(pp.groepen||[]).some(eistTweestaps);
 }).forEach(function(pp){
  var eisers=pp.groepen.filter(eistTweestaps);
  signalen.push({ernst:'hoog',groep:eisers.join(', '),
   tekst:naam(pp)+' heeft geen tweestapsverificatie, terwijl '+(eisers.length>1?'deze groepen dat verplicht stellen':'deze groep dat verplicht stelt')+'.',
   actie:{soort:'persoon',id:pp.id,type:pp.type,groep:eisers[0],label:'Profiel openen'}});
 });
 /* 13. Een naaste met toegang tot meerdere cliënten. Een familielid hoort
        normaal bij één cliënt; meer is ongebruikelijk en het controleren waard. */
 people.filter(function(pp){return pp.type==='naaste'&&!pp.archived&&pp._state!=='verwijderd';}).forEach(function(pp){
  var clienten=Object.keys(pp.clientRechten||{}).map(function(id){return findPerson(+id);})
   .filter(function(c){return c&&c.type==='client'&&!c.archived;});
  if(clienten.length<2)return;
  signalen.push({ernst:'laag',groep:(pp.groepen||[]).join(', '),
   tekst:naam(pp)+' is een naaste met toegang tot '+clienten.length+' cliënten: '+clienten.map(naam).join(', ')+'. Controleer of dat klopt.',
   actie:{soort:'persoon',id:pp.id,type:pp.type,groep:(pp.groepen||[])[0]||huidigeGroep,label:'Profiel openen'}});
 });
 /* 14. Groep zonder mensen. */
 GROEPEN.forEach(function(g){
  if(!actieveIn(g,'client').length&&!actieveIn(g,'medewerker').length&&!actieveIn(g,'naaste').length){
   signalen.push({ernst:'laag',groep:g,tekst:'Deze groep is helemaal leeg.',actie:{soort:'groep',groep:g,label:'Groep openen'}});
  }
 });
 /* 15. Toegangslijst te lang niet nagelopen. Dit is de vaste controle in de
       zorg: niet of iets fout is ingesteld, maar of het nóg klopt. Wie eenmaal
       toegang kreeg, houdt die tot iemand ernaar kijkt. */
 GROEPEN.forEach(function(g){
  actieveIn(g,'client').forEach(function(c){
   var maanden=maandenSindsControle(c);
   if(maanden===null){
    signalen.push({ernst:'laag',groep:g,tekst:'De toegangslijst van '+naam(c)+' is nog nooit nagelopen.',
     actie:{soort:'toegangscontrole',client:c.id,label:'Nu nalopen'}});
   }else if(maanden>=CONTROLE_MAANDEN){
    signalen.push({ernst:'hoog',groep:g,tekst:'De toegangslijst van '+naam(c)+' is '+maanden+' maanden niet nagelopen.',
     actie:{soort:'toegangscontrole',client:c.id,label:'Nu nalopen'}});
   }
  });
 });
 var volgorde={hoog:0,laag:1};
 return signalen.sort(function(a,b){return volgorde[a.ernst]-volgorde[b.ernst];});
}
/* ---- Periodieke toegangscontrole ----
   Het controlescherm keek naar wat er mis is ingesteld, maar nergens naar de
   vraag die in de zorg elk half jaar terugkomt: mag iedereen die bij dit
   dossier kan, er nog steeds bij? Toegang die niemand meer nakijkt blijft
   bestaan, ook als iemand allang van afdeling is. Hier leg je vast dat je ernaar
   hebt gekeken, en wat je hebt aangepast. */
var CONTROLE_MAANDEN=6;
var TOEGANGSCONTROLE={};
function maandenSindsControle(c){
 var vast=TOEGANGSCONTROLE[c.id];
 if(!vast||!geldigeDatum(vast.op))return null;
 return maandenSinds(vast.op);
}
function openToegangscontrole(clientId){
 var c=findPerson(clientId);if(!c)return;
 var lijst=toegangTotClient(clientId);
 var vast=TOEGANGSCONTROLE[clientId];
 var rijen=lijst.length? lijst.map(function(x){
  return '<div class="personrow" style="padding:10px 0">'+avatarHtml(naam(x.persoon),fotoVan(x.persoon))+
   '<div class="pinfo"><div class="naam">'+esc(naam(x.persoon))+
   (x.actief?'':' <span class="statuschip" style="background:var(--amber-bg);color:var(--amber)">kan niet inloggen</span>')+'</div>'+
   '<div class="mail">'+esc(TYPELABEL[x.persoon.type])+' · '+esc(x.rol)+'</div></div>'+
   '<label class="chip"><input type="checkbox" class="tc-weg" value="'+x.persoon.id+'"> Toegang intrekken</label></div>';
 }).join('') : '<p class="empty-msg">Niemand heeft toegang tot deze cliënt.</p>';
 openModal('<h3>Toegang nalopen: '+esc(naam(c))+'</h3>'+
  '<p class="mini" style="margin:0 0 12px">Klopt het dat deze mensen bij '+esc(naam(c))+' kunnen? Vink aan wie er niet meer bij hoort.'+
  (vast&&vast.op?' Laatst nagelopen op '+esc(datumNL(vast.op))+(vast.door?' door '+esc(vast.door):'')+'.':' Dit is de eerste keer.')+'</p>'+
  '<div class="admreview">'+rijen+'</div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="modal-opslaan">Klopt, vastleggen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var weg=Array.prototype.slice.call(document.querySelectorAll('.tc-weg:checked')).map(function(x){return +x.value;});
  weg.forEach(function(pid){
   var pers=findPerson(pid);
   if(!pers||!pers.clientRechten)return;
   delete pers.clientRechten[clientId];
   if(pers._state!=='nieuw')pers._state='gewijzigd';
  });
  TOEGANGSCONTROLE[clientId]={op:vandaagISO(),door:wieBenIk()};
  logActie('Toegang tot '+naam(c)+' nagelopen'+(weg.length?' — '+weg.length+' recht'+(weg.length===1?'':'en')+' ingetrokken':' — alles klopte'));
  syncOrganisatieData();
  if(weg.length)syncToSupabase();
  closeModal();renderAll();renderControle();
  openMelding('Vastgelegd','De toegangslijst van '+naam(c)+' is nagelopen'+(weg.length?' en '+weg.length+' recht'+(weg.length===1?'':'en')+' ingetrokken.':'.')+' Over '+CONTROLE_MAANDEN+' maanden krijg je hier weer een signaal over.');
 });
}
/* ---- Signalen afhandelen ----
   Een lijst die alleen maar groeit wordt ruis, en dan kijkt niemand er meer
   naar. Wie beoordeelt dat een signaal klopt (een naaste mág bij twee
   cliënten), kan het met een reden afhandelen.
   De vingerafdruk is de tekst van het signaal zelf. Verandert de situatie —
   diezelfde naaste krijgt er een derde cliënt bij — dan verandert de tekst en
   komt het signaal opnieuw. Een oordeel dat blijft plakken terwijl de wereld
   verandert is gevaarlijker dan geen oordeel. */
var beoordeeldeSignalen={};
function signaalSleutel(s){return (s.actie&&s.actie.soort||'')+'|'+(s.actie&&s.actie.id||'')+'|'+s.tekst;}
function isBeoordeeld(s){return !!beoordeeldeSignalen[signaalSleutel(s)];}
function handelSignaalAf(s){
 openModal('<h3>Signaal afhandelen</h3><div class="msec">'+
  '<p>'+esc(s.tekst)+'</p>'+
  '<p>Leg vast waarom dit geen actie nodig heeft. Het signaal verdwijnt uit de lijst, maar komt terug zodra de situatie verandert.</p></div>'+
  '<fieldset class="admblok"><legend>Onderbouwing</legend>'+
  '<div class="admveld"><label for="modal-reden">Reden<span class="verplicht">*</span></label>'+
  '<input class="admin" id="modal-reden" maxlength="160" placeholder="Bijvoorbeeld: broer en zus, toegang is met beide families afgestemd"></div></fieldset>'+
  '<div id="modal-reden-fout" class="mini" style="color:var(--brick)" hidden>Vul een reden in; zonder onderbouwing is afhandelen niet te verantwoorden.</div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="modal-opslaan">Afhandelen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var reden=kap(el('modal-reden').value.trim(),160);
  if(!reden){el('modal-reden-fout').hidden=false;return;}
  beoordeeldeSignalen[signaalSleutel(s)]={reden:reden,door:wieBenIk(),op:vandaagISO()};
  closeModal();
  logActie('Signaal afgehandeld: '+s.tekst+' — '+reden);
  syncOrganisatieData();
  renderControle();
 });
}
function heropenSignaal(s){
 delete beoordeeldeSignalen[signaalSleutel(s)];
 logActie('Signaal weer opengezet: '+s.tekst);
 syncOrganisatieData();
 renderControle();
}
var controleGroepFilter='';
var controleToonBeoordeeld=false;
function renderControle(){
 var alle=controleSignalen();
 var open=alle.filter(function(s){return !isBeoordeeld(s);});
 var hoog=open.filter(function(s){return s.ernst==='hoog';}).length;
 var teller=el('controle-teller');
 if(teller){teller.textContent=open.length?open.length:'';teller.style.color=hoog?'var(--brick)':'var(--ink-faint)';}

 var keuze=el('controle-groep');
 if(keuze){
  var groepen=[''].concat(GROEPEN);
  keuze.innerHTML=groepen.map(function(g){
   return '<option value="'+esc(g)+'"'+(g===controleGroepFilter?' selected':'')+'>'+(g?esc(g):'Alle groepen')+'</option>';
  }).join('');
 }
 var vinkje=el('controle-toon-beoordeeld');
 if(vinkje)vinkje.checked=controleToonBeoordeeld;

 var signalen=(controleToonBeoordeeld?alle:open).filter(function(s){
  return !controleGroepFilter||String(s.groep||'').indexOf(controleGroepFilter)>-1;
 });
 var afgehandeld=alle.length-open.length;
 el('controle-lijst').innerHTML=signalen.length?signalen.map(function(s,i){
  var af=isBeoordeeld(s);
  var kleur=af?'var(--ink-faint)':(s.ernst==='hoog'?'var(--brick)':'var(--amber)');
  var label=af?'Afgehandeld':(s.ernst==='hoog'?'Actie nodig':'Aandachtspunt');
  var oordeel=af?beoordeeldeSignalen[signaalSleutel(s)]:null;
  return '<div class="personrow"'+(af?' style="opacity:.62"':'')+'>'+
   '<div class="pinfo"><div class="naam"><span class="statuschip" style="background:transparent;color:'+kleur+';border:1px solid '+kleur+'">'+label+'</span> '+esc(s.tekst)+'</div>'+
   '<div class="mail">'+esc(s.groep)+
    (oordeel?' · '+esc(oordeel.reden)+' <span class="mini">('+esc(oordeel.door)+', '+esc(datumNL(oordeel.op))+')</span>':'')+'</div></div>'+
   (af?'<button type="button" class="small" data-heropen="'+i+'">Weer openzetten</button>'
      :'<button type="button" class="small" data-afhandel="'+i+'">Dit klopt</button>'+
       '<button type="button" class="small" data-ctrl="'+i+'">'+esc(s.actie.label)+'</button>')+
   '</div>';
 }).join('')
  :'<p class="empty-msg">'+(controleGroepFilter?'Geen signalen voor deze groep.':'Geen signalen — alles ziet er goed uit.')+
   (afgehandeld&&!controleToonBeoordeeld?' <span class="mini">('+afgehandeld+' afgehandeld, zet het vinkje aan om ze te zien.)</span>':'')+'</p>';
 if(afgehandeld&&!controleToonBeoordeeld&&signalen.length){
  el('controle-lijst').insertAdjacentHTML('beforeend',
   '<p class="mini" style="margin:8px 0 0">'+afgehandeld+' signaal'+(afgehandeld===1?'':'en')+' afgehandeld en daarom verborgen.</p>');
 }
 Array.prototype.forEach.call(el('controle-lijst').querySelectorAll('[data-afhandel]'),function(b){
  b.addEventListener('click',function(){handelSignaalAf(signalen[+b.getAttribute('data-afhandel')]);});
 });
 Array.prototype.forEach.call(el('controle-lijst').querySelectorAll('[data-heropen]'),function(b){
  b.addEventListener('click',function(){heropenSignaal(signalen[+b.getAttribute('data-heropen')]);});
 });
 Array.prototype.forEach.call(el('controle-lijst').querySelectorAll('[data-ctrl]'),function(b){
  b.addEventListener('click',function(){
   var s=signalen[+b.getAttribute('data-ctrl')];if(!s)return;
   huidigeGroep=s.actie.groep;
   verversGroepReferenties();renderAll();
   /* Het nalopen van de toegang doe je vanuit het controlescherm zelf; daarvoor
      hoef je niet eerst naar het groepsprofiel. */
   if(s.actie.soort==='toegangscontrole'){openToegangscontrole(s.actie.client);return;}
   if(s.actie.soort==='herstellen'){toonBeheerArchief(s.actie.groep,s.actie.herstel);return;}
   /* Eerst openen, dan pas van weergave wisselen: zo weet het profiel dat het
      vanuit de Admin Tools kwam en keert het na opslaan daarheen terug. */
   if(s.actie.soort==='client')openProfielClient(s.actie.id);
   else if(s.actie.soort==='persoon')openProfielPersoon(s.actie.id,s.actie.type);
   else if(s.actie.soort==='archief'){renderGearchiveerd();show('pp-gearchiveerd');}
   else show('pp-formulier');
   showView('personal');
  });
 });
}
el('controle-ververs').addEventListener('click',renderControle);
el('controle-groep').addEventListener('change',function(){controleGroepFilter=this.value;renderControle();});
el('controle-toon-beoordeeld').addEventListener('change',function(){controleToonBeoordeeld=this.checked;renderControle();});

/* ============== ZOEKEN OVER ALLE GROEPEN ==============
   Het zoekveld binnen een groep kijkt bewust alleen in die groep. Daardoor was
   er geen manier om iemand terug te vinden als je niet wist waar die zat, of om
   te zien of een vertrokken medewerker ergens nog toegang heeft. */
var zoekAllesTerm='',zoekAllesArchief=false;
function zoekResultaten(){
 var term=zoekAllesTerm.trim().toLowerCase();
 if(term.length<2)return null;
 return people.filter(function(p){
  if(p.archived&&!zoekAllesArchief)return false;
  return naam(p).toLowerCase().indexOf(term)>-1||String(p.mail||'').toLowerCase().indexOf(term)>-1;
 }).sort(function(a,b){return naam(a).localeCompare(naam(b));});
}
function renderZoeken(){
 var veld=el('zoek-alles');
 if(veld&&veld.value!==zoekAllesTerm)veld.value=zoekAllesTerm;
 var vinkje=el('zoek-archief');
 if(vinkje)vinkje.checked=zoekAllesArchief;
 var res=zoekResultaten();
 var doel=el('zoek-resultaat');
 if(res===null){
  el('zoek-sub').textContent='Over alle groepen heen';
  doel.innerHTML='<p class="empty-msg">Typ minstens twee letters om te zoeken.</p>';
  return;
 }
 el('zoek-sub').textContent=res.length+' resultaat'+(res.length===1?'':'en');
 if(!res.length){
  doel.innerHTML='<p class="empty-msg">Niemand gevonden voor "'+esc(zoekAllesTerm)+'".</p>';
  return;
 }
 doel.innerHTML=res.map(function(p,i){
  var groepen=(p.groepen||[]).length?esc(p.groepen.join(', ')):'geen groep';
  var chips=(p.archived?' <span class="statuschip" style="background:var(--paper);color:var(--ink-soft)">Gearchiveerd</span>':'')+
   toegangChip(p)+
   (p.contactVolgorde?' <span class="countchip" style="color:var(--accent)">Contactpersoon '+p.contactVolgorde+'</span>':'');
  return '<div class="personrow">'+avatarHtml(naam(p),fotoVan(p))+
   '<div class="pinfo"><div class="naam">'+esc(naam(p))+chips+'</div>'+
   '<div class="mail">'+esc(TYPELABEL[p.type])+' · '+groepen+(p.mail?' · '+esc(p.mail):'')+'</div></div>'+
   (p.archived?'':'<button type="button" class="small" data-zoekga="'+i+'">Openen</button>')+
   '</div>';
 }).join('');
 Array.prototype.forEach.call(doel.querySelectorAll('[data-zoekga]'),function(b){
  b.addEventListener('click',function(){
   var p=res[+b.getAttribute('data-zoekga')];if(!p)return;
   /* Spring naar de groep waar deze persoon in zit, anders open je een profiel
      in een groep waar hij niet bestaat. */
   var groep=(p.groepen||[]).indexOf(huidigeGroep)>-1?huidigeGroep:(p.groepen||[])[0];
   if(!groep){openMelding('Geen groep',naam(p)+' zit in geen enkele groep en heeft dus geen profiel om te openen.');return;}
   huidigeGroep=groep;
   verversGroepReferenties();renderAll();
   if(p.type==='client')openProfielClient(p.id); else openProfielPersoon(p.id,p.type);
   showView('personal');
  });
 });
}
/* ============== DATALEKREGISTER (AVG art. 33 en 34) ==============
   Een zorgorganisatie moet elke inbreuk vastleggen, ook als die niet wordt
   gemeld. De 72-uurstermijn begint bij ontdekking, niet bij het incident zelf;
   daarom rekent het scherm die termijn voor. */
var DATALEKKEN=[];
async function laadDatalekken(){
 if(!sb)return;
 try{
  var res=await sb.from('datalekken').select('*').order('gemeld_op',{ascending:false}).limit(100);
  if(res.error||!res.data)return;
  DATALEKKEN=res.data.map(function(r){
   return {id:r.id,ontdekt:String(r.ontdekt_op||'').slice(0,10),omschrijving:r.omschrijving||'',
    betrokkenen:r.betrokkenen||'',maatregelen:r.maatregelen||'',
    gemeldBijAp:!!r.gemeld_bij_ap,betrokkenenGeinformeerd:!!r.betrokkenen_geinformeerd,
    afgehandeld:!!r.afgehandeld,wie:r.wie||''};
  });
  if(!el('admintab-datalek').hidden)renderDatalekken();
  zetDatalekTeller();
 }catch(e){/* het register mag de app nooit blokkeren */}
}
function bewaarDatalek(lek){
 if(!sb)return Promise.resolve(false);
 if(opslagGeblokkeerd())return Promise.resolve(false);
 var rij={ontdekt_op:lek.ontdekt,omschrijving:lek.omschrijving,betrokkenen:lek.betrokkenen,
  maatregelen:lek.maatregelen,gemeld_bij_ap:lek.gemeldBijAp,afgehandeld:lek.afgehandeld,wie:lek.wie,
  betrokkenen_geinformeerd:!!lek.betrokkenenGeinformeerd};
 if(lek.id)rij.id=lek.id;
 try{
  return sb.from('datalekken').upsert([rij],{onConflict:'id'}).select('id').then(function(res){
   if(res&&res.data&&res.data[0])lek.id=res.data[0].id;
   return !(res&&res.error);
  },function(){return false;});
 }catch(e){return Promise.resolve(false);}
}
/* Uren sinds de ontdekking; de AP-termijn is 72 uur. De datum heeft geen tijd,
   dus we rekenen vanaf het begin van die dag — de veilige kant. */
function urenSindsOntdekking(lek){
 if(!geldigeDatum(lek.ontdekt))return null;
 return Math.floor((new Date()-new Date(lek.ontdekt+'T00:00:00'))/3600000);
}
function datalekOpen(lek){return !lek.afgehandeld;}
function zetDatalekTeller(){
 var t=el('datalek-teller');if(!t)return;
 var n=DATALEKKEN.filter(datalekOpen).length;
 t.textContent=n?String(n):'';
}
function renderDatalekken(){
 zetDatalekTeller();
 var doel=el('datalek-lijst');if(!doel)return;
 if(!DATALEKKEN.length){
  doel.innerHTML='<p class="empty-msg">Nog geen datalekken vastgelegd. Dat is goed nieuws, maar leg ook kleine incidenten vast: het register moet compleet zijn.</p>';
  return;
 }
 doel.innerHTML=DATALEKKEN.map(function(lek,i){
  var uren=urenSindsOntdekking(lek);
  var chip='';
  if(lek.afgehandeld){
   chip='<span class="statuschip" style="background:var(--moss-bg);color:var(--moss)">Afgehandeld</span>';
  }else if(lek.gemeldBijAp){
   chip='<span class="statuschip" style="background:var(--accent-bg);color:var(--accent)">Gemeld bij de AP'+(lek.betrokkenenGeinformeerd?' en aan de betrokkenen':'')+'</span>';
  }else if(uren!==null&&uren>72){
   chip='<span class="statuschip" style="background:var(--brick-bg);color:var(--brick)">72 uur verstreken</span>';
  }else if(uren!==null){
   chip='<span class="statuschip" style="background:var(--amber-bg);color:var(--amber)">Nog '+Math.max(0,72-uren)+' uur om te melden</span>';
  }
  return '<div class="personrow" style="align-items:flex-start">'+
   '<div class="pinfo"><div class="naam">'+esc(lek.omschrijving)+' '+chip+'</div>'+
   '<div class="mail">Ontdekt op '+esc(datumNL(lek.ontdekt))+
    (lek.betrokkenen?' · '+esc(lek.betrokkenen):'')+
    (lek.wie?' · vastgelegd door '+esc(lek.wie):'')+'</div>'+
    (lek.maatregelen?'<div class="mini">Maatregelen: '+esc(lek.maatregelen)+'</div>':'')+'</div>'+
   '<button type="button" class="small" data-lek="'+i+'">Bewerken</button></div>';
 }).join('');
 Array.prototype.forEach.call(doel.querySelectorAll('[data-lek]'),function(b){
  b.addEventListener('click',function(){openDatalekVenster(DATALEKKEN[+b.getAttribute('data-lek')]);});
 });
}
function openDatalekVenster(bestaand){
 var lek=bestaand||{ontdekt:vandaagISO(),omschrijving:'',betrokkenen:'',maatregelen:'',gemeldBijAp:false,betrokkenenGeinformeerd:false,afgehandeld:false,wie:wieBenIk()};
 var uren=urenSindsOntdekking(lek);
 var termijn=bestaand&&uren!==null
  ? (uren>72?'<p style="color:var(--brick)">Er zijn '+uren+' uur verstreken sinds de ontdekking. De termijn van 72 uur is voorbij; leg vast waarom er niet (op tijd) is gemeld.</p>'
           :'<p>Er '+(uren===1?'is':'zijn')+' '+uren+' uur verstreken. Melden bij de AP kan nog '+(72-uren)+' uur.</p>')
  : '<p>De termijn van 72 uur voor een melding bij de Autoriteit Persoonsgegevens begint op het moment dat je het lek ontdekt.</p>';
 openModal('<h3>'+(bestaand?'Datalek bewerken':'Datalek vastleggen')+'</h3>'+
  '<div class="msec">'+termijn+'</div>'+
  '<fieldset class="admblok"><legend>Het incident</legend>'+
   '<div class="admveld"><label for="lek-ontdekt">Ontdekt op<span class="verplicht">*</span></label>'+
    '<input class="admin" type="date" id="lek-ontdekt" value="'+esc(lek.ontdekt)+'"></div>'+
   '<div class="admveld"><label for="lek-wat">Wat is er gebeurd<span class="verplicht">*</span></label>'+
    '<input class="admin" id="lek-wat" maxlength="200" value="'+esc(lek.omschrijving)+'" placeholder="Bijvoorbeeld: e-mail met cliëntgegevens naar verkeerde ontvanger"></div>'+
   '<div class="admveld"><label for="lek-wie">Wie is het betrokken</label>'+
    '<input class="admin" id="lek-wie" maxlength="200" value="'+esc(lek.betrokkenen)+'" placeholder="Bijvoorbeeld: 3 cliënten van De Boomgaard"></div>'+
  '</fieldset>'+
  '<fieldset class="admblok"><legend>Afhandeling</legend>'+
   '<div class="admveld"><label for="lek-maatregelen">Genomen maatregelen</label>'+
    '<input class="admin" id="lek-maatregelen" maxlength="200" value="'+esc(lek.maatregelen)+'" placeholder="Bijvoorbeeld: ontvanger heeft de mail verwijderd, toegang geblokkeerd"></div>'+
   '<label class="chip" style="margin:2px 6px 8px 0"><input type="checkbox" id="lek-ap" '+(lek.gemeldBijAp?'checked':'')+'> Gemeld bij de Autoriteit Persoonsgegevens</label>'+
   '<label class="chip" style="margin:2px 6px 8px 0"><input type="checkbox" id="lek-betrokkenen" '+(lek.betrokkenenGeinformeerd?'checked':'')+'> Betrokkenen zelf geïnformeerd</label>'+
   '<label class="chip" style="margin:2px 0 8px"><input type="checkbox" id="lek-klaar" '+(lek.afgehandeld?'checked':'')+'> Afgehandeld</label>'+
  '</fieldset>'+
  '<p class="mini" style="margin:0 0 8px">Bij een lek met een hoog risico voor de betrokkenen moeten zij zelf ook worden geïnformeerd (AVG art. 34), niet alleen de Autoriteit Persoonsgegevens.</p>'+
  '<div id="lek-fout" class="mini" style="color:var(--brick)" hidden>Vul in wat er is gebeurd en wanneer je het hebt ontdekt, met een datum die niet in de toekomst ligt.</div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var wat=kap(el('lek-wat').value.trim(),200),ontdekt=el('lek-ontdekt').value;
  /* Een ontdekkingsdatum in de toekomst zou de 72-uurstermijn onzin maken. */
  if(!wat||!geldigeDatum(ontdekt)||ontdekt>vandaagISO()){el('lek-fout').hidden=false;return;}
  lek.omschrijving=wat;lek.ontdekt=ontdekt;
  lek.betrokkenen=kap(el('lek-wie').value.trim(),200);
  lek.maatregelen=kap(el('lek-maatregelen').value.trim(),200);
  var wasGemeld=lek.gemeldBijAp,wasGeinformeerd=lek.betrokkenenGeinformeerd;
  lek.gemeldBijAp=el('lek-ap').checked;
  lek.betrokkenenGeinformeerd=el('lek-betrokkenen').checked;
  lek.afgehandeld=el('lek-klaar').checked;
  if(!bestaand){lek.wie=wieBenIk();DATALEKKEN.unshift(lek);}
  closeModal();
  logActie(bestaand?('Datalek bijgewerkt: '+wat):('Datalek vastgelegd: '+wat));
  if(!wasGemeld&&lek.gemeldBijAp)logActie('Datalek gemeld bij de Autoriteit Persoonsgegevens: '+wat);
  if(!wasGeinformeerd&&lek.betrokkenenGeinformeerd)logActie('Betrokkenen geïnformeerd over datalek: '+wat);
  /* Een datalekmelding heeft een wettelijke termijn van 72 uur; mislukt het
     opslaan, dan moet dat zichtbaar zijn en niet stil verdwijnen. */
  bewaarDatalek(lek).then(function(ok){
   if(!ok&&nogTeVersturen.datalek.indexOf(lek)<0)nogTeVersturen.datalek.push(lek);
   registreerOpslag('datalek',ok);
  });
  renderDatalekken();
 });
}
el('datalek-nieuw').addEventListener('click',function(){openDatalekVenster(null);});

/* ============== VERWERKINGSREGISTER (AVG art. 30) ==============
   Zo'n register wordt meestal los in een document bijgehouden en loopt daardoor
   achter op de werkelijkheid. Hier komt het uit de app zelf: de aantallen en de
   bewaartermijn zijn wat er nu echt is ingesteld. */
function registerRegels(){
 var tel=function(t){return people.filter(function(p){return p.type===t&&!p.archived;}).length;};
 var gearchiveerd=people.filter(function(p){return p.archived;}).length;
 var metFoto=people.filter(function(p){return !!p.foto;}).length;
 var zonderToestemming=people.filter(function(p){return p.type==='client'&&!p.archived&&!toestemmingVan(p).vastgelegdOp;}).length;
 return [
  {verwerking:'Gebruikersbeheer en toegangsrechten',
   doel:'Bepalen wie welke cliëntgegevens mag inzien en wijzigen, en dat kunnen verantwoorden.',
   grondslag:'Noodzakelijk voor de uitvoering van de zorgovereenkomst en een wettelijke plicht tot zorgvuldige toegangsbeveiliging.',
   betrokkenen:tel('client')+' cliënten, '+tel('medewerker')+' medewerkers, '+tel('naaste')+' naasten, verdeeld over '+GROEPEN.length+' groepen',
   gegevens:'Naam, e-mailadres, telefoonnummer, groepskoppeling, rol en toegangsrechten, einddatum van de toegang, laatste gebruik',
   bewaartermijn:'Actief zolang de betrokkene aan een groep is gekoppeld; daarna '+bewaartermijnTekst()+' in het archief',
   ontvangers:'Alleen medewerkers en naasten met een rol binnen dezelfde groep'},
  {verwerking:'Cliëntdossier in de MyWepp-app',
   doel:'Doelen, rapportages, agenda, ik-boek en geheugensteuntjes vastleggen en delen met de betrokkenen.',
   grondslag:'Uitvoering van de zorgovereenkomst; voor beeldmateriaal aanvullend de toestemming van de cliënt of zijn vertegenwoordiger.',
   betrokkenen:tel('client')+' cliënten',
   gegevens:'Gezondheids- en begeleidingsgegevens, agenda-afspraken, foto\'s en video\'s, spraakberichten',
   bewaartermijn:'Volgt de bewaartermijn van het cliëntdossier van de organisatie',
   ontvangers:'Medewerkers en naasten met een rol op deze cliënt'},
  {verwerking:'Beeldmateriaal en profielfoto\'s',
   doel:'Herkenbaarheid in de app en beeld bij rapportages.',
   grondslag:'Toestemming (art. 6 lid 1 sub a). Zonder vastgelegde toestemming toont MyWepp geen foto.',
   betrokkenen:metFoto+' personen met een opgeslagen foto'+(zonderToestemming?'; van '+zonderToestemming+' cliënt(en) is nog geen toestemming vastgelegd':''),
   gegevens:'Profielfoto, foto\'s en video\'s in het dossier',
   bewaartermijn:'Tot de toestemming wordt ingetrokken of de betrokkene wordt gewist',
   ontvangers:'Zie cliëntdossier'},
  {verwerking:'Onderlinge berichten',
   doel:'Communicatie tussen cliënt, naasten en medewerkers.',
   grondslag:'Uitvoering van de zorgovereenkomst.',
   betrokkenen:'Deelnemers per gesprek',
   gegevens:'Berichtteksten, afzender en tijdstip',
   bewaartermijn:'Zolang het gesprek bestaat',
   ontvangers:'Alleen de deelnemers aan het betreffende gesprek'},
  {verwerking:'Logboek en verantwoording',
   doel:'Kunnen aantonen wie wanneer een wijziging in rechten of gegevens heeft gedaan (art. 5 lid 2).',
   grondslag:'Wettelijke verplichting; gerechtvaardigd belang bij controle op misbruik.',
   betrokkenen:'Iedereen die met de beheeromgeving werkt',
   gegevens:'Naam van de uitvoerder, groep, tijdstip en omschrijving van de handeling',
   bewaartermijn:'Blijft ook na een verwijderverzoek bestaan; wordt niet gewist',
   ontvangers:'Beheerders en de systeembeheerder'},
  {verwerking:'Archief van vertrokken betrokkenen',
   doel:'Terug kunnen halen wie er is geweest en welke toegang die had.',
   grondslag:'Gerechtvaardigd belang; daarna opslagbeperking (art. 5 lid 1 sub e).',
   betrokkenen:gearchiveerd+' gearchiveerde personen',
   gegevens:'Dezelfde gegevens als bij gebruikersbeheer, plus de datum van archivering',
   bewaartermijn:bewaartermijnTekst()+' na archivering; daarna meldt de controle dat wissen nodig is',
   ontvangers:'Beheerders van de betreffende groep'}
 ];
}
var REGISTERKOPPEN=[['verwerking','Verwerking'],['doel','Doel'],['grondslag','Grondslag'],
 ['betrokkenen','Betrokkenen'],['gegevens','Soort gegevens'],['bewaartermijn','Bewaartermijn'],['ontvangers','Wie kan erbij']];
function renderVerwerkingsregister(){
 var doel=el('register-lijst');if(!doel)return;
 doel.innerHTML=registerRegels().map(function(r){
  return '<div class="msec" style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px">'+
   '<b style="font-size:14px;display:block;margin-bottom:6px">'+esc(r.verwerking)+'</b>'+
   REGISTERKOPPEN.slice(1).map(function(k){
    return '<div style="display:flex;gap:10px;padding:3px 0;font-size:13px">'+
     '<span style="flex:0 0 130px;color:var(--ink-soft)">'+esc(k[1])+'</span>'+
     '<span style="flex:1;min-width:0;overflow-wrap:break-word">'+esc(r[k[0]])+'</span></div>';
   }).join('')+'</div>';
 }).join('');
}
el('register-export').addEventListener('click',function(){
 bevestigExport('register','het verwerkingsregister met de aantallen betrokkenen per verwerking',function(){
  var regels=[REGISTERKOPPEN.map(function(k){return k[1];}).map(csvVeld).join(';')];
  registerRegels().forEach(function(r){
   regels.push(REGISTERKOPPEN.map(function(k){return r[k[0]];}).map(csvVeld).join(';'));
  });
  downloadCsv(regels,'mywepp-verwerkingsregister');
  logActie('Verwerkingsregister geëxporteerd');
 });
});

el('zoek-alles').addEventListener('input',function(){zoekAllesTerm=this.value;renderZoeken();});
el('zoek-archief').addEventListener('change',function(){zoekAllesArchief=this.checked;renderZoeken();});

/* ============== WIE ZIET WIE ==============
   "Welke medewerker kan bij welke cliënt?" is bij een overdracht of een
   AVG-vraag steeds opnieuw uitzoekwerk, omdat de rechten per persoon verspreid
   staan. Hier staan ze in één raster, en direct aanpasbaar. */
var matrixGroep=null;
/* "Wie ziet wie" liet alleen medewerkers zien. Maar een mantelzorger met
   prikbord kijkt net zo goed in het dossier van een cliënt, dus als antwoord op
   de vraag wie er bij iemand kan was dit scherm onvolledig. */
function matrixPersonen(groep){
 return people.filter(function(p){
  return (p.type==='medewerker'||p.type==='naaste')&&!p.archived&&p._state!=='verwijderd'&&p.groepen.indexOf(groep)>-1;
 }).sort(function(a,b){
  if(a.type!==b.type)return a.type==='medewerker'?-1:1;
  return naam(a).localeCompare(naam(b));
 });
}
function matrixClienten(groep){
 return people.filter(function(p){return p.type==='client'&&!p.archived&&p._state!=='verwijderd'&&p.groepen.indexOf(groep)>-1;});
}
function renderMatrix(){
 if(!matrixGroep||GROEPEN.indexOf(matrixGroep)<0)matrixGroep=huidigeGroep;
 el('matrix-groep').innerHTML=GROEPEN.map(function(g){
  return '<option'+(g===matrixGroep?' selected':'')+'>'+esc(g)+'</option>';
 }).join('');
 var betrokkenen=matrixPersonen(matrixGroep),clienten=matrixClienten(matrixGroep);
 var aantalMw=betrokkenen.filter(function(p){return p.type==='medewerker';}).length;
 var aantalNa=betrokkenen.length-aantalMw;
 el('matrix-sub').textContent=aantalMw+' medewerker'+(aantalMw===1?'':'s')+' en '+aantalNa+' naaste'+(aantalNa===1?'':'n')+' × '+clienten.length+' cliënt'+(clienten.length===1?'':'en');
 if(!betrokkenen.length||!clienten.length){
  el('matrix-inhoud').innerHTML='<p class="empty-msg">'+
   (!clienten.length?'Geen cliënten in deze groep.':'Geen medewerkers of naasten in deze groep.')+'</p>';
  return;
 }
 var html='<div class="matrixwrap"><table class="matrix"><thead><tr><th>Wie</th>'+
  clienten.map(function(c){return '<th>'+esc(naam(c))+'</th>';}).join('')+'</tr></thead><tbody>';
 betrokkenen.forEach(function(m){
  /* Elk type heeft zijn eigen rollenlijst; een naaste is geen medewerker. */
  var rollen=ROLLEN[m.type].clienten.filter(function(r){return r!=='Geen';});
  /* Een rol op papier zegt niets als het account geblokkeerd of verlopen is.
     Dit scherm hoort te laten zien wie er nu echt bij kan. */
  var kanInloggen=heeftToegang(m);
  var reden=m.geblokkeerd?'geblokkeerd':(toegangVerlopen(m)?'verlopen':'geen toegang');
  html+='<tr><th>'+esc(naam(m))+' <span class="mini">· '+esc(m.type==='medewerker'?'medewerker':'naaste')+'</span>'+
   (kanInloggen?'':' <span class="statuschip" style="background:var(--amber-bg);color:var(--amber)" title="Deze persoon kan op dit moment niet inloggen">'+reden+'</span>')+'</th>'+
   clienten.map(function(c){
   var huidig=rolOpClient(m,c.id)||'';
   return '<td><select data-mx="'+m.id+'|'+c.id+'" aria-label="Rol van '+esc(naam(m))+' op '+esc(naam(c))+'" class="'+(huidig?'':'geen')+'">'+
    '<option value="">Geen toegang</option>'+
    rollen.map(function(r){return '<option'+(r===huidig?' selected':'')+'>'+esc(r)+'</option>';}).join('')+
    '</select></td>';
  }).join('')+'</tr>';
 });
 html+='</tbody></table></div>';
 el('matrix-inhoud').innerHTML=html;
 Array.prototype.forEach.call(el('matrix-inhoud').querySelectorAll('[data-mx]'),function(sel){
  sel.addEventListener('change',function(){
   var delen=sel.getAttribute('data-mx').split('|');
   var m=findPerson(+delen[0]),c=findPerson(+delen[1]);
   if(!m||!c)return;
   m.clientRechten=m.clientRechten||{};
   if(sel.value)m.clientRechten[c.id]=sel.value; else delete m.clientRechten[c.id];
   if(m._state!=='nieuw')m._state='gewijzigd';
   sel.className=sel.value?'':'geen';
   logActie(sel.value
    ? naam(m)+' kreeg rol "'+sel.value+'" op cliënt '+naam(c)
    : 'Toegang van '+naam(m)+' tot cliënt '+naam(c)+' ingetrokken');
   updateTally();renderAcc(m.type);
  });
 });
}
el('matrix-groep').addEventListener('change',function(){matrixGroep=this.value;renderMatrix();});
el('matrix-export').addEventListener('click',function(){
 var medewerkers=matrixPersonen(matrixGroep),clienten=matrixClienten(matrixGroep);
 if(!medewerkers.length||!clienten.length)return;
 bevestigExport('toegang','wie toegang heeft tot welke cliënt in '+matrixGroep,function(){exporteerMatrixNu(medewerkers,clienten);});
});
function exporteerMatrixNu(medewerkers,clienten){
 var regels=[['Wie','Soort','Kan inloggen'].concat(clienten.map(naam)).map(csvVeld).join(';')];
 medewerkers.forEach(function(m){
  regels.push([naam(m),TYPELABEL[m.type],heeftToegang(m)?'ja':'nee']
   .concat(clienten.map(function(c){return rolOpClient(m,c.id)||'Geen toegang';})).map(csvVeld).join(';'));
 });
 downloadCsv(regels,'mywepp-toegang-'+matrixGroep.replace(/[^a-z0-9]+/gi,'-').toLowerCase());
 logActie('Toegangsoverzicht van '+matrixGroep+' geëxporteerd');
}

/* De hele administratie in één bestand. De matrix-export gaat per groep over
   toegang tot cliënten; dit gaat over de mensen zelf, over alle groepen heen. */
function telRechten(p){
 return ['clientRechten','medewerkerRechten','naasteRechten'].reduce(function(n,veld){
  return n+Object.keys(p[veld]||{}).length;
 },0);
}
function exporteerIedereen(){
 var kop=['Naam','Type','Groepen','Algemene rol','E-mailadres','Telefoon','Contactpersoon','Status',
          'Toegang tot','Toegang verlopen','Geblokkeerd','Tweestapsverificatie','Laatst gebruikt','Aantal rechten','Gearchiveerd'];
 var regels=[kop.map(csvVeld).join(';')];
 people.slice().sort(function(a,b){
  return (a.type+naam(a)).localeCompare(b.type+naam(b));
 }).forEach(function(p){
  regels.push([
   naam(p),TYPELABEL[p.type],(p.groepen||[]).join(', '),
   p.type==='client'?'':globaleRolVoor(p),
   p.mail||'',p.tel||'',
   p.contactVolgorde?('Contactpersoon '+p.contactVolgorde):'',
   p.status||'',
   geldigeDatum(p.toegangTot)?datumNL(p.toegangTot):'',
   toegangVerlopen(p)?'ja':'nee',
   p.geblokkeerd?'ja':'nee',
   p.type==='client'?'':(p.tweestaps?'aan':'uit'),
   geldigeDatum(p.laatsteLogin)?datumNL(p.laatsteLogin):'',
   telRechten(p),
   p.archived?'ja':'nee'
  ].map(csvVeld).join(';'));
 });
 downloadCsv(regels,'mywepp-gebruikers');
 logActie('Volledige gebruikersexport gemaakt ('+people.length+' personen)');
}
el('export-iedereen').addEventListener('click',function(){
 bevestigExport('gebruikers','de volledige gebruikersadministratie van alle '+GROEPEN.length+' groepen ('+people.length+' personen)',exporteerIedereen);
});

/* ============== ADMIN-KNOPPENBALK (uitbreiding op Admin Tools) ============== */
/* ---- Zoeken in een lijst met rijen ----
   Voor lijsten die op het scherm blijven staan (het groepsbeheer). Keuzes
   maken gaat via de zoekkeuze hieronder. Zonder accenten en hoofdletters
   vergelijken, want "Özdemir" moet ook op "ozdemir" gevonden worden. */
function zoekTekst(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function koppelZoekveld(input,doel,opties){
 opties=opties||{};
 if(!input||!doel)return function(){};
 var leeg=document.createElement('p');
 leeg.className='empty-msg zoek-leeg';leeg.hidden=true;
 leeg.textContent=opties.leegTekst||'Niets gevonden.';
 doel.appendChild(leeg);
 function filter(){
  var q=zoekTekst(input.value),n=0;
  Array.prototype.forEach.call(doel.querySelectorAll(opties.itemSelector||'[data-zoek]'),function(it){
   var bron=it.getAttribute('data-zoek')||(it.querySelector('.naam')||it).textContent;
   var ok=!q||zoekTekst(bron).indexOf(q)>-1;
   it.hidden=!ok;if(ok)n++;
  });
  leeg.hidden=n>0;
 }
 /* De lijst wordt telkens opnieuw opgebouwd en koppelt dan opnieuw; de oude
    filter moet er dan af, anders draaien er straks tien tegelijk. */
 if(input._zoekFilter)input.removeEventListener('input',input._zoekFilter);
 input._zoekFilter=filter;
 input.addEventListener('input',filter);
 return filter;
}
/* ---- Zoekkeuze: één veld om te typen, met een lijst eronder die meeverandert ----
   Eerst waren dat twee dingen (een zoekveld en een los keuzemenu). De lijst
   toont naast de naam ook een detail (e-mailadres en groep, of de locatie
   van een groep): bij twee mensen met dezelfde naam zie je zo welke je kiest.
   Veiligheid bij naamgenoten: na het typen is er alleen vanzelf een keuze als
   er precies één treffer is. Zijn het er meer, dan moet je er zelf één
   aanklikken; tot die tijd staat de knop om door te gaan uit.
   items: [{waarde,label,detail}] · opties: {start, naKeuze(waarde)} */
function zoekKeuzeHtml(id,placeholder){
 var ph=placeholder||'Typ om te zoeken…';
 return '<div class="combo" id="'+id+'">'+
  '<div class="combo-veld"><input type="text" class="admin combo-invoer" id="'+id+'-zoek" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="'+id+'-lijst" autocomplete="off" placeholder="'+esc(ph)+'">'+
  '<div class="combo-lijst" id="'+id+'-lijst" role="listbox" hidden></div></div>'+
  '<p class="mini combo-hint" id="'+id+'-hint" hidden></p></div>';
}
function koppelZoekKeuze(id,items,opties){
 opties=opties||{};
 var invoer=el(id+'-zoek'),lijst=el(id+'-lijst'),hint=el(id+'-hint');
 var gekozen=null,treffers=items.slice(),hl=0;
 var itemVan=function(w){return items.filter(function(x){return x.waarde===w;})[0]||null;};
 var aantalMetLabel=function(label){return items.filter(function(x){return x.label===label;}).length;};
 function zetHint(tekst,fout){hint.textContent=tekst||'';hint.hidden=!tekst;hint.classList.toggle('fout',!!fout);}
 function toonGekozen(){
  var it=itemVan(gekozen);
  /* Het detail van de keuze blijft zichtbaar, zodat je ook na het sluiten
     van de lijst ziet wélke Sofie Mulder je hebt. */
  if(it)zetHint(it.detail?('Gekozen: '+it.label+' · '+it.detail):'',false);
 }
 function teken(){
  lijst.innerHTML=treffers.map(function(it,i){
   var dubbel=aantalMetLabel(it.label)>1;
   return '<button type="button" class="combo-optie'+(i===hl?' hl':'')+'" role="option" data-idx="'+i+'" aria-selected="'+(it.waarde===gekozen)+'">'+
    esc(it.label)+(dubbel?' <span class="statuschip">zelfde naam</span>':'')+
    (it.detail?'<span class="combo-detail">'+esc(it.detail)+'</span>':'')+'</button>';
  }).join('');
  Array.prototype.forEach.call(lijst.querySelectorAll('.combo-optie'),function(b){
   /* mousedown in plaats van click: anders sluit de blur van het invoerveld
      de lijst voordat de klik aankomt. */
   b.addEventListener('mousedown',function(e){e.preventDefault();kies(treffers[+b.getAttribute('data-idx')]);});
  });
 }
 function open(){lijst.hidden=!treffers.length;invoer.setAttribute('aria-expanded',String(!lijst.hidden));}
 function sluit(){lijst.hidden=true;invoer.setAttribute('aria-expanded','false');}
 function kies(it){
  if(!it)return;
  gekozen=it.waarde;invoer.value=it.label;
  sluit();toonGekozen();
  if(opties.naKeuze)opties.naKeuze(gekozen);
 }
 function filter(){
  var q=zoekTekst(invoer.value);
  treffers=items.filter(function(it){return !q||zoekTekst(it.label+' '+(it.detail||'')).indexOf(q)>-1;});
  hl=0;
  gekozen=treffers.length===1?treffers[0].waarde:null;
  teken();open();
  if(!treffers.length)zetHint(opties.leegTekst||'Niets gevonden.',true);
  else if(gekozen===null)zetHint('Meerdere treffers — klik de juiste aan.',false);
  else toonGekozen();
  if(opties.naKeuze)opties.naKeuze(gekozen);
 }
 invoer.addEventListener('input',filter);
 /* Openen bij focus én bij klikken: het venster zet de cursor bij het openen
    al in dit veld, en een klik in een veld dat al actief is geeft geen nieuwe
    focus — dan zou de lijst dicht blijven. */
 function openVol(){if(!lijst.hidden)return;invoer.select();treffers=items.slice();hl=0;teken();open();}
 invoer.addEventListener('focus',openVol);
 invoer.addEventListener('click',openVol);
 invoer.addEventListener('blur',function(){
  sluit();
  var it=itemVan(gekozen);
  if(it)invoer.value=it.label;
 });
 invoer.addEventListener('keydown',function(e){
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();
   if(lijst.hidden){open();return;}
   hl=Math.max(0,Math.min(treffers.length-1,hl+(e.key==='ArrowDown'?1:-1)));teken();
   var h=lijst.querySelector('.hl');if(h&&h.scrollIntoView)h.scrollIntoView({block:'nearest'});
  }else if(e.key==='Enter'){
   if(!lijst.hidden&&treffers[hl]){e.preventDefault();kies(treffers[hl]);}
  }else if(e.key==='Escape'&&!lijst.hidden){
   /* Eerst alleen de lijst dicht. Anders sloot dezelfde toets ook het hele
      venster, en was alles wat je daarin had ingevuld weg. */
   e.preventDefault();e.stopPropagation();sluit();
  }
 });
 var start=opties.start!==undefined?itemVan(opties.start):items[0];
 if(start){gekozen=start.waarde;invoer.value=start.label;toonGekozen();}
 return {waarde:function(){return gekozen;},kies:function(w){kies(itemVan(w));}};
}
/* Wat er naast een naam in een keuzelijst staat. Voor personen: soort, e-mail
   en groep(en); voor groepen: de locatie. Genoeg om naamgenoten uit elkaar
   te houden. */
function standaardDetail(o){
 if(o&&typeof o==='object'&&o.type){
  return [TYPELABEL[o.type],o.mail||'geen e-mailadres',(o.groepen||[]).join(', ')].filter(Boolean).join(' · ');
 }
 if(typeof o==='string'&&GROEPEN.indexOf(o)>-1&&groepLocatie[o])return 'locatie: '+groepLocatie[o];
 return '';
}
function kiesUitLijstModal(titel,opties,labelFn,onKies,detailFn){
 if(!opties.length){
  openModal('<h3>'+esc(titel)+'</h3><div class="msec"><p>Er is niets om uit te kiezen.</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
  el('modal-snap').addEventListener('click',closeModal);
  return;
 }
 openModal('<h3>'+esc(titel)+'</h3><fieldset class="admblok"><legend>Keuze</legend><div class="admveld"><label for="modal-kies-zoek">Kies uit de lijst<span class="verplicht">*</span></label>'+zoekKeuzeHtml('modal-kies','Typ om te zoeken…')+'</div></fieldset><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Doorgaan</button></div>');
 var detail=detailFn||standaardDetail;
 var keuze=koppelZoekKeuze('modal-kies',opties.map(function(o,i){return {waarde:i,label:labelFn(o),detail:detail(o)};}),
  {naKeuze:function(w){el('modal-opslaan').disabled=(w===null);}});
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  if(keuze.waarde()===null)return;
  var idx=keuze.waarde();
  closeModal();
  onKies(opties[idx]);
 });
}
function voegInstituutToe(naamVal){
 naamVal=kap((naamVal||'').trim(),MAXLEN.groep);
 if(!naamVal)return false;
 if(INSTITUTEN.indexOf(naamVal)>-1){alert('Er bestaat al een instituut met deze naam.');return false;}
 INSTITUTEN.push(naamVal);
 syncOrganisatieData();
 return true;
}
function hernoemInstituut(oud){
 openModal('<h3>Instituut hernoemen</h3><fieldset class="admblok"><legend>Instituut</legend><div class="admveld"><label for="modal-naam-veld">Naam<span class="verplicht">*</span></label><input class="admin" id="modal-naam-veld" maxlength="60" value="'+esc(oud)+'"></div></fieldset><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var nieuw=el('modal-naam-veld').value.trim();
  if(!nieuw)return;
  if(nieuw!==oud&&INSTITUTEN.indexOf(nieuw)>-1){alert('Er bestaat al een instituut met deze naam.');return;}
  INSTITUTEN[INSTITUTEN.indexOf(oud)]=nieuw;
  Object.keys(locatieInstituut).forEach(function(l){if(locatieInstituut[l]===oud)locatieInstituut[l]=nieuw;});
  syncOrganisatieData();
  closeModal();
 });
}
function verwijderInstituut(naamVal){
 var gekoppeld=Object.keys(locatieInstituut).filter(function(l){return locatieInstituut[l]===naamVal;});
 if(gekoppeld.length){alert('Dit instituut heeft nog '+gekoppeld.length+' gekoppelde locatie(s) en kan niet verwijderd worden.');return;}
 if(INSTITUTEN.length<=1){alert('Er moet minimaal één instituut overblijven.');return;}
 openModal('<h3>Instituut verwijderen</h3><div class="msec"><p>Weet je zeker dat je "'+esc(naamVal)+'" wilt verwijderen?</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-bevestig').addEventListener('click',function(){
  INSTITUTEN.splice(INSTITUTEN.indexOf(naamVal),1);
  syncOrganisatieData();
  closeModal();
 });
}
function voegLocatieToe(naamVal,instituut){
 naamVal=kap((naamVal||'').trim(),MAXLEN.groep);
 if(!naamVal)return false;
 if(LOCATIES.indexOf(naamVal)>-1){alert('Er bestaat al een locatie met deze naam.');return false;}
 LOCATIES.push(naamVal);
 locatieInstituut[naamVal]=instituut||INSTITUTEN[0];
 syncOrganisatieData();
 return true;
}
function verwijderLocatie(naamVal){
 var gekoppeld=Object.keys(groepLocatie).filter(function(g){return groepLocatie[g]===naamVal;});
 if(gekoppeld.length){alert('Deze locatie heeft nog '+gekoppeld.length+' gekoppelde groep(en) en kan niet verwijderd worden.');return;}
 if(LOCATIES.length<=1){alert('Er moet minimaal één locatie overblijven.');return;}
 openModal('<h3>Locatie verwijderen</h3><div class="msec"><p>Weet je zeker dat je "'+esc(naamVal)+'" wilt verwijderen?</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-bevestig').addEventListener('click',function(){
  LOCATIES.splice(LOCATIES.indexOf(naamVal),1);
  delete locatieInstituut[naamVal];
  syncOrganisatieData();
  closeModal();
 });
}
function instituutMakenFlow(){
 openModal('<h3>Instituut maken</h3><fieldset class="admblok"><legend>Nieuw instituut</legend><div class="admveld"><label for="modal-naam-veld">Naam<span class="verplicht">*</span></label><input class="admin" id="modal-naam-veld" maxlength="60" placeholder="Naam van het instituut"></div></fieldset><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Toevoegen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  if(voegInstituutToe(el('modal-naam-veld').value))closeModal();
 });
}
function locatieMakenFlow(){
 openModal('<h3>Locatie maken</h3><fieldset class="admblok"><legend>Nieuwe locatie</legend><div class="admveld"><label for="modal-naam-veld">Naam<span class="verplicht">*</span></label><input class="admin" id="modal-naam-veld" maxlength="60" placeholder="Naam van de locatie"></div><div class="admveld"><label for="modal-instituut-select">Instituut</label><select class="admin" id="modal-instituut-select">'+INSTITUTEN.map(function(i){return '<option>'+esc(i)+'</option>';}).join('')+'</select></div></fieldset><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Toevoegen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  if(voegLocatieToe(el('modal-naam-veld').value,el('modal-instituut-select').value))closeModal();
 });
}
/* Deze knop sprong naar het hele groepenoverzicht, met de lijst van bestaande
   groepen erbij. Bij "maken" hoor je gewoon een formulier te krijgen, net als
   bij instituut, locatie en cliënt. */
function groepMakenFlow(){
 openModal('<h3>Groep maken</h3>'+
  '<fieldset class="admblok"><legend>Nieuwe groep</legend>'+
  '<div class="admveld"><label for="modal-naam-veld">Naam<span class="verplicht">*</span></label>'+
   '<input class="admin" id="modal-naam-veld" maxlength="60" placeholder="Naam van de groep"></div>'+
  '<div class="admveld"><label for="modal-groep-locatie">Locatie</label>'+
   '<select class="admin" id="modal-groep-locatie">'+LOCATIES.map(function(l){return '<option>'+esc(l)+'</option>';}).join('')+'</select></div>'+
  '</fieldset>'+
  '<div id="modal-groep-fout" class="mini" style="color:var(--brick)" hidden>Vul een naam in voor de groep.</div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="modal-opslaan">Toevoegen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var naamVal=el('modal-naam-veld').value.trim();
  if(!naamVal){el('modal-groep-fout').hidden=false;return;}
  var locatie=el('modal-groep-locatie').value;
  if(!voegGroepToe(naamVal))return;
  groepLocatie[naamVal]=locatie;
  syncOrganisatieData();
  closeModal();
  kiesAdmintab('groepen');
 });
}
function kiesGroepDan(titel,onGroep){kiesUitLijstModal(titel,GROEPEN,function(g){return g;},onGroep);}
function clientMakenFlow(){
 kiesGroepDan('In welke groep wil je een cliënt aanmaken?',function(g){
  huidigeGroep=g;verversGroepReferenties();
  pushNew('client');
  showView('personal');
 });
}
function persoonTypeKeuze(titel,onType){
 kiesUitLijstModal(titel,['medewerker','naaste'],function(t){return t==='medewerker'?'Medewerker':'Naaste';},onType);
}
function persoonMakenFlow(){
 persoonTypeKeuze('Welk type wil je aanmaken?',function(t){
  kiesGroepDan('In welke groep?',function(g){
   huidigeGroep=g;verversGroepReferenties();
   pushNew(t);
   showView('personal');
  });
 });
}
function clientBewerkenFlow(){
 kiesGroepDan('In welke groep staat de cliënt?',function(g){
  huidigeGroep=g;verversGroepReferenties();renderAll();
  kiesUitLijstModal('Welke cliënt bewerken?',personenVanType('client'),naam,function(p){
   openProfielClient(p.id);showView('personal');
  });
 });
}
function persoonBewerkenFlow(){
 persoonTypeKeuze('Welk type wil je bewerken?',function(t){
  kiesGroepDan('In welke groep?',function(g){
   huidigeGroep=g;verversGroepReferenties();renderAll();
   kiesUitLijstModal('Wie wil je bewerken?',personenVanType(t),naam,function(p){
    openProfielPersoon(p.id,t);showView('personal');
   });
  });
 });
}
function verwijderPersoonBevestiging(p){
 var anderen=andereGroepenVan(p);
 var elders=blijftElders(p)&&anderen.length;
 var kop=elders?'Alleen losgekoppeld':'Klaargezet om te verwijderen';
 var tekst=elders
  ? esc(naam(p))+' is gemarkeerd om losgekoppeld te worden van <b>'+esc(huidigeGroep)+'</b>. '+
    'In <b>'+anderen.map(esc).join('</b>, <b>')+'</b> blijft '+esc(naam(p))+' gewoon bestaan. '+
    'De rechten binnen <b>'+esc(huidigeGroep)+'</b> vervallen zodra je de wijzigingen doorvoert.'
  : esc(naam(p))+' is gemarkeerd om verwijderd te worden.';
 openModal('<h3>'+kop+'</h3><div class="msec"><p>'+tekst+'</p><p>Dit wordt definitief zodra de wijzigingen worden doorgevoerd (Wijzigingen controleren → Bevestigen).</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
}
function clientVerwijderenFlow(){
 kiesGroepDan('In welke groep staat de cliënt?',function(g){
  huidigeGroep=g;verversGroepReferenties();renderAll();
  kiesUitLijstModal('Welke cliënt verwijderen?',personenVanType('client'),naam,function(p){
   markeerVerwijderd(p.id,'client');
   /* Verwijderd door de beheerder: na doorvoeren in de eigen lijst van de
      Admin Tools, niet in het archief dat medewerkers in hun groep zien. */
   if(p._state==='verwijderd')p._doorBeheer=true;
   verwijderPersoonBevestiging(p);
  });
 });
}
function persoonVerwijderenFlow(){
 persoonTypeKeuze('Welk type wil je verwijderen?',function(t){
  kiesGroepDan('In welke groep?',function(g){
   huidigeGroep=g;verversGroepReferenties();renderAll();
   kiesUitLijstModal('Wie wil je verwijderen?',personenVanType(t),naam,function(p){
    markeerVerwijderd(p.id,t);
    /* Net als bij cliënten: verwijderd door de beheerder, dus in de eigen lijst
       van de Admin Tools en niet in het archief van de groep. */
    if(p._state==='verwijderd')p._doorBeheer=true;
    verwijderPersoonBevestiging(p);
   });
  });
 });
}
function groepHerstellenFlow(){
 kiesUitLijstModal('Welke groep herstellen?',gearchiveerdeGroepen,function(g){return g;},herstelGroep);
}
/* Herstellen vanuit de Admin Tools: na de groepkeuze het archief zoals de
   beheerder het ziet. Bovenaan wat via de Admin Tools is verwijderd (dat staat
   niet in het archief van de groep), daaronder het archief van de groep zelf.
   Alleen hier kan definitief gewist worden: dat doen wij intern, medewerkers niet. */
var HERSTELTYPEN={client:['client'],persoon:['medewerker','naaste']};
function clientHerstelFlow(){herstelFlow('client');}
function persoonHerstelFlow(){herstelFlow('persoon');}
function herstelFlow(soort){
 kiesGroepDan(soort==='client'?'In welke groep wil je een cliënt herstellen?':'In welke groep wil je iemand herstellen?',function(g){
  huidigeGroep=g;verversGroepReferenties();renderAll();
  toonBeheerArchief(g,soort);
 });
}
function toonBeheerArchief(g,soort){
 var typen=HERSTELTYPEN[soort]||HERSTELTYPEN.persoon;
 var hier=people.filter(function(p){return typen.indexOf(p.type)>-1&&(p.groepen||[]).indexOf(g)>-1;});
 var klaar=hier.filter(function(p){return doorBeheer(p)&&p._state==='verwijderd'&&!p.archived;});
 var beheer=hier.filter(function(p){return doorBeheer(p)&&p.archived;});
 var archief=hier.filter(function(p){return !doorBeheer(p)&&p.archived;});
 /* In de Admin Tools staat de naam van de handeling al in de kop van het
    paneel; de titel hoeft alleen nog de groep te noemen. */
 var html='<h3>'+esc('Groep: '+g)+'</h3>'+
  '<p class="mini" style="margin:0 0 10px">De gegevens blijven de bewaartermijn van '+esc(bewaartermijnTekst())+' staan. Definitief wissen kan alleen hier, in de Admin Tools.</p>';
 html+='<div class="sublistlabel">Verwijderd via beheer</div>';
 html+=klaar.map(function(p){
  return '<div class="personrow"><div class="pinfo"><div class="naam">'+esc(naam(p))+' <span class="mini">— '+TYPELABEL[p.type]+'</span>'+
   ' <span class="statuschip" style="background:var(--amber-bg,#fff4e0);color:var(--amber)">Nog niet doorgevoerd</span></div>'+
   '<div class="mail">Wordt verwijderd bij Wijzigingen doorvoeren</div></div>'+
   '<button type="button" class="small" data-uitprullenbak="'+p.id+'">Terugzetten</button></div>';
 }).join('')+(beheer.length?beheer.map(function(p){return archiefRijHtml(p,{wissen:true});}).join(''):(klaar.length?'':'<p class="empty-msg">Niemand via de Admin Tools verwijderd in deze groep.</p>'));
 html+='<div class="sublistlabel" style="margin-top:14px">Archief van de groep</div>'+
  '<p class="mini" style="margin:0 0 6px">Wat medewerkers zelf hebben verwijderd. Dit zien zij ook onder Gearchiveerd.</p>'+
  (archief.length?archief.map(function(p){return archiefRijHtml(p,{wissen:true});}).join(''):'<p class="empty-msg">Niemand gearchiveerd in deze groep.</p>');
 openModal(html+'<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
 koppelArchiefKnoppen(el('modal-card'),function(){toonBeheerArchief(g,soort);});
}
/* ---- Zonder groep ----
   Na het verwijderen van een groep houden mensen die alleen daarin zaten geen
   groep over. Elk ander scherm werkt per groep, dus hier zijn ze de enige plek
   waar ze nog te zien zijn: verplaatsen naar een groep, of naar het archief.
   Ook gearchiveerden zonder groep staan hier, anders zou het archief ze kwijt
   zijn (dat toont alleen per groep). */
/* Ook wie alleen nog naar groepen verwijst die niet (meer) bestaan: die is in
   geen enkel ander scherm te zien. Vangnet voor oude of gelijktijdige
   wijzigingen van twee beheerders. */
function zonderGroep(){
 return people.filter(function(p){return p._state!=='nieuw'&&!(p.groepen||[]).some(function(g){return GROEPEN.indexOf(g)>-1;});});
}
function zetZonderGroepTeller(){
 var t=el('zondergroep-teller');
 if(t)t.textContent=zonderGroep().filter(function(p){return !p.archived;}).length||'';
 /* Op verzoek alleen zichtbaar als er iemand zonder groep is: meestal is die
    lijst leeg en dan had de knop geen nut. Ook gearchiveerden zonder groep
    tellen mee, anders zijn die nergens meer terug te zetten. Via style.display,
    want hidden werkt niet op .abtn. */
 var knop=document.querySelector('[data-adm="zonderGroep"]');
 if(knop)knop.style.display=zonderGroep().length?'':'none';
}
var TYPENAAM={client:'Cliënt',medewerker:'Medewerker',naaste:'Naaste'};
function zonderGroepFlow(){
 var lijst=zonderGroep(),actief=lijst.filter(function(p){return !p.archived;}),archief=lijst.filter(function(p){return p.archived;});
 var groepOpties=GROEPEN.map(function(g){return '<option value="'+esc(g)+'">'+esc(g)+'</option>';}).join('');
 var rij=function(p,knoppen,extra){
  return '<div class="personrow" style="box-shadow:none">'+avatarHtml(naam(p),fotoVan(p))+
   '<div class="pinfo"><div class="naam">'+esc(naam(p))+' <span class="mini">('+esc(TYPENAAM[p.type]||p.type)+')</span></div><div class="mail">'+esc(extra||p.mail||'')+'</div></div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'+knoppen+'</div></div>';
 };
 var html='<h3>Zonder groep</h3>'+
  '<p class="mini" style="margin:0 0 10px">Mensen die geen groep meer hebben, bijvoorbeeld omdat hun groep is verwijderd. Verplaats ze naar een groep of verwijder ze.</p>';
 html+=actief.length?actief.map(function(p){
  return rij(p,'<select data-zg-groep="'+p.id+'" aria-label="Groep voor '+esc(naam(p))+'">'+groepOpties+'</select>'+
   '<button type="button" class="small" data-zg-plaats="'+p.id+'">Toevoegen</button>'+
   '<button type="button" class="small danger" data-zg-archief="'+p.id+'">Verwijderen</button>');
 }).join(''):'<p class="empty-msg">Iedereen zit in een groep.</p>';
 if(archief.length){
  html+='<div class="sublistlabel" style="margin-top:14px">Gearchiveerd, zonder groep</div>'+archief.map(function(p){
   return rij(p,'<select data-zg-groep="'+p.id+'" aria-label="Groep voor '+esc(naam(p))+'">'+groepOpties+'</select>'+
    '<button type="button" class="small" data-zg-terug="'+p.id+'">Terugzetten</button>'+
    '<button type="button" class="small" data-avg="'+p.id+'">Inzage</button>'+
    (magDefinitiefWissen()?'<button type="button" class="small danger" data-wis="'+p.id+'">Definitief wissen</button>':''),
    geldigeDatum(p.gearchiveerdOp)?'Gearchiveerd op '+datumNL(p.gearchiveerdOp)+' · bewaren tot '+datumNL(bewaarTot(p)):'Gearchiveerd');
  }).join('');
 }
 openModal(html+'<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
 var groepVoor=function(id){var s=document.querySelector('[data-zg-groep="'+id+'"]');return s?s.value:'';};
 var klaar=function(){renderAll();syncToSupabase();zonderGroepFlow();};
 /* Inzage en Definitief wissen werken hier net als in de herstellijst; daarna
    terug naar deze lijst. */
 koppelArchiefKnoppen(el('modal-card'),zonderGroepFlow);
 Array.prototype.forEach.call(document.querySelectorAll('[data-zg-plaats]'),function(b){
  b.addEventListener('click',function(){
   var p=findPerson(+b.getAttribute('data-zg-plaats')),g=groepVoor(p&&p.id);if(!p||!g)return;
   p.groepen=groepenBij(p,g);
   logActie(naam(p)+' zonder groep toegevoegd aan '+g);
   klaar();
  });
 });
 Array.prototype.forEach.call(document.querySelectorAll('[data-zg-terug]'),function(b){
  b.addEventListener('click',function(){
   var p=findPerson(+b.getAttribute('data-zg-terug')),g=groepVoor(p&&p.id);if(!p||!g)return;
   p.archived=false;delete p.gearchiveerdOp;delete p.gearchiveerdReden;delete p.archiefSoort;p.groepen=groepenBij(p,g);
   logActie(naam(p)+' teruggezet uit het archief in '+g,{soort:'Herstel'});
   klaar();
  });
 });
 Array.prototype.forEach.call(document.querySelectorAll('[data-zg-archief]'),function(b){
  b.addEventListener('click',function(){
   var p=findPerson(+b.getAttribute('data-zg-archief'));if(!p)return;
   bevestigModal('Verwijderen',
    '<p><b>'+esc(naam(p))+'</b> gaat naar het archief. Na de bewaartermijn kan het dossier definitief weg; tot die tijd kun je hem hier terugzetten.</p>',
    'Ja, verwijderen',function(){
     /* Zelfde soft delete als bij doorvoeren: de rij blijft, met datum, zodat
        de bewaartermijn loopt en terugzetten kan. */
     p.archived=true;p.gearchiveerdOp=vandaagISO();p.contactpersoon=false;delete p.contactVolgorde;delete p.status;
     verwijderVerwijzingenNaar(p.id);
     logActie(naam(p)+' gearchiveerd (zonder groep); bewaren tot '+datumNL(bewaarTot(p)),{soort:'Archivering'});
     klaar();
    });
  });
 });
}
function contactpersonenFlow(){
 var secties=GROEPEN.map(function(g){
  var lijst=people.filter(function(p){return p.type==='medewerker'&&!p.archived&&p.groepen.indexOf(g)>-1&&p.contactVolgorde;}).sort(function(a,b){return a.contactVolgorde-b.contactVolgorde;});
  return '<div class="sublistlabel" style="margin-top:14px">'+esc(g)+'</div>'+(lijst.length?lijst.map(function(m){
   return '<div class="personrow" style="box-shadow:none"><div class="pinfo"><div class="naam">'+esc(naam(m))+' <span class="mini">(contactpersoon '+m.contactVolgorde+(isZiek(m)?', ziek':'')+')</span></div><div class="mail">'+esc(m.mail||'—')+'</div></div>'+
    '<button type="button" class="small" data-cp-open="'+m.id+'" data-cp-groep="'+esc(g)+'">Openen</button></div>';
  }).join(''):'<p class="empty-msg" style="padding:0">Geen contactpersonen.</p>');
 }).join('');
 openModal('<h3>Contactpersonen per groep</h3>'+secties+'<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
 Array.prototype.forEach.call(document.querySelectorAll('[data-cp-open]'),function(b){
  b.addEventListener('click',function(){
   huidigeGroep=b.getAttribute('data-cp-groep');verversGroepReferenties();
   closeModal();
   openProfielPersoon(+b.getAttribute('data-cp-open'),'medewerker');
   showView('personal');
  });
 });
}
/* ---- Meerdere mensen tegelijk toevoegen ----
   Een nieuwe groep begon met één voor één invoeren: naam, e-mailadres, opslaan,
   opnieuw. Bij een team van vijftien is dat een middag. Plakken uit een lijst
   scheelt dat, mits je eerst laat zien wat er gaat gebeuren — een import die
   meteen doorvoert is precies hoe je per ongeluk vijftien dubbele accounts
   maakt. */
function leesImportregels(tekst,type){
 var rijen=[];
 (tekst||'').split(/\r?\n/).forEach(function(regel,i){
  regel=regel.trim();
  if(!regel)return;
  var delen=regel.split(/[;,\t]/).map(function(x){return x.trim();});
  var naamdeel=delen[0]||'';
  var mail=delen[1]||'';
  var tel=delen[2]||'';
  var stukken=naamdeel.split(/\s+/);
  var voor=stukken.shift()||'';
  var achter=stukken.join(' ');
  var fout='';
  if(!voor||!achter)fout='vul een voor- en achternaam in';
  else if(!mail&&type!=='client')fout='vul een e-mailadres in';
  else if(mail&&!mailGeldig(mail))fout='dit e-mailadres klopt niet';
  else if(tel&&!telGeldig(tel))fout='dit telefoonnummer klopt niet';
  else if(people.some(function(p){return !p.archived&&naam(p).toLowerCase()===(voor+' '+achter).toLowerCase()&&p.groepen.indexOf(huidigeGroep)>-1;}))
   fout='staat al in deze groep';
  rijen.push({regel:i+1,voor:voor,achter:achter,mail:mail,tel:tel,fout:fout});
 });
 return rijen;
}
function importFlow(){
 var type='medewerker';
 openModal('<h3>Meerdere mensen toevoegen</h3>'+
  '<p class="mini" style="margin:0 0 10px">Plak één persoon per regel: naam, e-mailadres, telefoonnummer. Naam en e-mailadres zijn verplicht; bij cliënten alleen de naam.</p>'+
  '<div class="typetabs" id="imp-typetabs">'+
   '<button type="button" class="typetab on" data-type="medewerker">Medewerker</button>'+
   '<button type="button" class="typetab" data-type="naaste">Naaste</button>'+
   '<button type="button" class="typetab" data-type="client">Cliënt</button>'+
  '</div>'+
  '<textarea id="imp-tekst" style="width:100%;min-height:110px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font:inherit;font-size:13.5px" placeholder="Jan Jansen; j.jansen@zorggroepnoord.nl; 06 12 34 56 78&#10;Fatima El Amrani; f.elamrani@zorggroepnoord.nl"></textarea>'+
  '<div id="imp-voorbeeld" style="margin-top:12px"></div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="imp-toevoegen" disabled>Toevoegen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 var toon=function(){
  var rijen=leesImportregels(el('imp-tekst').value,type);
  var goed=rijen.filter(function(r){return !r.fout;});
  var mis=rijen.filter(function(r){return r.fout;});
  el('imp-voorbeeld').innerHTML=rijen.length
   ? '<div class="admreview">'+rijen.map(function(r){
      return '<div class="reviewrow"><span class="rdot" style="background:'+(r.fout?'var(--brick)':'var(--moss)')+'"></span>'+
       '<div class="rtxt"><b>'+esc((r.voor+' '+r.achter).trim()||'regel '+r.regel)+'</b>'+
       (r.mail?' — '+esc(r.mail):'')+(r.tel?' · '+esc(r.tel):'')+
       (r.fout?'<div class="wijzigdetail" style="color:var(--brick)">regel '+r.regel+': '+esc(r.fout)+'</div>':'')+'</div></div>';
     }).join('')+'</div>'+
     '<p class="mini" style="margin:8px 0 0">'+goed.length+' worden toegevoegd'+(mis.length?', '+mis.length+' overgeslagen':'')+'.</p>'
   : '<p class="mini">Nog niets geplakt.</p>';
  el('imp-toevoegen').disabled=!goed.length;
 };
 el('imp-tekst').addEventListener('input',toon);
 Array.prototype.forEach.call(el('imp-typetabs').querySelectorAll('.typetab'),function(b){
  b.addEventListener('click',function(){
   Array.prototype.forEach.call(el('imp-typetabs').querySelectorAll('.typetab'),function(x){x.classList.remove('on');});
   b.classList.add('on');type=b.getAttribute('data-type');toon();
  });
 });
 toon();
 el('imp-toevoegen').addEventListener('click',function(){
  var goed=leesImportregels(el('imp-tekst').value,type).filter(function(r){return !r.fout;});
  goed.forEach(function(r){
   var nieuw=maakPersoon(type);
   if(!nieuw)return;
   nieuw.voor=r.voor;nieuw.achter=r.achter;
   if(r.mail)nieuw.mail=r.mail;
   if(r.tel)nieuw.tel=r.tel;
  });
  logActie(goed.length+' '+TYPELABEL[type].toLowerCase()+(goed.length===1?'':'s')+' toegevoegd via plakken');
  closeModal();renderAll();
  openMelding('Toegevoegd',goed.length+' '+(goed.length===1?'persoon staat':'personen staan')+' klaar in '+huidigeGroep+'. Ze worden definitief zodra je de wijzigingen doorvoert.');
 });
}
/* ---- Uit dienst ----
   Iemand die vertrekt vroeg vijf losse handelingen: blokkeren, een einddatum
   zetten, het contactpersoonschap overdragen, de rechten op cliënten overdragen
   en archiveren. Vergeet je er één — en dat is de normale gang van zaken — dan
   houdt iemand toegang tot een dossier waar hij niets meer te zoeken heeft.
   Dit doet ze in één keer, en laat eerst zien wat er blijft liggen. */
function wieBlijftLiggen(p){
 var gevolgen=[];
 if(p.contactVolgorde){
  var andere=contactpersonenVanGroep().filter(function(x){return x.id!==p.id&&heeftToegang(x);});
  if(!andere.length)gevolgen.push({soort:'contact',persoon:p,tekst:naam(p)+' is contactpersoon '+p.contactVolgorde+'; daarna heeft deze groep geen aanspreekpunt.'});
 }
 personenVanType('client').forEach(function(c){
  if(!rolOpClient(p,c.id))return;
  var anderen=personenVanType('medewerker').filter(function(m){return m.id!==p.id&&rolOpClient(m,c.id)&&heeftToegang(m);});
  if(!anderen.length)gevolgen.push({soort:'client',persoon:p,client:c,tekst:naam(p)+' is de enige medewerker met toegang tot '+naam(c)+'.'});
 });
 return gevolgen;
}
function uitDienstFlow(){
 var kandidaten=personenVanType('medewerker').filter(function(m){return m._state!=='verwijderd';});
 kiesUitLijstModal('Wie gaat uit dienst?',kandidaten,naam,function(p){uitDienstVenster(p);});
}
function uitDienstVenster(p){
 var gevolgen=wieBlijftLiggen(p);
 var opvolgers=personenVanType('medewerker').filter(function(m){return m.id!==p.id&&heeftToegang(m);});
 var rechten=RECHTVELDEN.reduce(function(n,v){return n+Object.keys(p[v]||{}).length;},0);
 openModal('<h3>'+esc(naam(p))+' uit dienst</h3>'+
  '<p class="mini" style="margin:0 0 12px">Dit doet alles in één keer: toegang blokkeren, de einddatum op vandaag zetten, '+
  (rechten?'de '+rechten+' recht'+(rechten===1?'':'en')+' intrekken':'de rechten intrekken')+' en '+esc(naam(p))+' archiveren.</p>'+
  (gevolgen.length?'<div class="admwaarschuwing"><b>Dit blijft liggen</b><ul>'+
    gevolgen.map(function(g){return '<li>'+esc(g.tekst)+'</li>';}).join('')+'</ul>'+
    '<p class="mini">Kies hieronder wie het overneemt, dan regelen we dat meteen.</p></div>':'')+
  '<fieldset class="admblok"><legend>Overdracht</legend>'+
   '<div class="admveld"><label for="ud-opvolger">Neemt het over</label><select class="admin" id="ud-opvolger">'+
    '<option value="">Niemand — later regelen</option>'+
    opvolgers.map(function(m){return '<option value="'+m.id+'">'+esc(naam(m))+'</option>';}).join('')+'</select></div>'+
   '<div class="admveld"><label for="ud-reden">Reden</label><input class="admin" id="ud-reden" maxlength="80" placeholder="Bijvoorbeeld: uit dienst per vandaag"></div>'+
   '<p class="mini" style="margin:0">De reden komt in het logboek te staan.</p>'+
  '</fieldset>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="danger" id="ud-uitvoeren">Uit dienst melden</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('ud-uitvoeren').addEventListener('click',function(){
  var opvolgerId=+el('ud-opvolger').value||0;
  var reden=kap(el('ud-reden').value.trim(),80)||'uit dienst';
  var overgedragen=0;
  if(opvolgerId){
   var opvolger=findPerson(opvolgerId);
   if(opvolger)overgedragen=draagOver(gevolgen,opvolger);
  }
  /* Eerst de toegang dicht, dan pas de administratie: zo is er geen moment
     waarop het account nog open staat terwijl de rechten al weg zijn. */
  p.geblokkeerd=true;p.geblokkeerdReden=reden;
  p.toegangTot=vandaagISO();
  RECHTVELDEN.forEach(function(v){if(p[v])p[v]={};});
  verwijderVerwijzingenNaar(p.id);
  if(p.contactVolgorde){
   var was=p.contactVolgorde;
   p.contactpersoon=false;delete p.contactVolgorde;delete p.status;
   if(was===1){
    var tweede=contactpersonenVanGroep().filter(function(x){return x.contactVolgorde===2;})[0];
    if(tweede)tweede.contactVolgorde=1;
   }
  }
  p._state='verwijderd';
  logActie(naam(p)+' uit dienst gemeld ('+reden+')'+(overgedragen?' — '+overgedragen+' '+(overgedragen===1?'taak':'taken')+' overgedragen':''));
  closeModal();renderAll();
  openMelding('Uit dienst gemeld',
   naam(p)+' kan niet meer inloggen en alle rechten zijn ingetrokken'+
   (overgedragen?', '+overgedragen+(overgedragen===1?' taak is':' taken zijn')+' overgedragen':'')+
   '. Het archiveren staat klaar bij de wijzigingen; dat wordt definitief zodra je ze doorvoert.');
 });
}
/* ---- Wijzigingen doorvoeren vanuit de Admin Tools ----
   Alles wat je hier aanmaakt, bewerkt of verwijdert blijft in concept staan tot
   iemand het doorvoert. Dat kon alleen in het groepsprofiel, dus je moest de
   Admin Tools verlaten om je eigen werk af te maken. Dit is dezelfde handeling,
   met dezelfde controle vooraf: je ziet eerst wat er gaat gebeuren, inclusief
   het werk dat blijft liggen als er iemand vertrekt, en je tekent ervoor. */
function doorvoerenWijzigingen(){return people.filter(function(p){return p._state;});}
function doorvoerenRegelsHtml(){
 var wijzigingen=doorvoerenWijzigingen();
 if(!wijzigingen.length)return '<p class="empty-msg">Er staat niets open om door te voeren.</p>';
 return '<div class="admreview">'+wijzigingen.map(function(p){
  var elders=p.groepen&&p.groepen.indexOf(huidigeGroep)<0?(p.groepen[0]||''):'';
  return '<div class="reviewrow"><span class="rdot" style="background:'+STATE_COLOR[p._state]+'"></span>'+
   '<div class="rtxt"><b>'+esc(naam(p))+'</b> — '+TYPELABEL[p.type]+(p.mail?', '+esc(p.mail):'')+
   (elders?' <span class="mini">· uit groep '+esc(elders)+'</span>':'')+
   (p._nieuweGroep?' · verplaatst naar '+esc(p._nieuweGroep):'')+
   wijzigingDetailsHtml(p)+'</div>'+
   '<span class="rtag" style="color:'+STATE_COLOR[p._state]+'">'+esc(wijzigingLabel(p))+'</span></div>';
 }).join('')+'</div>';
}
function doorvoerenFlow(){
 var wijzigingen=doorvoerenWijzigingen();
 if(!wijzigingen.length){
  openMelding('Wijzigingen doorvoeren','Er staat niets open om door te voeren. Zodra je iets aanmaakt, bewerkt of verwijdert verschijnt het hier.');
  return;
 }
 var ik=huidigeGebruiker();
 /* Ondertekenen doe je als iemand. Zonder geldig account in deze groep, en
    zonder support of systeembeheer, is er niemand om voor te tekenen. */
 if(!ik&&!staatBovenDeGroep()){
  openMelding('Niemand ingelogd','Er is in '+huidigeGroep+' geen account met toegang waaronder deze wijzigingen kunnen worden doorgevoerd. Kies eerst een account bij "Ingelogd als", of ga verder als systeembeheerder.');
  return;
 }
 var vastNummer=nummerLigtVast(),nummer=terugbelnummer();
 var gevolgen=vertrekGevolgen();
 openModal('<h3>Wijzigingen doorvoeren</h3>'+
  '<p class="mini" style="margin:0 0 12px">Dit voert alle openstaande wijzigingen door, ook die je in het groepsprofiel hebt gemaakt. Daarna is het niet meer terug te draaien.</p>'+
  doorvoerenRegelsHtml()+
  (gevolgen.length?'<div class="admwaarschuwing"><b>Let op: er blijft werk liggen</b><ul>'+
    gevolgen.map(function(g){return '<li>'+esc(g.tekst)+'</li>';}).join('')+
    '</ul><p class="mini">Je kunt toch doorvoeren, maar dan moet iemand dit later alsnog regelen. Overdragen doe je in het groepsprofiel, bij Wijzigingen controleren.</p></div>':'')+
  '<fieldset class="admblok"><legend>Wie voert dit door</legend>'+
   '<div class="admveld"><label>Naam</label><div class="admin lockedfield" id="adm-dv-naam">'+esc(ik?naam(ik)+' — '+(ik.type==='naaste'?'Naaste':'Medewerker'):wieBenIk())+'</div></div>'+
   (vastNummer
    ?'<div class="admveld"><label>Telefoonnummer</label><div class="admin lockedfield" id="adm-dv-tel-vast">'+esc(nummer)+'</div></div>'+
     '<p class="mini" style="margin:0 0 4px">Dit is het vaste servicenummer van '+esc(wieBenIk())+'. Het staat vast en is niet per handeling aan te passen.</p>'
    :'<div class="admveld"><label for="adm-dv-tel">Telefoonnummer<span class="verplicht">*</span></label>'+
     '<input class="admin" id="adm-dv-tel" maxlength="25" value="'+esc(nummer)+'" placeholder="06 12 34 56 78"></div>'+
     '<p class="mini" id="adm-dv-tel-fout" style="color:var(--brick)" hidden>Vul een geldig telefoonnummer in (minstens 9 cijfers).</p>')+
   '<div class="checkline"><input type="checkbox" id="adm-dv-akkoord"><label for="adm-dv-akkoord">Ik heb de wijzigingen gecontroleerd en ga akkoord met doorvoeren.</label></div>'+
  '</fieldset>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="adm-dv-doorvoeren" disabled>Wijzigingen doorvoeren</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 var knop=el('adm-dv-doorvoeren');
 var controleer=function(){
  var telOk=true;
  if(!vastNummer){
   telOk=telGeldig(el('adm-dv-tel').value);
   el('adm-dv-tel').style.borderColor=telOk?'':'var(--brick)';
   el('adm-dv-tel-fout').hidden=telOk;
  }
  knop.disabled=!(telOk&&el('adm-dv-akkoord').checked);
 };
 if(!vastNummer){
  el('adm-dv-tel').addEventListener('input',controleer);
  el('adm-dv-tel').addEventListener('blur',controleer);
 }
 el('adm-dv-akkoord').addEventListener('change',controleer);
 knop.addEventListener('click',async function(){
  knop.disabled=true;knop.textContent='Bezig met opslaan…';
  if(!vastNummer&&ik&&telGeldig(el('adm-dv-tel').value))ik.tel=el('adm-dv-tel').value.trim();
  var resultaat=await voerWijzigingenDoor();
  /* renderAll() in het doorvoeren heeft de knoppenbalk al bijgewerkt; nu nog
     het venster zelf, dat op dat moment in het Admin Tools-paneel hangt. */
  openModal('<h3>Wijzigingen doorgevoerd</h3>'+
   '<div class="admgelukt">'+doorvoerResultaatHtml(resultaat)+'</div>'+
   '<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
  el('modal-snap').addEventListener('click',closeModal);
 });
}
var ADMIN_TOOLBAR_ACTIES={
 instituutMaken:instituutMakenFlow,
 locatieMaken:locatieMakenFlow,
 groepMaken:groepMakenFlow,
 clientMaken:clientMakenFlow,
 persoonMaken:persoonMakenFlow,
 instituutBewerken:function(){kiesUitLijstModal('Welk instituut bewerken?',INSTITUTEN,function(i){return i;},hernoemInstituut);},
 groepBewerken:function(){kiesUitLijstModal('Welke groep bewerken?',GROEPEN,function(g){return g;},hernoemGroep);},
 clientBewerken:clientBewerkenFlow,
 persoonBewerken:persoonBewerkenFlow,
 instituutVerwijderen:function(){kiesUitLijstModal('Welk instituut verwijderen?',INSTITUTEN,function(i){return i;},verwijderInstituut);},
 locatieVerwijderen:function(){kiesUitLijstModal('Welke locatie verwijderen?',LOCATIES,function(l){return l;},verwijderLocatie);},
 groepVerwijderen:function(){kiesUitLijstModal('Welke groep verwijderen?',GROEPEN,function(g){return g;},verwijderGroep);},
 clientVerwijderen:clientVerwijderenFlow,
 persoonVerwijderen:persoonVerwijderenFlow,
 rechtensets:function(){showView('admin');kiesAdmintab('bulk');},
 contactpersonen:contactpersonenFlow,
 zonderGroep:zonderGroepFlow,
 groepeer:function(){showView('admin');kiesAdmintab('bulk');},
 groepHerstellen:groepHerstellenFlow,
 clientHerstellen:clientHerstelFlow,
 persoonHerstellen:persoonHerstelFlow,
 doorvoeren:doorvoerenFlow,
 uitDienst:uitDienstFlow,
 importeren:importFlow
};
/* Welke van de twintig knoppen je net hebt aangeklikt is zonder markering niet
   te zien; het venster dat opent noemt lang niet altijd de handeling. De knop
   blijft oplichten zolang de flow loopt. */
function zetActieveAdmKnop(knop){
 Array.prototype.forEach.call(document.querySelectorAll('[data-adm]'),function(x){
  x.classList.toggle('on',x===knop);
  if(x===knop)x.setAttribute('aria-current','true'); else x.removeAttribute('aria-current');
 });
 /* Zolang een handeling openstaat hoort het overzicht eronder niet óók als
    actief te lezen; twee opgelichte knoppen zeggen niet waar je bent. */
 if(knop){
  /* Onthouden waar je vandaan kwam, zodat je na de handeling terugkomt op het
     overzicht waar je mee bezig was en niet op het eerste uit de rij. */
  var open=document.querySelector('[data-admintab].on');
  if(open)admVorigTab=open.getAttribute('data-admintab');
  Array.prototype.forEach.call(document.querySelectorAll('[data-admintab]'),function(x){
   x.classList.remove('on');x.removeAttribute('aria-current');
  });
 }
}
function wisActieveAdmKnop(){zetActieveAdmKnop(null);}
Array.prototype.forEach.call(document.querySelectorAll('[data-adm]'),function(b){
 b.addEventListener('click',function(){
  var actie=ADMIN_TOOLBAR_ACTIES[b.getAttribute('data-adm')];
  if(!actie)return;
  zetActieveAdmKnop(b);
  /* De naam van de handeling komt uit het opschrift van de knop. Een teller die
     erin staat hoort daar niet bij: dan las de paneelkop "Wijzigingen
     doorvoeren 2". */
  var kopie=b.cloneNode(true);
  Array.prototype.forEach.call(kopie.querySelectorAll('.countchip'),function(x){x.remove();});
  admActieNaam=(kopie.innerHTML||'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  admInline=true;
  actie();
  /* Een handeling die meteen naar een ander scherm springt (bijvoorbeeld naar
     een tabblad) heeft geen paneel nodig. */
  if(admInline&&el('adm-scherm').hidden)admInline=false;
 });
});

/* Wie er werkt hoort in de band te staan: bij twintig knoppen die diep in de
   administratie ingrijpen moet je kunnen zien onder wiens naam dat gebeurt. */
function toonAdminWie(){
 var e=el('admin-wie');if(!e)return;
 e.textContent='Ingelogd als '+wieBenIk()+(inSupportweergave()?' (leverancier)':'');
}
el('admin-uitloggen').addEventListener('click',function(){
 bevestigModal('Systeembeheer verlaten',
  '<p>Je gaat terug naar het groepsprofiel. De Admin Tools sluiten; openstaande wijzigingen blijven staan tot je ze doorvoert.</p>',
  'Ja, verlaten',function(){
   wisActieveAdmKnop();
   var select=el('account-select');
   var eerste=accountsInGroep()[0];
   if(eerste){
    isSysteembeheerder=false;
    huidigeGebruikerId=eerste.id;
    MIJN_PROFIEL.voor=eerste.voor;MIJN_PROFIEL.achter=eerste.achter;
    MIJN_PROFIEL.mail=eerste.mail||'';MIJN_PROFIEL.mobiel=eerste.tel||'';
   }
   updateAdminTabZichtbaarheid();
   showView('personal');
   renderAll();
   if(select)select.value=isSupport?'support':(isSysteembeheerder?'systeembeheer':String(huidigeGebruikerId));
  });
});

function medewerkersVanGroep(g){
 return people.filter(function(p){return p.type==='medewerker'&&!p.archived&&p._state!=='verwijderd'&&p.groepen.indexOf(g)>-1;});
}
function renderKoppelingen(){
 var lijst=el('sb-koppel-lijst');if(!lijst)return;
 lijst.innerHTML=groepKoppelingen.length? groepKoppelingen.map(function(cluster,i){
  var gedeeld=medewerkersVanGroep(cluster[0]).length;
  return '<div class="personrow"><div class="pinfo">'+
   '<div class="naam">'+cluster.map(esc).join(' <span class="mini">+</span> ')+'</div>'+
   '<div class="mail">'+gedeeld+' gedeelde medewerker'+(gedeeld===1?'':'s')+' · '+
   cluster.map(function(g){var c=sbCounts(g);return esc(g)+': '+c.c+' cliënt'+(c.c===1?'':'en');}).join(' · ')+'</div></div>'+
   '<button type="button" class="small danger" data-ontkoppel="'+i+'">Koppeling opheffen</button></div>';
 }).join('') : '<p class="empty-msg" style="padding:14px 0">Nog geen gekoppelde groepen. Elke groep heeft nu zijn eigen team.</p>';
 Array.prototype.forEach.call(lijst.querySelectorAll('[data-ontkoppel]'),function(b){
  b.addEventListener('click',function(){ontkoppelCluster(+b.getAttribute('data-ontkoppel'));});
 });
 /* Alleen groepen die nog nergens aan hangen, of die je aan een bestaand cluster
    kunt toevoegen; een groep zit in hoogstens één cluster. */
 var a=el('sb-koppel-a'),b=el('sb-koppel-b');
 if(!a||!b)return;
 var vorigeA=a.value,vorigeB=b.value;
 a.innerHTML=GROEPEN.map(function(g){return '<option'+(g===vorigeA?' selected':'')+'>'+esc(g)+'</option>';}).join('');
 var gekozenA=a.value||GROEPEN[0];
 var opties=GROEPEN.filter(function(g){return clusterVan(g).indexOf(gekozenA)<0;});
 b.innerHTML=opties.length
  ? opties.map(function(g){return '<option'+(g===vorigeB?' selected':'')+'>'+esc(g)+'</option>';}).join('')
  : '<option value="">Geen andere groep beschikbaar</option>';
 el('sb-koppelen').disabled=!opties.length;
}
function koppelGroepen(a,b){
 if(!a||!b||a===b)return;
 var clusterA=clusterVan(a),clusterB=clusterVan(b);
 var samen=clusterA.concat(clusterB.filter(function(g){return clusterA.indexOf(g)<0;}));
 var teamA=medewerkersVanGroep(a).length,teamB=medewerkersVanGroep(b).length;
 bevestigModal('Groepen koppelen',
  '<p><b>'+samen.map(esc).join('</b>, <b>')+'</b> gaan met hetzelfde team werken.</p>'+
  '<p>'+teamA+' medewerker'+(teamA===1?'':'s')+' uit '+esc(a)+' en '+teamB+' uit '+esc(b)+
  ' komen daarmee in alle gekoppelde groepen te staan. Wie er later bij komt, komt er automatisch bij.</p>'+
  '<p>Cliënten en naasten blijven waar ze zijn. Niemand krijgt hierdoor toegang tot een cliënt: die rechten stel je per persoon in, zoals altijd.</p>',
  'Ja, koppelen',function(){
   groepKoppelingen=groepKoppelingen.filter(function(k){return samen.indexOf(k[0])<0&&!k.some(function(g){return samen.indexOf(g)>-1;});});
   groepKoppelingen.push(samen);
   var aantal=pasKoppelingenToe();
   logActie('Groepen gekoppeld: '+samen.join(' + ')+(aantal?' — '+aantal+' medewerker'+(aantal===1?'':'s')+' gedeeld':''));
   /* Eerst de koppeling en de bekende medewerkers, dan in de database ook de
      medewerkers die deze sessie niet kent. */
   syncOrganisatieData().then(function(){return syncToSupabase();}).then(function(){
    if(sb&&!opslagGeblokkeerd())return inRij(function(){return vulTeamsAanInDatabase(null);}).then(function(ok){registreerOpslag('personen',ok);renderAll();});
   });
   renderSysteembeheer();renderAll();
   el('sb-koppel-bevestiging').innerHTML='<div class="bevestiging reveal">'+esc(samen.join(' + '))+' werken nu met hetzelfde team.</div>';
   if(el('admintab-groepen').hidden)openMelding('Groepen gekoppeld',samen.join(' + ')+' werken nu met hetzelfde team.');
  });
}
/* Eén groep uit zijn koppeling halen. Bij twee groepen is dat hetzelfde als de
   hele koppeling opheffen; bij drie of meer blijven de andere gekoppeld. */
function ontkoppelGroep(g){
 var i=-1;
 groepKoppelingen.forEach(function(k,idx){if(k.indexOf(g)>-1)i=idx;});
 if(i<0)return;
 var cluster=groepKoppelingen[i],rest=cluster.filter(function(x){return x!==g;});
 bevestigModal('Koppeling opheffen',
  '<p><b>'+esc(g)+'</b> krijgt weer een eigen team en is niet meer gekoppeld aan <b>'+rest.map(esc).join('</b>, <b>')+'</b>.</p>'+
  '<p>De medewerkers die nu in '+esc(g)+' staan, blijven daar staan. Wat stopt, is het automatisch delen: wie hierna wordt toegevoegd komt alleen in de groep waar je hem aanmaakt.</p>',
  'Ja, opheffen',function(){
   if(rest.length>1)groepKoppelingen[i]=rest; else groepKoppelingen.splice(i,1);
   logActie('Koppeling opgeheven tussen '+g+' en '+rest.join(' + '));
   syncOrganisatieData();
   renderSysteembeheer();renderAll();
   openMelding('Koppeling opgeheven',g+' deelt geen medewerkers meer automatisch met '+rest.join(', ')+'.');
  });
}
function ontkoppelCluster(i){
 var cluster=groepKoppelingen[i];if(!cluster)return;
 var gedeeld=medewerkersVanGroep(cluster[0]).length;
 bevestigModal('Koppeling opheffen',
  '<p><b>'+cluster.map(esc).join('</b>, <b>')+'</b> krijgen weer een eigen team.</p>'+
  '<p>De '+gedeeld+' medewerker'+(gedeeld===1?'':'s')+' die nu in al deze groepen staan, blijven daar staan: ze zijn er echt aan gekoppeld en hun rechten horen erbij. Wil je iemand ergens weghalen, doe dat dan bewust per persoon — dan zie je ook welke rechten daarmee vervallen.</p>'+
  '<p>Wat stopt, is het automatisch delen: wie hierna wordt toegevoegd komt alleen in de groep waar je hem aanmaakt.</p>',
  'Ja, opheffen',function(){
   groepKoppelingen.splice(i,1);
   logActie('Koppeling opgeheven tussen '+cluster.join(' + '));
   syncOrganisatieData();
   renderSysteembeheer();renderAll();
   el('sb-koppel-bevestiging').innerHTML='<div class="bevestiging reveal">'+esc(cluster.join(' + '))+' delen geen medewerkers meer automatisch.</div>';
  });
}
function renderSysteembeheer(){
 renderKoppelingen();
 el('sb-groepen-sub').textContent=GROEPEN.length+' groep'+(GROEPEN.length===1?'':'en')+' in deze organisatie';
 if(el('sb-tel')&&document.activeElement!==el('sb-tel'))el('sb-tel').value=SYSTEEMBEHEER.tel||'';
 if(el('sb-support-naam')&&document.activeElement!==el('sb-support-naam'))el('sb-support-naam').value=SUPPORT.naam||'';
 el('sb-groepen-lijst').innerHTML=GROEPEN.map(function(g,i){
  var c=sbCounts(g);
  return '<div class="personrow" data-zoek="'+esc(g+' '+(groepLocatie[g]||''))+'">'+
   '<div class="pinfo"><div class="naam">'+esc(g)+(g===huidigeGroep?' <span class="statuschip" style="background:var(--accent-bg);color:var(--accent)">Wordt nu bekeken</span>':'')+'</div>'+
   '<div class="mail">'+c.m+' medewerker'+(c.m===1?'':'s')+' · '+c.n+' naaste'+(c.n===1?'':'n')+' · '+c.c+' cliënt'+(c.c===1?'':'en')+(groepLocatie[g]?' · locatie: '+esc(groepLocatie[g]):'')+'</div></div>'+
   '<button type="button" class="small" data-sb-bekijk="'+i+'">Bekijk</button>'+
   '<button type="button" class="iconbtn" data-sb-hernoem="'+i+'" aria-label="Hernoemen">'+PENCIL_SVG+'</button>'+
   '<button type="button" class="iconbtn" data-sb-verwijder="'+i+'" aria-label="Verwijderen" style="background:var(--brick)">'+TRASH_SVG+'</button>'+
   '</div>';
 }).join('');
 Array.prototype.forEach.call(el('sb-groepen-lijst').querySelectorAll('[data-sb-bekijk]'),function(b){
  b.addEventListener('click',function(){
   huidigeGroep=GROEPEN[+b.getAttribute('data-sb-bekijk')];
   verversGroepReferenties();
   renderAll();
   showView('personal');
  });
 });
 Array.prototype.forEach.call(el('sb-groepen-lijst').querySelectorAll('[data-sb-hernoem]'),function(b){
  b.addEventListener('click',function(){hernoemGroep(GROEPEN[+b.getAttribute('data-sb-hernoem')]);});
 });
 Array.prototype.forEach.call(el('sb-groepen-lijst').querySelectorAll('[data-sb-verwijder]'),function(b){
  b.addEventListener('click',function(){verwijderGroep(GROEPEN[+b.getAttribute('data-sb-verwijder')]);});
 });
 koppelZoekveld(el('sb-groepen-zoek'),el('sb-groepen-lijst'),{itemSelector:'.personrow',leegTekst:'Geen groep met deze naam.'})();
}
el('sb-groep-toevoegen').addEventListener('click',function(){
 if(voegGroepToe(el('sb-nieuwe-groep').value))el('sb-nieuwe-groep').value='';
});
el('sb-koppel-a').addEventListener('change',renderKoppelingen);
el('sb-koppelen').addEventListener('click',function(){
 koppelGroepen(el('sb-koppel-a').value,el('sb-koppel-b').value);
});
/* Leeg mag: dan heeft de organisatie (nog) geen nummer en verbergen we de regel
   liever dan een half ingevuld nummer te tonen. */
function bewaarSysteembeheerTel(){
 if(!el('sb-tel'))return false;
 var waarde=kap(el('sb-tel').value.trim(),MAXLEN.tel);
 var fout=waarde!==''&&!telGeldig(waarde);
 el('sb-tel-fout').hidden=!fout;
 el('sb-tel').style.borderColor=fout?'var(--brick)':'';
 if(fout)return false;
 var gewijzigd=SYSTEEMBEHEER.tel!==waarde;
 SYSTEEMBEHEER.tel=waarde;
 el('sb-tel').value=waarde;
 renderContactBanner();
 if(gewijzigd){
  logActie(waarde?('Telefoonnummer systeembeheer gewijzigd naar '+waarde):'Telefoonnummer systeembeheer gewist');
  syncOrganisatieData();
 }
 var bev=el('sb-tel-bevestiging');
 if(bev){
  bev.textContent=waarde?'Nummer opgeslagen.':'Nummer gewist.';
  setTimeout(function(){var b=el('sb-tel-bevestiging');if(b)b.textContent='';},2500);
 }
 return true;
}
/* Het scherm Bereikbaarheid staat in comment; de bediening eromheen blijft staan
   maar mag niet omvallen als de velden er niet zijn. */
if(el('sb-tel-opslaan'))el('sb-tel-opslaan').addEventListener('click',bewaarSysteembeheerTel);
if(el('sb-support-opslaan'))el('sb-support-opslaan').addEventListener('click',function(){
 /* Leeg laten mag niet: dan zou het logboek handelingen onder een lege naam
    vastleggen en is niet meer te achterhalen wie er heeft meegekeken. */
 var naamVal=kap(el('sb-support-naam').value.trim(),60)||'MyWepp Support';
 var gewijzigd=SUPPORT.naam!==naamVal;
 SUPPORT.naam=naamVal;
 el('sb-support-naam').value=naamVal;
 if(gewijzigd){
  logActie('Supportmedewerker gewijzigd naar '+naamVal);
  syncOrganisatieData();
 }
 renderAccountSelect();toonAdminWie();
 el('sb-support-bevestiging').textContent='Naam opgeslagen.';
 setTimeout(function(){var b=el('sb-support-bevestiging');if(b)b.textContent='';},2500);
});
if(el('sb-tel'))el('sb-tel').addEventListener('input',function(){
 if(!el('sb-tel-fout').hidden&&(this.value.trim()===''||telGeldig(this.value))){
  el('sb-tel-fout').hidden=true;this.style.borderColor='';
 }
});
/* Eerst toevoegen, daarna pas opruimen: zo staat de tabel nooit leeg als een van
   beide stappen faalt (een delete-alles-dan-insert kon alle groepen wissen). */
var groepMutaties={erbij:[],weg:[]};
function groepErbij(n){groepMutaties.weg=groepMutaties.weg.filter(function(x){return x!==n;});if(groepMutaties.erbij.indexOf(n)<0)groepMutaties.erbij.push(n);}
function groepWeg(n){
 /* Een groep die deze sessie zelf nog maar net aanmaakte (nog niet in de
    database) weer weghalen, hoeft in de database niets te verwijderen. */
 var eigenNieuw=groepMutaties.erbij.indexOf(n)>-1;
 groepMutaties.erbij=groepMutaties.erbij.filter(function(x){return x!==n;});
 if(!eigenNieuw&&groepMutaties.weg.indexOf(n)<0)groepMutaties.weg.push(n);
}
/* Mislukte het wegschrijven van de groepenlijst, dan bleef dat stil: geen
   Niet opgeslagen-balk en geen Opnieuw proberen, terwijl bij Groep verwijderen
   de personen al zonder groep in de database stonden (aangetoond met
   groep-opslagfout.cjs). De mutaties blijven staan tot het wel lukt. */
function syncGroepenToSupabase(){return inRij(schrijfGroepenEnMeld);}
async function schrijfGroepenEnMeld(){
 if(!sb)return false;
 if(opslagGeblokkeerd())return false;
 return registreerOpslag('groepen',await schrijfGroepenWeg());
}
/* Waar een verdwenen groepsnaam heen moet: de nieuwe naam als deze sessie hem
   hernoemde (ook via tussenstappen), anders nergens. */
function nieuweNaamVoor(n){
 var gezien={};
 while(groepHernoemd[n]&&!gezien[n]){gezien[n]=1;n=groepHernoemd[n];}
 return GROEPEN.indexOf(n)>-1?n:null;
}
/* Na het hernoemen of verwijderen van groepen: iedereen in de database die nog
   een oude naam heeft, en de koppelingen, bijwerken. Deze sessie kent alleen de
   mensen die bij het laden bestonden; wie een ander intussen in die groep zette,
   verwees daarna naar een groep die niet meer bestond en was onvindbaar
   (aangetoond met invarianten.js ... twee). */
async function werkGroepnamenBijInDatabase(wegNamen){
 if(!wegNamen.length)return true;
 var nieuw=function(lijst){
  var uit=[];
  lijst.forEach(function(g){var n=wegNamen.indexOf(g)>-1?nieuweNaamVoor(g):g;if(n&&uit.indexOf(n)<0)uit.push(n);});
  return uit;
 };
 var rijen=await alleRijen(function(){return sb.from('personen').select('id,groepen').order('id');});
 if(rijen.error)return false;
 var teDoen=(rijen.data||[]).filter(function(r){return (r.groepen||[]).some(function(g){return wegNamen.indexOf(g)>-1;});});
 for(var i=0;i<teDoen.length;i++){
  var r=teDoen[i],g2=nieuw(r.groepen||[]);
  var res=await sb.from('personen').update({groepen:g2}).eq('id',r.id);
  if(res.error)return false;
  if(dbStandPersonen[r.id]){var st=JSON.parse(dbStandPersonen[r.id]);st.groepen=g2;dbStandPersonen[r.id]=JSON.stringify(st);}
 }
 /* Wie zo een groep kwijtraakte, kan rechten hebben op mensen met wie hij geen
    groep meer deelt (ook tussen mensen die deze sessie niet kent). */
 if(teDoen.length&&!(await ruimRechtenOpInDatabase(teDoen.map(function(r){return r.id;}),[])))return false;
 var kq=await sb.from('organisatie_data').select('sleutel,waarde').in('sleutel',['groep_koppelingen']);
 if(kq.error)return false;
 var k=((kq.data||[])[0]||{}).waarde;
 if(Array.isArray(k)){
  var k2=voegClustersSamen(k.filter(Array.isArray).map(nieuw));
  if(JSON.stringify(k2)!==JSON.stringify(k)){
   var ku=await sb.from('organisatie_data').upsert([{sleutel:'groep_koppelingen',waarde:k2}],{onConflict:'sleutel'});
   if(ku.error)return false;
   groepKoppelingen=k2.map(function(x){return x.slice();});dbStandOrg.groep_koppelingen=JSON.stringify(k2);
  }
 }
 wegNamen.forEach(function(n){delete groepHernoemd[n];});
 return true;
}
var groepenTabelWasLeeg=false;
async function schrijfGroepenWeg(){
 try{
  var bestaand=await alleRijen(function(){return sb.from('groepen').select('id,naam').order('id');});
  if(bestaand.error||!bestaand.data)return false;
  var bestaandeNamen=bestaand.data.map(function(r){return r.naam;});
  /* Een groep hernoemen die een andere beheerder intussen al hernoemde of
     verwijderde, maakte stilletjes een tweede groep aan (de oude naam bestond
     niet meer); de mensen stonden daarna in beide. Dat is een conflict: niets
     wegschrijven en vragen om te herladen (aangetoond met invarianten.js). */
  var verouderd=groepMutaties.weg.filter(function(n){return groepHernoemd[n]&&bestaandeNamen.indexOf(n)<0&&!groepenTabelWasLeeg;});
  if(verouderd.length){groepConflict=verouderd;return false;}
  /* Alleen de groepen die in deze sessie zijn aangemaakt, hernoemd of
     verwijderd. Het verschil met de eigen lijst gebruiken verwijderde een
     groep die een andere beheerder net had aangemaakt. Een lege tabel wordt
     wel in één keer gevuld (eerste keer opslaan). */
  /* Alleen de allereerste keer (lege tabel bij het laden) de hele eigen lijst.
     Werd de tabel pas later leeg (twee beheerders verwijderden samen alle
     groepen), dan zette dit de eigen, verouderde lijst terug en kwamen
     verwijderde groepen weer tot leven (aangetoond met invarianten.js). */
  var erbij=(!bestaandeNamen.length&&groepenTabelWasLeeg)?GROEPEN.slice():groepMutaties.erbij;
  var toevoegen=erbij.filter(function(n){return GROEPEN.indexOf(n)>-1&&bestaandeNamen.indexOf(n)<0;});
  if(toevoegen.length){
   var ins=await sb.from('groepen').insert(toevoegen.map(function(n){return {naam:n};}));
   if(ins.error)return false;
  }
  var overbodig=bestaand.data.filter(function(r){return groepMutaties.weg.indexOf(r.naam)>-1&&GROEPEN.indexOf(r.naam)<0;}).map(function(r){return r.id;});
  if(overbodig.length){
   /* Eerst de personen wegschrijven, dan pas een groepsnaam weghalen. Bij
      hernoemen verwezen de personen in de database anders nog naar de oude
      naam tot iemand "Wijzigingen doorvoeren" deed; na herladen was de hele
      groep dan uit beeld. Lukt het wegschrijven niet, dan blijft de oude naam
      staan: liever een groep te veel dan mensen zonder groep. */
   if(!(await schrijfPersonenWeg()))return false;
   var del=await sb.from('groepen').delete().in('id',overbodig);
   if(del.error)return false;
   var wegNamen=bestaand.data.filter(function(r){return overbodig.indexOf(r.id)>-1;}).map(function(r){return r.naam;});
   if(!(await werkGroepnamenBijInDatabase(wegNamen)))return false;
  }
  groepMutaties={erbij:[],weg:[]};groepenTabelWasLeeg=false;
  await schrijfOrgWeg();
  return true;
 }catch(e){return false;}
}
/* Instituten, locaties en hun koppelingen leefden alleen in het geheugen en waren
   na een herlaad weg. Ze staan nu in organisatie_data (key/value). */
/* Alle instellingen die in organisatie_data staan, als rijen. */
function orgRijen(){
 return [
   {sleutel:'instituten',waarde:INSTITUTEN},
   {sleutel:'locaties',waarde:LOCATIES},
   {sleutel:'locatie_instituut',waarde:locatieInstituut},
   {sleutel:'groep_locatie',waarde:groepLocatie},
   {sleutel:'gearchiveerde_groepen',waarde:gearchiveerdeGroepen},
   {sleutel:'groep_ontkoppeld',waarde:groepOntkoppeld},
   {sleutel:'systeembeheer',waarde:SYSTEEMBEHEER},
   {sleutel:'groep_tweestaps',waarde:groepTweestaps},
   {sleutel:'beoordeelde_signalen',waarde:beoordeeldeSignalen},
   {sleutel:'support',waarde:SUPPORT},
   {sleutel:'digibord',waarde:digibordPerGroep},
   {sleutel:'maaltijden',waarde:MAALTIJDRESERVERINGEN},
   {sleutel:'groep_koppelingen',waarde:groepKoppelingen},
   {sleutel:'groep_gegevens',waarde:groepGegevens},
   /* De standaardrollen leefden alleen in het geheugen: na een herlaad stond
      iedere groep weer op de fabrieksinstelling, ook als je net iets anders had
      ingesteld. */
   {sleutel:'org_default',waarde:orgDefault},
   {sleutel:'groep_rollen',waarde:groupOverride},
   {sleutel:'toegangscontrole',waarde:TOEGANGSCONTROLE}
  ];
}
/* Wat deze sessie aan een lijst veranderde (t.o.v. de stand bij laden of de
   laatste opslag), toegepast op wat er nu in de database staat. */
function voegLijstSamen(db,vorig,mijn){
 var sleutel=function(x){return JSON.stringify(x);};
 var inVorig={},inMijn={};
 vorig.forEach(function(x){inVorig[sleutel(x)]=true;});
 mijn.forEach(function(x){inMijn[sleutel(x)]=true;});
 var samen=db.filter(function(x){return !(inVorig[sleutel(x)]&&!inMijn[sleutel(x)]);});
 var al={};samen.forEach(function(x){al[sleutel(x)]=true;});
 mijn.forEach(function(x){if(!inVorig[sleutel(x)]&&!al[sleutel(x)]){samen.push(x);al[sleutel(x)]=true;}});
 return samen;
}
/* Koppelingen zijn groepjes groepen. Na samenvoegen kan een groep in twee
   groepjes staan (A koppelde G1-G2, B tegelijk G2-G3); die horen dan bij elkaar. */
function voegClustersSamen(lijst){
 var uit=[];
 lijst.forEach(function(k){
  if(!Array.isArray(k))return;
  var nieuw=k.slice();
  uit=uit.filter(function(u){
   if(u.some(function(g){return nieuw.indexOf(g)>-1;})){u.forEach(function(g){if(nieuw.indexOf(g)<0)nieuw.push(g);});return false;}
   return true;
  });
  uit.push(nieuw);
 });
 return uit.filter(function(k){return k.length>1;});
}
/* Samenvoegen tot op het diepste niveau. Alleen het bovenste niveau (per groep,
   per cliënt) was niet genoeg: meldden twee medewerkers tegelijk een andere dag
   aan voor dezelfde cliënt, of pasten twee beheerders van dezelfde groep de één
   het telefoonnummer en de ander het e-mailadres aan, dan verdween het werk van
   de eerste (aangetoond met diep-samen.js). Lijsten blijven één waarde. */
function isGewoonObject(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function voegDiepSamen(db,vorig,mijn){
 var uit=Object.assign({},isGewoonObject(db)?db:{});
 vorig=isGewoonObject(vorig)?vorig:{};
 Object.keys(mijn).forEach(function(k){
  if(JSON.stringify(mijn[k])===JSON.stringify(vorig[k]))return;
  if(isGewoonObject(mijn[k])&&isGewoonObject(vorig[k])&&isGewoonObject(uit[k]))uit[k]=voegDiepSamen(uit[k],vorig[k],mijn[k]);
  else uit[k]=JSON.parse(JSON.stringify(mijn[k]));
 });
 Object.keys(vorig).forEach(function(k){if(!(k in mijn))delete uit[k];});
 return uit;
}
function syncOrganisatieData(){return inRij(schrijfOrgWeg);}
async function schrijfOrgWeg(){
 if(!sb)return false;
 if(opslagGeblokkeerd())return false;
 try{
  var alle=orgRijen();
  var rijen=alle.filter(function(r){return dbStandOrg[r.sleutel]!==JSON.stringify(r.waarde);});
  if(!rijen.length)return registreerOpslag('organisatie',true);
  /* Veel instellingen staan per groep in één object (adres, tweestaps,
     Digibord, standaardrollen per groep). Het hele object terugschrijven wiste
     wat een andere beheerder intussen bij een andere groep had aangepast
     (aangetoond). Voor objecten dus per onderdeel samenvoegen met wat er nu in
     de database staat; lijsten gaan nog in hun geheel. */
  var objecten=rijen.filter(function(r){return r.waarde&&typeof r.waarde==='object'&&!Array.isArray(r.waarde);});
  if(objecten.length){
   var huidig=await sb.from('organisatie_data').select('sleutel,waarde').in('sleutel',objecten.map(function(r){return r.sleutel;}));
   if(huidig.error)return registreerOpslag('organisatie',false);
   objecten.forEach(function(r){
    var db=((huidig.data||[]).filter(function(x){return x.sleutel===r.sleutel;})[0]||{}).waarde;
    if(!db||typeof db!=='object'||Array.isArray(db))return;
    var vorig=dbStandOrg[r.sleutel]?JSON.parse(dbStandOrg[r.sleutel]):{};
    if(!vorig||typeof vorig!=='object'||Array.isArray(vorig))vorig={};
    var samen=voegDiepSamen(db,vorig,r.waarde);
    /* Het object in het geheugen zelf bijwerken, zodat ook in beeld komt wat
       een ander deed. */
    werkBijOpZijnPlek(r.waarde,samen);
   });
  }
  /* Lijsten (instituten, locaties, koppelingen, verwijderde groepen) gingen in
     hun geheel terug: sloegen twee beheerders tegelijk iets op, dan verdween
     wat de eerste had toegevoegd (aangetoond, lijsten-samen.js). Nu alleen
     wat deze sessie toevoegde of weghaalde, toegepast op wat er nu in de
     database staat. */
  var lijsten=rijen.filter(function(r){return Array.isArray(r.waarde);});
  if(lijsten.length){
   var nu=await sb.from('organisatie_data').select('sleutel,waarde').in('sleutel',lijsten.map(function(r){return r.sleutel;}));
   if(nu.error)return registreerOpslag('organisatie',false);
   var bestaandeGroepen=null,groepenInDb=null;
   if(lijsten.some(function(r){return r.sleutel==='groep_koppelingen'||r.sleutel==='gearchiveerde_groepen';})){
    var gq=await alleRijen(function(){return sb.from('groepen').select('naam').order('id');});
    if(!gq.error&&gq.data){groepenInDb=gq.data.map(function(x){return x.naam;});bestaandeGroepen=groepenInDb.concat(groepMutaties.erbij);}
   }
   lijsten.forEach(function(r){
    var db=((nu.data||[]).filter(function(x){return x.sleutel===r.sleutel;})[0]||{}).waarde;
    /* Bestaat de sleutel nog niet (de eerste keer), dan toch dezelfde weg:
       anders ging bijvoorbeeld de allereerste koppeling ongecontroleerd de
       database in, ook met een groep die een ander net had hernoemd
       (aangetoond met invarianten.js). */
    if(!Array.isArray(db))db=[];
    var vorig=dbStandOrg[r.sleutel]?JSON.parse(dbStandOrg[r.sleutel]):[];
    if(!Array.isArray(vorig))vorig=[];
    var samen=voegLijstSamen(db,vorig,r.waarde);
    if(r.sleutel==='groep_koppelingen'){
     /* Een koppeling met een groep die een ander intussen verwijderde of
        hernoemde, hoort niet terug te komen. */
     if(bestaandeGroepen)samen=samen.map(function(k){return Array.isArray(k)?k.filter(function(g){return bestaandeGroepen.indexOf(g)>-1;}):k;});
     samen=voegClustersSamen(samen);
    }
    /* Een groep die in de database nog bestaat, staat niet in de lijst van
       verwijderde groepen. Mislukte het verwijderen (bijvoorbeeld door een
       conflict), dan schreef een ander opslagpad de lijst toch weg en stond de
       groep op beide plekken (aangetoond met invarianten.js). */
    if(r.sleutel==='gearchiveerde_groepen'&&groepenInDb)samen=samen.filter(function(g){return groepenInDb.indexOf(g)<0;});
    r.waarde.length=0;Array.prototype.push.apply(r.waarde,samen);
   });
  }
  var res=await sb.from('organisatie_data').upsert(rijen,{onConflict:'sleutel'});
  if(!res.error)rijen.forEach(function(r){dbStandOrg[r.sleutel]=JSON.stringify(r.waarde);});
  return registreerOpslag('organisatie',!res.error);
 }catch(e){return registreerOpslag('organisatie',false);}
}

function updateTally(){
 var nieuw=0,gewijzigd=0,verwijderd=0;
 people.forEach(function(p){if(p._state==='nieuw')nieuw++;else if(p._state==='gewijzigd')gewijzigd++;else if(p._state==='verwijderd')verwijderd++;});
 var totaal=nieuw+gewijzigd+verwijderd;
 el('tally-count').textContent=totaal+' wijziging'+(totaal===1?'':'en');
 var totalW=Math.max(totaal,1);
 el('tally-nieuw').style.width=(nieuw/totalW*100)+'%';
 el('tally-gewijzigd').style.width=(gewijzigd/totalW*100)+'%';
 el('tally-verwijderd').style.width=(verwijderd/totalW*100)+'%';
 el('verzenden-btn').disabled=totaal===0;
 el('concept-badge').hidden=totaal===0;
 /* Dezelfde telling in de Admin Tools, zodat je daar ziet dat er nog iets
    openstaat zonder eerst naar het groepsprofiel te hoeven. */
 var admTeller=el('adm-wijzig-teller');
 if(admTeller)admTeller.textContent=totaal?String(totaal):'';
 var admKnop=document.querySelector('[data-adm="doorvoeren"]');
 if(admKnop)admKnop.classList.toggle('heeftwerk',totaal>0);
 el('formulier-tellingen').textContent='Cliënten – '+personenVanType('client').length+'  ·  Medewerkers – '+personenVanType('medewerker').length+'  ·  Naasten – '+personenVanType('naaste').length;
}
function heeftOnopgeslagenWijzigingen(){return people.some(function(p){return p._state;});}

/* --- Modal --- */
/* Zonder toetsenbordafhandeling zit je in een venster vast zodra je geen muis
   gebruikt: Escape deed niets en de focus bleef achter de overlay hangen. */
var modalHerkomst=null;
function focusbaarIn(container){
 return Array.prototype.filter.call(
  container.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
  function(e){return !e.disabled&&e.offsetParent!==null;});
}
/* ---- Handelingen in het scherm zelf ----
   De twintig knoppen openden een venster over de pagina. In de echte
   beheeromgeving vult de gekozen handeling het scherm eronder, zodat je blijft
   zien waar je bent en wat je hebt aangeklikt.
   In plaats van twintig flows te herschrijven verhuist hier het venster zelf:
   hetzelfde element krijgt een andere plek op de pagina. Alle bestaande
   stappen, velden en controles blijven daardoor ongewijzigd werken. */
var admInline=false;
var admVorigTab='bulk';
var admActieNaam='';
function admPaneelAan(){
 var kaart=el('modal-card'),paneel=el('adm-scherm');
 if(!kaart||!paneel)return;
 if(kaart.parentNode!==el('adm-scherm-body'))el('adm-scherm-body').appendChild(kaart);
 kaart.removeAttribute('aria-modal');
 paneel.hidden=false;
 el('modal-overlay').hidden=true;
 el('admin-intro').hidden=true;
 Array.prototype.forEach.call(document.querySelectorAll('[id^="admintab-"]'),function(sec){sec.hidden=true;});
 /* Een handeling loopt vaak over drie stappen (type, groep, persoon). Zonder
    de naam van de handeling erbij weet je halverwege niet meer of je iemand
    aan het aanmaken of aan het verwijderen bent — en dat scheelt nogal. */
 var titel=kaart.querySelector('h3');
 var vraag=titel?titel.textContent:'';
 el('adm-scherm-titel').textContent=admActieNaam||vraag||'Handeling';
 var stap=el('adm-scherm-stap');
 if(stap)stap.textContent=(admActieNaam&&vraag&&vraag!==admActieNaam)?vraag:'';
 if(titel)titel.hidden=true;
}
function admPaneelUit(){
 var kaart=el('modal-card'),paneel=el('adm-scherm');
 admInline=false;
 if(paneel)paneel.hidden=true;
 if(kaart&&kaart.parentNode!==el('modal-overlay')){
  el('modal-overlay').appendChild(kaart);
  kaart.setAttribute('aria-modal','true');
 }
 if(el('admin-intro'))el('admin-intro').hidden=!(el('admintab-bulk')&&!el('admintab-bulk').hidden);
 admActieNaam='';
 if(typeof wisActieveAdmKnop==='function')wisActieveAdmKnop();
 var actief=document.querySelector('[data-admintab].on');
 kiesAdmintab(actief?actief.getAttribute('data-admintab'):admVorigTab);
}
function openModal(html){
 modalHerkomst=document.activeElement;
 el('modal-card').innerHTML=html;
 /* Een formulier met labels links heeft meer breedte nodig dan een melding;
    anders blijft er voor het invoerveld nauwelijks ruimte over. */
 el('modal-card').classList.toggle('breed',!!el('modal-card').querySelector('.admblok'));
 if(admInline){admPaneelAan();}
 else{
  if(el('modal-card').parentNode!==el('modal-overlay'))admPaneelUit();
  el('modal-overlay').hidden=false;
 }
 var eerste=focusbaarIn(el('modal-card'))[0];
 (eerste||el('modal-card')).focus();
}
function closeModal(){
 /* Een handeling van drie stappen roept hiertussen ook closeModal aan. Sloten
    we het paneel meteen, dan viel de handeling halverwege uit elkaar. Daarom
    wordt alleen de inhoud geleegd; komt er direct een volgende stap, dan vult
    die hem weer. Blijft hij leeg, dan was het een annulering en gaat het paneel
    alsnog dicht. */
 if(admInline&&el('modal-card').parentNode===el('adm-scherm-body')){
  el('modal-card').innerHTML='';
  setTimeout(function(){
   if(admInline&&el('modal-card').parentNode===el('adm-scherm-body')&&!el('modal-card').querySelector('h3'))admPaneelUit();
  },0);
  return;
 }
 if(typeof wisActieveAdmKnop==='function')wisActieveAdmKnop();
 el('modal-overlay').hidden=true;
 /* Terug naar de knop waarmee het venster geopend werd, zodat je niet
    bovenaan de pagina opnieuw moet zoeken waar je was. */
 if(modalHerkomst&&document.contains(modalHerkomst)&&modalHerkomst.offsetParent!==null)modalHerkomst.focus();
 modalHerkomst=null;
}
function modalOpen(){return !el('modal-overlay').hidden;}
/* De handeling staat in het scherm zelf en niet in een venster, maar Escape
   hoort er net zo goed mee op te houden: dat is wat mensen proberen. */
function admPaneelOpen(){var e=el('adm-scherm');return !!e&&!e.hidden;}
document.addEventListener('keydown',function(e){
 if(e.key!=='Escape'||modalOpen()||!admPaneelOpen())return;
 el('modal-card').innerHTML='';
 admPaneelUit();
});
el('modal-overlay').addEventListener('click',function(e){if(e.target===el('modal-overlay'))closeModal();});
document.addEventListener('keydown',function(e){
 if(!modalOpen())return;
 if(e.key==='Escape'){e.preventDefault();closeModal();return;}
 if(e.key!=='Tab')return;
 var lijst=focusbaarIn(el('modal-card'));
 if(!lijst.length)return;
 var eerste=lijst[0],laatste=lijst[lijst.length-1];
 if(e.shiftKey&&document.activeElement===eerste){e.preventDefault();laatste.focus();}
 else if(!e.shiftKey&&document.activeElement===laatste){e.preventDefault();eerste.focus();}
});

/* De uitleg stond vol met woorden uit het systeem: standaardrollen op
   "globaal-, groeps-, cliënten- en medewerkersniveau". Wie hier werkt hoeft dat
   niet te weten — die wil weten wat een cliënt, medewerker of naaste is en wat
   hij hier kan doen. */
var INFOTEXT={
 client:{titel:'Cliënten',tekst:'De bewoners van deze groep. Je vult alleen een naam in. Wie hun gegevens mag zien, stel je per medewerker of naaste in.'},
 medewerker:{titel:'Medewerkers',tekst:'De mensen die in deze groep werken. Ze krijgen automatisch de rechten die voor deze groep zijn ingesteld. Je kunt dat per persoon aanpassen.'},
 naaste:{titel:'Naasten',tekst:'Familie of mantelzorgers. Je geeft ze toegang tot één of meer cliënten, niet tot de hele groep.'}
};
function infoSecties(keys){
 return keys.map(function(k){return '<div class="msec"><b>'+INFOTEXT[k].titel+'</b><p>'+INFOTEXT[k].tekst+'</p></div>';}).join('');
}
el('info-toggle').addEventListener('click',function(){
 openModal('<h3>Uitleg</h3><div class="msec"><p>Wat je hier verandert, gaat pas in als je op <b>Wijzigingen doorvoeren</b> klikt. Tot die tijd kun je alles nog aanpassen.</p></div>'
  +infoSecties(['client','medewerker','naaste'])
  +'<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Snap ik</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
});
el('formulier-help').addEventListener('click',function(){el('info-toggle').click();});
document.querySelectorAll('[data-help]').forEach(function(b){
 b.addEventListener('click',function(e){
  e.stopPropagation();
  openModal('<h3>'+INFOTEXT[b.getAttribute('data-help')].titel+'</h3>'+infoSecties([b.getAttribute('data-help')])+'<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Snap ik</button></div>');
  el('modal-snap').addEventListener('click',closeModal);
 });
});
el('formulier-terug').addEventListener('click',function(){
 if(heeftOnopgeslagenWijzigingen()){
  openModal('<h3>Wijzigingen niet opgeslagen</h3><div class="msec"><p>Je hebt wijzigingen gemaakt die nog niet zijn doorgevoerd. Als je nu teruggaat, blijft dit concept bewaard en kun je later verdergaan.</p></div>'
   +'<div class="modal-actions"><button type="button" id="modal-blijf">Blijf op deze pagina</button><button type="button" class="primary" id="modal-terug">Toch teruggaan</button></div>');
  el('modal-blijf').addEventListener('click',closeModal);
  el('modal-terug').addEventListener('click',function(){closeModal();show('pp-hub');});
 }else{
  show('pp-hub');
 }
});
/* Aanmaken en het profiel openen zijn twee dingen. Bij het plakken van een lijst
   wil je alleen het eerste, anders klapt er bij elke regel een scherm open. */
function maakPersoon(t){
 /* Een nieuwe medewerker in een gekoppelde groep hoort meteen in het hele
    cluster te staan, anders klopt het team al bij het aanmaken niet. */
 var startGroepen=t==='medewerker'?clusterVan(huidigeGroep).filter(function(g){return GROEPEN.indexOf(g)>-1;}):[huidigeGroep];
 var basis={id:nextId++,type:t,voor:'',achter:'',mail:'',groepen:startGroepen,_state:'nieuw'};
 if(t==='client'){
  var effM=effectiveFor(huidigeGroep,'medewerker').data;
  if(effM.clienten.rol!=='Geen'){
   personenVanType('medewerker').forEach(function(m){
    m.clientRechten=m.clientRechten||{};
    m.clientRechten[basis.id]=effM.clienten.rol;
    if(m._state!=='nieuw')m._state='gewijzigd';
   });
  }
 }else{
  var eff=effectiveFor(huidigeGroep,t).data;
  basis.rol=eff.globaal.rol!=='Geen'?eff.globaal.rol:ROLLEN[t].globaal[0];
  if(t==='medewerker'){
   basis.clientRechten={};
   if(eff.clienten.rol!=='Geen')personenVanType('client').forEach(function(c){basis.clientRechten[c.id]=eff.clienten.rol;});
   basis.medewerkerRechten={};
   if(eff.medewerkers.rol!=='Geen')personenVanType('medewerker').forEach(function(m){basis.medewerkerRechten[m.id]=eff.medewerkers.rol;});
  }
 }
 people.push(basis);
 return basis;
}
function pushNew(t){
 var basis=maakPersoon(t);
 el('acc-'+t).classList.remove('closed');
 renderAcc(t);if(t==='client')renderAcc('medewerker');updateTally();renderAccountSelect();
 if(t==='client')openProfielClient(basis.id); else openProfielPersoon(basis.id,t);
 return basis;
}
document.querySelectorAll('[data-add]').forEach(function(b){b.addEventListener('click',function(){pushNew(b.getAttribute('data-add'));});});
document.querySelectorAll('[data-toggle]').forEach(function(b){
 var doelId=b.getAttribute('data-toggle');
 var doel=el(doelId);
 /* Een kop die als knop werkt, hoort zich ook als knop te gedragen: te bereiken
    met Tab, te bedienen met Enter of spatie, en hardop te zeggen of de sectie
    openstaat. */
 /* Zit er in de kop nog een eigen knop (het vraagteken), dan mag de kop zelf
    geen knop zijn: een knop in een knop is voor schermlezers onbruikbaar.
    Dan wordt de titel de knop; klikken op de hele kop blijft werken. */
 var knop=b.querySelector('button')?(b.querySelector('b')||b):b;
 knop.setAttribute('role','button');
 knop.setAttribute('tabindex','0');
 var lichaam=doel&&(doel.querySelector('.acc-body')||doel.querySelector('.cbody'));
 if(lichaam){
  if(!lichaam.id)lichaam.id=doelId+'-body';
  knop.setAttribute('aria-controls',lichaam.id);
 }
 var meld=function(){
  if(doel)knop.setAttribute('aria-expanded',doel.classList.contains('closed')?'false':'true');
 };
 meld();
 var wissel=function(){
  if(!doel)return;
  doel.classList.toggle('closed');
  meld();
 };
 b.addEventListener('click',wissel);
 knop.addEventListener('keydown',function(e){
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();wissel();}
 });
});
/* De terugpijl en de kruimels in een profiel gingen direct weg, buiten
   Annuleren om. Een net aangemaakte persoon bleef dan leeg in de lijst staan
   en kwam zonder naam en e-mailadres in de database. Vanuit een profiel lopen
   ze daarom via dezelfde weg als Annuleren. */
document.querySelectorAll('[data-back]').forEach(function(b){b.addEventListener('click',function(){
 var doel=b.getAttribute('data-back');
 if(b.closest('#pp-profiel-persoon')){annuleerProfiel('pp',doel);return;}
 if(b.closest('#pp-profiel-client')){annuleerProfiel('pc',doel);return;}
 show(doel);
});});
document.querySelectorAll('[data-open]').forEach(function(b){b.addEventListener('click',function(){
 show(b.getAttribute('data-open'));
});});
/* Wie welke toegang tot cliëntgegevens geeft of intrekt, moet achteraf te
   herleiden zijn. Het logboek was eerder vaste voorbeeldtekst; het houdt nu de
   echte handelingen bij en bewaart ze in Supabase. */
var LOGBOEK=[];
function logboekTijd(d){
 function tweeCijfers(n){return (n<10?'0':'')+n;}
 return tweeCijfers(d.getDate())+'-'+tweeCijfers(d.getMonth()+1)+'-'+d.getFullYear()+
  ' '+tweeCijfers(d.getHours())+':'+tweeCijfers(d.getMinutes());
}
/* Support en systeembeheer werken niet namens een groep maar namens de
   leverancier of de organisatie. Hun terugbelnummer is een vast servicenummer
   en geen persoonlijk mobiel: dat hoort ingevuld te staan en niet ter plekke
   overschreven te kunnen worden door wie er toevallig achter het scherm zit. */
function terugbelnummer(){
 if(isSupport)return SUPPORT.tel||'';
 if(isSysteembeheerder)return SYSTEEMBEHEER.tel||'';
 var ik=huidigeGebruiker();
 return ik&&ik.tel?ik.tel:'';
}
function nummerLigtVast(){return staatBovenDeGroep();}
function wieBenIk(){
 if(isSupport)return SUPPORT.naam;
 if(isSysteembeheerder)return 'Systeembeheerder';
 var ik=huidigeGebruiker();
 return ik?naam(ik):'Onbekend';
}
/* ---- Audit trail ----
   Elke regel legt vast: wie het deed (Uitgevoerd door), wat voor soort
   wijziging het was, wanneer (Tijdstip) en, bij een blokkade of verwijdering,
   waarom. Het soort wijziging was eerder alleen uit de zin af te leiden; bij
   een audit wil je juist kunnen filteren op "alle verwijderingen van dit jaar".
   Handelingen waar het soort er echt toe doet geven het expliciet mee; de rest
   wordt uit de tekst afgeleid, net als bij oude regels uit de database die
   nog geen soort hebben. */
var SOORT_REGELS=[
 [/definitief gewist/i,'Definitief wissen'],
 [/teruggezet|terug uit de prullenbak|hersteld/i,'Herstel'],
 [/blokkade .*opgeheven/i,'Blokkade opgeheven'],
 [/geblokkeerd/i,'Blokkade'],
 [/archiveren|gearchiveerd|los te koppelen|losgekoppeld|ontkoppeld|verwijder/i,'Verwijdering'],
 [/geëxporteerd|export/i,'Export'],
 [/doorgevoerd/i,'Doorvoeren'],
 [/\brol\b|rollen|rechten|toegang/i,'Rechten en rollen'],
 [/toegevoegd|aangemaakt/i,'Aanmaken'],
 [/standaard|verplicht|gekoppeld|hernoemd|instelling/i,'Instelling']
];
var SOORTEN_WIJZIGING=['Aanmaken','Wijziging','Rechten en rollen','Blokkade','Blokkade opgeheven','Verwijdering','Archivering','Herstel','Definitief wissen','Doorvoeren','Instelling','Export'];
function soortVanActie(tekst){
 for(var i=0;i<SOORT_REGELS.length;i++){if(SOORT_REGELS[i][0].test(tekst||''))return SOORT_REGELS[i][1];}
 return 'Wijziging';
}
function logActie(tekst,extra){
 if(!tekst)return;
 extra=extra||{};
 var regel={tijd:logboekTijd(new Date()),wie:wieBenIk(),groep:huidigeGroep,tekst:tekst,
  soort:extra.soort||soortVanActie(tekst),reden:extra.reden?kap(String(extra.reden),200):''};
 LOGBOEK.unshift(regel);
 if(LOGBOEK.length>LOGBOEK_MAX)LOGBOEK.length=LOGBOEK_MAX;
 if(sb){
  /* Het logboek mag het opslaan van de wijziging zelf nooit blokkeren, maar
     stilzwijgend verdwijnen mag het ook niet: het is de verantwoording. */
  var logRij={wie:regel.wie,groep:regel.groep,tekst:tekst,soort:regel.soort,reden:regel.reden||null};
  var logMislukt=function(){nogTeVersturen.logboek.push(logRij);registreerOpslag('logboek',false);};
  if(!opslagGeblokkeerd())try{sb.from('logboek').insert([logRij]).then(
   function(res){if(res&&res.error)logMislukt();else registreerOpslag('logboek',true);},
   logMislukt);}
  catch(e){logMislukt();}
 }
}
/* Het logboek haalde er 100 regels uit terwijl het geheugen er 200 hield: het
   scherm zei dan "12 van 100 regels" zonder dat ergens stond dat er in de
   database meer staat. Bij een verantwoordingsmiddel is dat misleidend — wie
   niets vindt, concludeert dat het niet gebeurd is. Eén grens, en die wordt
   genoemd. */
var LOGBOEK_MAX=500;
async function laadLogboek(){
 if(!sb)return;
 try{
  var res=await sb.from('logboek').select('tijd,wie,groep,tekst,soort,reden').order('tijd',{ascending:false}).limit(LOGBOEK_MAX);
  if(res.error||!res.data)return;
  LOGBOEK=res.data.map(function(r){
   return {tijd:logboekTijd(new Date(r.tijd)),wie:r.wie,groep:r.groep,tekst:r.tekst,
    soort:r.soort||soortVanActie(r.tekst),reden:r.reden||''};
  });
 }catch(e){/* zonder verbinding blijft het logboek van deze sessie zichtbaar */}
}
el('tekst-groter').addEventListener('click',function(){zetGroteTekst(!groteTekstAan());});
/* Het logboek loopt tot 200 regels. Zonder filter is dat bij een vraag als
   "wat is er met deze cliënt gebeurd?" niet te doorzoeken. Het filter werkt op
   de tekst én op de groep, en de export volgt wat je op dat moment ziet. */
var logboekFilter={term:'',groep:'',van:'',tot:'',soort:''};
/* Een logregel staat als dd-mm-jjjj uu:mm; om op periode te kunnen filteren
   hebben we er een vergelijkbare datum van nodig. */
function logboekDatum(l){
 var m=/^(\d{2})-(\d{2})-(\d{4})/.exec(l.tijd||'');
 return m?(m[3]+'-'+m[2]+'-'+m[1]):'';
}
function gefilterdLogboek(){
 var term=logboekFilter.term.trim().toLowerCase();
 return LOGBOEK.filter(function(l){
  if(logboekFilter.groep&&(l.groep||'')!==logboekFilter.groep)return false;
  if(logboekFilter.soort&&(l.soort||soortVanActie(l.tekst))!==logboekFilter.soort)return false;
  /* "Wat is er in die week gebeurd?" was alleen te beantwoorden door zelf te
     scrollen; bij een verantwoordingsmiddel hoort een periode. */
  var d=logboekDatum(l);
  if(logboekFilter.van&&d&&d<logboekFilter.van)return false;
  if(logboekFilter.tot&&d&&d>logboekFilter.tot)return false;
  if(!term)return true;
  return String(l.tekst||'').toLowerCase().indexOf(term)>-1||
         String(l.wie||'').toLowerCase().indexOf(term)>-1||
         String(l.reden||'').toLowerCase().indexOf(term)>-1;
 });
}
function renderLogboekLijst(){
 var lijst=gefilterdLogboek();
 var doel=el('logboek-lijst');if(!doel)return;
 doel.innerHTML=lijst.length
  ? lijst.map(function(l){
     return '<div class="msec logregel"><div class="logkop"><b>'+esc(l.tijd)+'</b>'+
      '<span class="statuschip">'+esc(l.soort||soortVanActie(l.tekst))+'</span></div>'+
      '<p style="margin:4px 0 2px">'+esc(l.tekst)+(l.groep?' <span class="mini">('+esc(l.groep)+')</span>':'')+'</p>'+
      '<p class="mini" style="margin:0">Uitgevoerd door: '+esc(l.wie||'onbekend')+'</p>'+
      (l.reden?'<p class="mini" style="margin:0">Reden: '+esc(l.reden)+'</p>':'')+'</div>';
    }).join('')
  : '<div class="msec"><p>'+(LOGBOEK.length?'Geen regels die hierop passen.':'Nog geen wijzigingen vastgelegd.')+'</p></div>';
 var teller=el('logboek-teller');
 if(teller)teller.textContent=lijst.length+' van '+LOGBOEK.length+' regel'+(LOGBOEK.length===1?'':'s');
 var knop=el('logboek-export');
 if(knop)knop.disabled=!lijst.length;
}
/* De exportbevestiging vervangt dit venster. Zonder heropenen sta je na het
   downloaden in het niets, terwijl je in het logboek bezig was. */
function openLogboek(behoudFilter){
 if(!behoudFilter)logboekFilter={term:'',groep:'',van:'',tot:'',soort:''};
 var soorten=[''].concat(SOORTEN_WIJZIGING).map(function(x){
  return '<option value="'+esc(x)+'">'+(x?esc(x):'Alle soorten')+'</option>';
 }).join('');
 var groepen=[''].concat(GROEPEN).map(function(g){
  return '<option value="'+esc(g)+'">'+(g?esc(g):'Alle groepen')+'</option>';
 }).join('');
 openModal('<h3>Logboek</h3><p class="mini" style="margin:0 0 10px">Wie heeft wanneer iets aan gebruikers of rechten gewijzigd. '+
  (LOGBOEK.length>=LOGBOEK_MAX?'Dit scherm toont de laatste '+LOGBOEK_MAX+' regels; oudere regels blijven in de database staan maar staan hier niet bij.':'')+'</p>'+
  '<div class="row"><div class="field"><label for="logboek-zoek">Zoeken</label>'+
  '<input id="logboek-zoek" maxlength="60" placeholder="Naam, cliënt of wat er gebeurde"></div>'+
  '<div class="field"><label for="logboek-groep">Groep</label><select id="logboek-groep">'+groepen+'</select></div>'+
  '<div class="field"><label for="logboek-soort">Type wijziging</label><select id="logboek-soort">'+soorten+'</select></div></div>'+
  '<div class="row"><div class="field"><label for="logboek-van">Van</label><input type="date" id="logboek-van" value="'+esc(logboekFilter.van)+'"></div>'+
  '<div class="field"><label for="logboek-tot">Tot en met</label><input type="date" id="logboek-tot" value="'+esc(logboekFilter.tot)+'"></div></div>'+
  '<p class="mini" id="logboek-teller" style="margin:0 0 8px"></p>'+
  '<div id="logboek-lijst"></div>'+
  '<div class="modal-actions"><button type="button" id="logboek-export">Exporteren (CSV)</button><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
 el('logboek-export').addEventListener('click',exporteerLogboek);
 el('logboek-zoek').addEventListener('input',function(){logboekFilter.term=this.value;renderLogboekLijst();});
 el('logboek-van').addEventListener('change',function(){logboekFilter.van=this.value;renderLogboekLijst();});
 el('logboek-tot').addEventListener('change',function(){logboekFilter.tot=this.value;renderLogboekLijst();});
 el('logboek-groep').addEventListener('change',function(){logboekFilter.groep=this.value;renderLogboekLijst();});
 el('logboek-soort').addEventListener('change',function(){logboekFilter.soort=this.value;renderLogboekLijst();});
 el('logboek-soort').value=logboekFilter.soort;
 el('logboek-zoek').value=logboekFilter.term;
 el('logboek-groep').value=logboekFilter.groep;
 renderLogboekLijst();
}
el('logboek-btn').addEventListener('click',function(){openLogboek(false);});
/* Een export haalt bijzondere persoonsgegevens uit de beveiligde omgeving: dat
   iemand cliënt is van een zorggroep zegt iets over zijn gezondheid (AVG art. 9).
   Buiten de app gelden de beveiliging en de rechten van deze app niet meer, dus
   dat hoort een bewuste keuze te zijn en geen losse klik. */
function bevestigExport(wat,omschrijving,onJa){
 bevestigModal('Export met persoonsgegevens',
  '<p>Je maakt een bestand met <b>'+esc(omschrijving)+'</b>.</p>'+
  '<p>Dit zijn bijzondere persoonsgegevens: uit dit bestand blijkt wie zorg ontvangt en wie daarbij betrokken is. Zodra het is gedownload gelden de rechten en de beveiliging van MyWepp er niet meer voor.</p>'+
  '<p>Gebruik het alleen voor het doel waarvoor je het opvraagt, bewaar het niet langer dan nodig en deel het niet breder dan noodzakelijk. De download wordt vastgelegd in het logboek.</p>',
  'Ja, exporteren',onJa);
}
/* Bij een audit of incident wil je het logboek buiten de app kunnen aanleveren. */
/* Een cel die begint met = + - @ (of tab/return) voert Excel uit als formule.
   Via een naam of reden kon zo een link of opdracht in de export belanden
   (CSV-injectie, aangetoond). Zo'n cel krijgt een apostrof ervoor: Excel toont
   dan gewoon de tekst. */
function csvVeld(waarde){
 var t=String(waarde==null?'':waarde);
 if(/^[=+\-@\t\r]/.test(t))t="'"+t;
 return '"'+t.replace(/"/g,'""')+'"';
}
/* BOM zodat Excel de accenten goed leest. */
function downloadCsv(regels,bestandsnaam){
 var blob=new Blob(['\ufeff'+regels.join('\r\n')],{type:'text/csv;charset=utf-8;'});
 var url=URL.createObjectURL(blob);
 var a=document.createElement('a');
 a.href=url;a.download=bestandsnaam+'-'+new Date().toISOString().slice(0,10)+'.csv';
 document.body.appendChild(a);a.click();document.body.removeChild(a);
 setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function exporteerLogboek(){
 /* Exporteer wat je op dit moment ziet: anders lever je bij een gerichte vraag
    alsnog het hele logboek aan. Dataminimalisatie (AVG art. 5 lid 1 sub c). */
 var lijst=gefilterdLogboek();
 if(!lijst.length)return;
 bevestigExport('logboek',lijst.length+' logboekregel(s) met namen van betrokkenen',function(){exporteerLogboekNu(lijst);openLogboek(true);});
}
function exporteerLogboekNu(lijst){
 var regels=[['Tijdstip','Uitgevoerd door','Groep','Type wijziging','Wat','Reden'].map(csvVeld).join(';')];
 lijst.forEach(function(l){regels.push([l.tijd,l.wie,l.groep||'',l.soort||soortVanActie(l.tekst),l.tekst,l.reden||''].map(csvVeld).join(';'));});
 downloadCsv(regels,'mywepp-logboek');
 logActie(lijst.length+' logboekregel(s) geëxporteerd');
}

/* --- Gearchiveerd --- */
/* Twee fasen van verwijderen, allebei omkeerbaar:
   - Prullenbak: gemarkeerd, maar nog niet doorgevoerd. Er is nog niets gebeurd,
     terugzetten haalt alleen de markering weg.
   - Archief (soft delete): doorgevoerd. Inloggen kan niet meer, maar de
     gegevens blijven de bewaartermijn staan en zijn terug te zetten.
   Pas "Definitief wissen" haalt iets echt weg. */
function prullenbakRijHtml(p){
 var elders=blijftElders(p)&&andereGroepenVan(p).length;
 return '<div class="personrow"><div class="pinfo"><div class="naam">'+esc(naam(p))+' <span class="mini">— '+TYPELABEL[p.type]+'</span>'+
  ' <span class="statuschip" style="background:var(--amber-bg,#fff4e0);color:var(--amber)">Prullenbak</span></div>'+
  '<div class="mail">'+(elders?'Wordt bij doorvoeren losgekoppeld van '+esc(huidigeGroep):'Wordt bij doorvoeren gearchiveerd')+
  (p._verwijderReden?' · reden: '+esc(p._verwijderReden):'')+'</div></div>'+
  '<button type="button" class="small" data-uitprullenbak="'+p.id+'">Terugzetten</button></div>';
}
function haalUitPrullenbak(id){
 var p=findPerson(id);if(!p||p._state!=='verwijderd')return;
 /* Terug naar hoe hij stond: gewijzigd als er vóór het verwijderen al iets
    aan hem was aangepast, anders ongewijzigd. */
 delete p._state;
 if(wijzigingDetails(p).length)p._state='gewijzigd';
 delete p._verwijderReden;delete p._doorBeheer;
 logActie(naam(p)+' terug uit de prullenbak',{soort:'Herstel'});
 renderGearchiveerd();renderAll();
}
/* Wat de beheerder via de Admin Tools verwijderde, hoort niet in het archief
   dat medewerkers in hun groep zien. Dat staat in Cliënt of (Non)prof.
   herstellen in de Admin Tools. */
function doorBeheer(p){return !!(p._doorBeheer||p.archiefSoort==='beheer');}
function archiefRijHtml(p,opties){
 var maanden=maandenSinds(p.gearchiveerdOp);
 var termijn=bewaartermijnVerstreken(p)
  ? ' <span class="statuschip" style="background:var(--brick-bg);color:var(--brick)">Bewaartermijn verstreken</span>'
  : (maanden!==null?' <span class="statuschip" style="background:var(--paper);color:var(--ink-soft)">'+maanden+' maand'+(maanden===1?'':'en')+' in archief</span>':'');
 var datums=geldigeDatum(p.gearchiveerdOp)
  ? '<div class="archiefdatum">Gearchiveerd op '+esc(datumNL(p.gearchiveerdOp))+' · bewaren tot '+esc(datumNL(bewaarTot(p)))+
    (p.gearchiveerdReden?' · reden: '+esc(p.gearchiveerdReden):'')+'</div>'
  : '';
 return '<div class="personrow"><div class="pinfo"><div class="naam">'+esc(naam(p))+' <span class="mini">— '+TYPELABEL[p.type]+'</span>'+termijn+'</div><div class="mail">'+esc(p.mail||'—')+'</div>'+datums+'</div>'+
  '<button type="button" class="small" data-avg="'+p.id+'">Inzage</button>'+
  '<button type="button" class="small" data-herstel="'+p.id+'">Herstellen</button>'+
  (opties&&opties.wissen?'<button type="button" class="small danger" data-wis="'+p.id+'">Definitief wissen</button>':'')+'</div>';
}
function koppelArchiefKnoppen(lijst,terug){
 Array.prototype.forEach.call(lijst.querySelectorAll('[data-uitprullenbak]'),function(b){
  b.addEventListener('click',function(){haalUitPrullenbak(+b.getAttribute('data-uitprullenbak'));if(terug)terug();});
 });
 Array.prototype.forEach.call(lijst.querySelectorAll('[data-avg]'),function(b){
  b.addEventListener('click',function(){openAvgDossier(+b.getAttribute('data-avg'));});
 });
 Array.prototype.forEach.call(lijst.querySelectorAll('[data-wis]'),function(b){
  b.addEventListener('click',function(){wisDefinitief(+b.getAttribute('data-wis'),terug);});
 });
 Array.prototype.forEach.call(lijst.querySelectorAll('[data-herstel]'),function(b){
  b.addEventListener('click',function(){
   var p=findPerson(+b.getAttribute('data-herstel'));
   if(!p)return;
   /* Terugzetten is niet alleen iemand weer zichtbaar maken: alle rechten die
      hij had komen in één klap terug, ook op cliënten. Dat hoort niet
      ongemerkt te gebeuren, dus eerst laten zien wat er terugkomt. */
   var aantal=RECHTVELDEN.reduce(function(n,veld){return n+Object.keys(p[veld]||{}).length;},0);
   var verlopen=toegangVerlopen(p);
   bevestigModal('Terugzetten uit het archief',
    '<p><b>'+esc(naam(p))+'</b> komt terug in '+esc((p.groepen||[]).join(', ')||'geen groep')+'.</p>'+
    '<p>'+(aantal?'Daarmee komen ook '+aantal+' eerder vastgelegde recht'+(aantal===1?'':'en')+' terug, waaronder toegang tot cli\u00ebnten.':'Deze persoon had geen rechten op anderen.')+
    (verlopen?' De tijdelijke toegang is verlopen op '+esc(datumNL(p.toegangTot))+', dus inloggen kan pas na een nieuwe einddatum.':'')+
    (p.geblokkeerd?' Let op: dit account staat geblokkeerd en blijft dat.':'')+'</p>',
    'Ja, terugzetten',function(){
     p.archived=false;delete p.gearchiveerdOp;delete p.archiefSoort;
     /* Is zijn groep intussen gekoppeld, dan hoort hij in het hele team. */
     vulKoppelingAan(p);
     logActie(naam(p)+' teruggezet uit het archief'+(aantal?' met '+aantal+' recht'+(aantal===1?'':'en'):''),{soort:'Herstel'});
     delete p.gearchiveerdReden;
     renderGearchiveerd();renderAll();
     syncToSupabase();
     if(terug)terug();
    });
  });
 });
}
function renderGearchiveerd(){
 if(el('archief-termijn'))el('archief-termijn').textContent=bewaartermijnTekst();
 var prullenbak=people.filter(function(p){return p._state==='verwijderd'&&!p.archived&&!doorBeheer(p)&&p.groepen.indexOf(huidigeGroep)>-1;});
 var gearchiveerd=people.filter(function(p){return p.archived&&!doorBeheer(p)&&p.groepen.indexOf(huidigeGroep)>-1;});
 var prullenbakHtml=prullenbak.length
  ? '<div class="sublistlabel" style="margin:14px 16px 6px">Prullenbak — nog niet doorgevoerd</div><div style="padding:0 12px">'+prullenbak.map(prullenbakRijHtml).join('')+'</div>'+
    '<div class="sublistlabel" style="margin:14px 16px 6px">Archief</div>'
  : '';
 el('gearchiveerd-lijst').innerHTML=prullenbakHtml+(gearchiveerd.length? gearchiveerd.map(function(p){return archiefRijHtml(p);}).join('')
  : '<p class="empty-msg" style="padding:16px 22px">Nog niemand gearchiveerd in deze groep.</p>');
 koppelArchiefKnoppen(el('gearchiveerd-lijst'));
}
el('naar-gearchiveerd').addEventListener('click',function(){renderGearchiveerd();show('pp-gearchiveerd');});

/* Echt wissen: archiveren haalt iemand alleen uit beeld, maar de gegevens
   blijven staan. Voor een verwijderverzoek (art. 17) en voor de bewaartermijn
   moet het rij-en-al weg, ook uit de database. Onomkeerbaar, dus alleen na een
   expliciete bevestiging. */
async function wisDefinitiefUitDatabase(id){
 if(!sb)return true;
 /* Tijdens het laden hoort dit id bij een voorbeeldpersoon; wissen zou de
    echte persoon met hetzelfde id raken. */
 if(opslagGeblokkeerd())return false;
 try{
  var res=await sb.from('personen').delete().eq('id',id);
  if(res.error)return false;
  /* Rechten die anderen op deze persoon hadden, ook bij mensen die deze
     sessie niet kent. */
  return await ruimRechtenOpInDatabase([],[id]);
 }catch(e){return false;}
}
/* Vergetelheid hield op bij de persoonsrij. Het dossier zelf — doelen,
   rapportages, agenda, Ik-Boek, geheugensteuntjes, instellingen en de
   gesprekken — bleef staan in client_data en chat_threads, terwijl juist dat
   gezondheidsgegevens zijn (AVG art. 9). Wissen betekent dat dat ook weggaat. */
function chatSleutelsVanClient(id){
 var sleutels=['group-'+id];
 people.forEach(function(x){
  if(x.type==='medewerker')sleutels.push(chatSleutel1op1(id,x.id));
 });
 var d=CLIENTDATA[id];
 if(d&&d.customChats)d.customChats.forEach(function(c){if(c.key)sleutels.push(c.key);});
 Object.keys(CHATSTORE).forEach(function(k){
  if(k.indexOf('group-'+id)===0||k.indexOf('1on1-'+id+'-')===0||k.indexOf('groep-custom-'+id+'-')===0)sleutels.push(k);
 });
 return sleutels.filter(function(k,i,arr){return arr.indexOf(k)===i;});
}
function wisClientDossierLokaal(id){
 var sleutels=chatSleutelsVanClient(id);
 sleutels.forEach(function(k){delete CHATSTORE[k];});
 delete CLIENTDATA[id];delete GEHEUGEN[id];delete CA_INSTELLINGEN[id];
 return sleutels;
}
async function wisClientDossierUitDatabase(id,sleutels){
 if(!sb)return true;
 if(opslagGeblokkeerd())return false;
 var goed=true;
 try{
  var a=await sb.from('client_data').delete().eq('client_id',id);
  if(a&&a.error)goed=false;
  if(sleutels.length){
   var b=await sb.from('chat_threads').delete().in('sleutel',sleutels);
   if(b&&b.error)goed=false;
  }
 }catch(e){goed=false;}
 return goed;
}
/* Definitief wissen is voorbehouden aan MyWepp zelf (support of systeembeheer,
   via de Admin Tools). Medewerkers kunnen archiveren en terugzetten, niet wissen. */
function magDefinitiefWissen(){return el('rol-select').value==='support'||isSysteembeheerder;}
function wisDefinitief(id,terug){
 var p=findPerson(id);if(!p)return;
 if(!magDefinitiefWissen())return;
 var naamVal=naam(p);
 var maanden=maandenSinds(p.gearchiveerdOp);
 /* Binnen de bewaartermijn mag wissen alleen met een onderbouwing (bijvoorbeeld
    een gegrond verwijderverzoek onder AVG art. 17). Die reden is dan
    verplicht en komt in het logboek; zo is achteraf te verantwoorden waarom
    er vóór het einde van de termijn is gewist. */
 var binnenTermijn=!bewaartermijnVerstreken(p);
 var redenVeld='<fieldset class="admblok"><legend>Reden</legend><div class="admveld">'+
  '<label for="modal-wis-reden">Reden'+(binnenTermijn?'<span class="verplicht">*</span>':' (optioneel)')+'</label>'+
  '<input class="admin" id="modal-wis-reden" maxlength="200" placeholder="Bijvoorbeeld: verwijderverzoek van betrokkene"></div>'+
  '<p class="mini veldfout" id="modal-wis-reden-fout" hidden>Geef een reden: de bewaartermijn loopt nog.</p></fieldset>';
 openModal('<h3>'+esc('Definitief wissen: '+naamVal)+'</h3><div class="msec">'+
  (binnenTermijn&&geldigeDatum(p.gearchiveerdOp)?'<p style="color:var(--brick)"><b>Let op:</b> de wettelijke bewaartermijn loopt nog tot '+esc(datumNL(bewaarTot(p)))+'. Wis alleen eerder als daar een gegronde reden voor is.</p>':'')+
  '<p>Alle gegevens van <b>'+esc(naamVal)+'</b> worden verwijderd: naam, contactgegevens, profielfoto, groepskoppelingen en alle rechten van en op deze persoon. Ook uit de database.</p>'+
  (p.type==='client'?'<p>Daarbij hoort ook het hele dossier: doelen, rapportages, agenda, Ik-Boek, geheugensteuntjes, instellingen en alle gesprekken over '+esc(naamVal)+'.</p>':'')+
  '<p>Dit kun je niet ongedaan maken en herstellen uit het archief kan daarna niet meer.'+
  (maanden!==null?' Deze persoon staat '+maanden+' maand'+(maanden===1?'':'en')+' in het archief.':'')+'</p>'+
  '<p>Het logboek blijft wel bestaan. Dat is de verantwoording over wat er is gebeurd en mag niet worden gewist.</p></div>'+
  redenVeld+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="danger" id="modal-bevestig">Ja, definitief wissen</button></div>');
 el('modal-annuleer').addEventListener('click',function(){if(terug)terug();else closeModal();});
 el('modal-bevestig').addEventListener('click',function(){
   var reden=kap(el('modal-wis-reden').value.trim(),200);
   if(binnenTermijn&&!reden){el('modal-wis-reden-fout').hidden=false;el('modal-wis-reden').style.borderColor='var(--brick)';return;}
   closeModal();
   verwijderVerwijzingenNaar(id);
   var sleutels=p.type==='client'?wisClientDossierLokaal(id):[];
   people=people.filter(function(x){return x.id!==id;});
   logActie(naamVal+' definitief gewist'+(binnenTermijn?' vóór het einde van de bewaartermijn':' na het verstrijken van de bewaartermijn')+(p.type==='client'?', inclusief het volledige dossier':''),{soort:'Definitief wissen',reden:reden});
   /* Eerst de opgeruimde verwijzingen van anderen wegschrijven (rechten op
      deze persoon, wettelijk vertegenwoordiger), pas dan wissen. Andersom
      weigerde de database het wissen zolang iemand hem als vertegenwoordiger
      had, en bleven oude rechten op dit id in de database staan: een nieuwe
      persoon die na herladen hetzelfde id krijgt, erfde die dan. */
   /* Eerst het dossier, pas daarna de persoon. Tegelijk wissen liet bij een
      storing op client_data een dossier met gezondheidsgegevens achter zonder
      persoon, dat via de app niet meer te vinden en dus niet meer te wissen
      was. Nu blijft bij elke storing de persoon in het archief staan, en kan
      het wissen daar opnieuw. */
   inRij(function(){return schrijfPersonenWeg().then(function(){
    return p.type==='client'?wisClientDossierUitDatabase(id,sleutels):true;
   }).then(function(dossierWeg){
    return dossierWeg?wisDefinitiefUitDatabase(id):false;
   });}).then(function(gelukt){
    if(!gelukt)openMelding('Niet volledig gewist','De gegevens zijn hier weggehaald, maar het wissen uit de database is niet gelukt. Herlaad de pagina: '+naamVal+' staat dan nog in het archief en daar kun je het definitief wissen opnieuw doen.');
   });
   renderGearchiveerd();renderAll();
   if(terug)terug();
  });
}

/* ============== AVG ==============
   Deze app verwerkt bijzondere persoonsgegevens: dat iemand cliënt is van een
   zorggroep zegt iets over zijn gezondheid (AVG art. 9). Dat stelt drie eisen
   die hier eerder nergens werden ondersteund:
   - inzage en dataportabiliteit (art. 15 en 20): iemand mag opvragen wat er
     over hem is vastgelegd, in een leesbaar en overdraagbaar bestand;
   - vergetelheid (art. 17): echt wissen, niet alleen uit beeld halen;
   - opslagbeperking (art. 5 lid 1 sub e): niet langer bewaren dan nodig.
   Het logboek zelf blijft juist staan: dat is de verantwoordingsplicht van
   art. 5 lid 2 en mag niet door een verwijderverzoek worden uitgewist. */
/* Wettelijke bewaartermijn voor gearchiveerde accounts, op verzoek van de
   klant 15 jaar. Eén constante: alle teksten, signalen en het register rekenen
   hiermee. Let op: voor het medisch dossier zelf geldt onder de WGBO sinds
   2020 twintig jaar; als het archief ook dossiergegevens moet dragen, moet
   deze waarde daarop worden afgestemd. */
var BEWAARTERMIJN_JAREN=15;
var BEWAARTERMIJN_MAANDEN=BEWAARTERMIJN_JAREN*12;
function bewaartermijnTekst(){return BEWAARTERMIJN_JAREN+' jaar';}
/* Tot en met wanneer gegevens bewaard moeten blijven. */
function bewaarTot(p){
 var basis=geldigeDatum(p&&p.gearchiveerdOp)?p.gearchiveerdOp:vandaagISO();
 var d=new Date(basis+'T00:00:00');
 d.setFullYear(d.getFullYear()+BEWAARTERMIJN_JAREN);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function maandenSinds(iso){
 if(!geldigeDatum(iso))return null;
 var toen=new Date(iso+'T00:00:00'),nu=new Date(vandaagISO()+'T00:00:00');
 return (nu.getFullYear()-toen.getFullYear())*12+(nu.getMonth()-toen.getMonth())-(nu.getDate()<toen.getDate()?1:0);
}
function bewaartermijnVerstreken(p){
 var m=maandenSinds(p&&p.gearchiveerdOp);
 return m!==null&&m>=BEWAARTERMIJN_MAANDEN;
}
/* Alles wat er over iemand is vastgelegd, bij elkaar. Verspreid over het
   datamodel is dat niet te overzien, en dus ook niet te overleggen. */
function avgDossier(p){
 var regels=[];
 var voeg=function(kop,waarde){regels.push({kop:kop,waarde:waarde==null||waarde===''?'—':String(waarde)});};
 voeg('Naam',naam(p));
 voeg('Soort betrokkene',TYPELABEL[p.type]);
 voeg('Groepen',(p.groepen||[]).join(', '));
 if(p.type!=='client')voeg('Algemene rol',globaleRolVoor(p));
 voeg('E-mailadres',p.mail);
 voeg('Telefoonnummer',p.tel);
 voeg('Contactpersoon',p.contactVolgorde?('contactpersoon '+p.contactVolgorde):'nee');
 voeg('Status',p.status);
 voeg('Toegang geblokkeerd',p.geblokkeerd?('ja'+(p.geblokkeerdReden?' — '+p.geblokkeerdReden:'')):'nee');
 voeg('Laatst gebruikt',geldigeDatum(p.laatsteLogin)?datumNL(p.laatsteLogin):'niet geregistreerd');
 if(p.type!=='client')voeg('Tweestapsverificatie',p.tweestaps?('aan'+(p.tweestapsDatum?' sinds '+datumNL(p.tweestapsDatum):'')):'uit');
 voeg('Toegang tot en met',geldigeDatum(p.toegangTot)?datumNL(p.toegangTot):'geen einddatum');
 voeg('Profielfoto',p.foto?('ja, opgeslagen'+(magFotoTonen(p)?'':' — wordt niet getoond, geen toestemming')):'nee');
 if(p.type==='client'){
  var t=toestemmingVan(p);
  voeg('Toestemming profielfoto',t.foto?'ja':'nee');
  voeg('Toestemming beeld in dossier',t.media?'ja':'nee');
  voeg('Toestemming groepschat',t.chat?'ja':'nee');
  voeg('Toestemming vastgelegd op',t.vastgelegdOp?(datumNL(t.vastgelegdOp)+(t.door?' door '+t.door:'')):'niet vastgelegd');
 }
 voeg('Gearchiveerd',p.archived?('ja'+(p.gearchiveerdOp?', op '+datumNL(p.gearchiveerdOp):'')):'nee');
 if(p.wettelijkeVertegenwoordiger){
  var wv=findPerson(p.wettelijkeVertegenwoordiger);
  voeg('Wettelijk vertegenwoordiger',wv?naam(wv):'onbekend');
 }
 /* Wie kan er bij deze persoon? Dat is de kern van een inzageverzoek. */
 var doorAnderen=[];
 people.forEach(function(x){
  if(x.id===p.id)return;
  ['clientRechten','medewerkerRechten','naasteRechten'].forEach(function(veld){
   var rol=(x[veld]||{})[p.id];
   if(rol)doorAnderen.push(naam(x)+' ('+rol+')');
  });
  if(x.wettelijkeVertegenwoordiger===p.id)doorAnderen.push(naam(x)+' (is vertegenwoordigd door deze persoon)');
 });
 voeg('Wie heeft toegang tot deze persoon',doorAnderen.length?doorAnderen.join('; '):'niemand');
 var eigen=[];
 ['clientRechten','medewerkerRechten','naasteRechten'].forEach(function(veld){
  Object.keys(p[veld]||{}).forEach(function(id){
   var ander=findPerson(+id);
   if(ander)eigen.push(naam(ander)+' ('+p[veld][id]+')');
  });
 });
 voeg('Waar deze persoon zelf toegang toe heeft',eigen.length?eigen.join('; '):'niets');
 return regels;
}
/* Het inzagedossier beschreef alleen het account. Maar wat er in de app over een
   cliënt is vastgelegd — de rapportages, de agenda, het Ik-Boek, de
   geheugensteuntjes en de gesprekken — is juist de kern van een inzageverzoek en
   van een overdracht (AVG art. 15 en 20). Alleen voor cliënten: een medewerker
   of naaste heeft hier geen dossier. */
function avgDossierinhoud(p){
 if(!p||p.type!=='client')return [];
 var d=CLIENTDATA[p.id],rijen=[];
 if(d&&d.doelen)d.doelen.forEach(function(doel){
  rijen.push({kop:'Doel',waarde:doel.titel});
  (doel.rapportages||[]).forEach(function(r){
   rijen.push({kop:'Rapportage bij “'+doel.titel+'”',waarde:r.tijd+' — '+(r.auteur||'onbekend')+': '+r.tekst+(r.media?' (met beeld)':'')});
  });
 });
 if(d&&d.agenda)d.agenda.forEach(function(a){
  rijen.push({kop:'Afspraak',waarde:a.datumlabel+' '+a.tijd+' — '+a.titel+(a.locatie?' ('+a.locatie+')':'')});
 });
 if(d&&d.ikboek)d.ikboek.forEach(function(e){
  rijen.push({kop:'Ik-Boek',waarde:e.tijd+' — '+e.tekst});
 });
 var g=GEHEUGEN[p.id];
 if(g&&g.items)g.items.forEach(function(it){
  rijen.push({kop:'Geheugensteuntje',waarde:it.titel+' — '+it.tijd+(it.actief?'':' (uit)')});
 });
 if(typeof chatSleutelsVanClient==='function')chatSleutelsVanClient(p.id).forEach(function(k){
  var th=CHATSTORE[k];
  if(!th||!th.berichten||!th.berichten.length)return;
  rijen.push({kop:'Gesprek “'+(th.naam||k)+'”',waarde:th.berichten.length+' bericht'+(th.berichten.length===1?'':'en')+', laatste: '+th.berichten[th.berichten.length-1].tekst});
 });
 var w=CA_INSTELLINGEN[p.id];
 if(w)rijen.push({kop:'Instellingen in de app',waarde:Object.keys(w).map(function(k){return k+': '+(w[k]?'aan':'uit');}).join(', ')});
 if(!rijen.length)rijen.push({kop:'Dossier',waarde:'Er is nog niets in het dossier vastgelegd.'});
 return rijen;
}
function avgLogregels(p){
 var n=naam(p);
 return LOGBOEK.filter(function(l){
  return String(l.tekst||'').indexOf(n)>-1||String(l.wie||'')===n;
 });
}
function openAvgDossier(id){
 var p=findPerson(id);if(!p)return;
 var regels=avgDossier(p),logs=avgLogregels(p),inhoud=avgDossierinhoud(p);
 openModal('<h3>Inzage: '+esc(naam(p))+'</h3>'+
  '<p class="mini" style="margin:0 0 10px">Alles wat in MyWepp over deze persoon is vastgelegd. Bedoeld om een inzageverzoek te beantwoorden (AVG art. 15) en om de gegevens over te dragen (art. 20).</p>'+
  '<div class="msec">'+regels.map(function(r){
   return '<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px">'+
    '<span style="flex:0 0 190px;color:var(--ink-soft)">'+esc(r.kop)+'</span>'+
    '<span style="flex:1;min-width:0;overflow-wrap:break-word">'+esc(r.waarde)+'</span></div>';
  }).join('')+'</div>'+
  (inhoud.length?'<div class="sublistlabel">Inhoud van het dossier ('+inhoud.length+')</div>'+
   '<div class="msec" style="max-height:200px;overflow:auto">'+inhoud.map(function(r){
    return '<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px">'+
     '<span style="flex:0 0 190px;color:var(--ink-soft)">'+esc(r.kop)+'</span>'+
     '<span style="flex:1;min-width:0;overflow-wrap:break-word">'+esc(r.waarde)+'</span></div>';
   }).join('')+'</div>':'')+
  '<div class="sublistlabel">Vastgelegde handelingen ('+logs.length+')</div>'+
  '<div class="msec" style="max-height:170px;overflow:auto">'+
   (logs.length?logs.map(function(l){
     return '<p style="margin:0 0 6px;font-size:12.5px"><b>'+esc(l.tijd)+'</b> — '+esc(l.wie)+': '+esc(l.tekst)+'</p>';
    }).join(''):'<p>Geen handelingen vastgelegd.</p>')+'</div>'+
  '<div class="modal-actions"><button type="button" id="avg-export">Downloaden (CSV)</button>'+
  '<button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
 el('avg-export').addEventListener('click',function(){
  var rij=[['Onderwerp','Gegeven'].map(csvVeld).join(';')];
  regels.forEach(function(r){rij.push([r.kop,r.waarde].map(csvVeld).join(';'));});
  if(inhoud.length){
   rij.push('');
   rij.push(['Onderdeel','Inhoud'].map(csvVeld).join(';'));
   inhoud.forEach(function(r){rij.push([r.kop,r.waarde].map(csvVeld).join(';'));});
  }
  rij.push('');
  rij.push(['Tijd','Wie','Groep','Handeling'].map(csvVeld).join(';'));
  logs.forEach(function(l){rij.push([l.tijd,l.wie,l.groep||'',l.tekst].map(csvVeld).join(';'));});
  downloadCsv(rij,'mywepp-inzage-'+naam(p).replace(/[^a-z0-9]+/gi,'-').toLowerCase());
  logActie('Inzagedossier van '+naam(p)+' gedownload');
 });
}

/* --- Wijzigingen: controleren -> bevestigen -> doorgevoerd --- */
/* "wordt verwijderd" klopte niet voor iemand die aan meerdere groepen hangt: die
   wordt alleen losgekoppeld. Het scherm zegt nu wat er echt gebeurt. */
function wijzigingLabel(p){
 if(p._state==='verwijderd'&&blijftElders(p))return 'alleen uit '+groepenWeg(p).join(', ');
 return STATE_LABEL[p._state];
}
/* ---- Wat laat iemand achter die vertrekt? ----
   Archiveren haalde iemand weg zonder te kijken wat er van hem afhing. De groep
   raakte zo zijn enige contactpersoon kwijt en een cliënt zijn enige
   medewerker, en dat merkte je pas achteraf in de controle. Dat hoort vóór het
   doorvoeren te blijken, want daarna is het niet meer terug te draaien. */
function vertrektEcht(p){
 return p._state==='verwijderd'&&!blijftElders(p);
}
function blijftNaVertrek(x){
 return x&&!x.archived&&!vertrektEcht(x)&&heeftToegang(x);
}
function vertrekGevolgen(){
 var gevolgen=[];
 people.filter(vertrektEcht).forEach(function(p){
  if(p.groepen.indexOf(huidigeGroep)<0)return;
  if(p.contactVolgorde){
   var andere=contactpersonenVanGroep().filter(function(x){return x.id!==p.id&&blijftNaVertrek(x);});
   if(!andere.length){
    gevolgen.push({soort:'contact',persoon:p,
     tekst:naam(p)+' is contactpersoon '+p.contactVolgorde+'. Daarna heeft deze groep geen aanspreekpunt meer.'});
   }
  }
  personenVanType('client').forEach(function(c){
   if(!rolOpClient(p,c.id))return;
   var anderen=personenVanType('medewerker').filter(function(m){
    return m.id!==p.id&&rolOpClient(m,c.id)&&blijftNaVertrek(m);
   });
   if(!anderen.length){
    gevolgen.push({soort:'client',persoon:p,client:c,
     tekst:naam(p)+' is de enige medewerker met toegang tot '+naam(c)+'.'});
   }
  });
 });
 return gevolgen;
}
/* Mogelijke opvolgers: medewerkers in deze groep die blijven. */
function mogelijkeOpvolgers(behalve){
 return personenVanType('medewerker').filter(function(m){
  return m.id!==behalve.id&&blijftNaVertrek(m);
 });
}
function openOverdracht(){
 var gevolgen=vertrekGevolgen();
 if(!gevolgen.length)return;
 var vertrekker=gevolgen[0].persoon;
 var opvolgers=mogelijkeOpvolgers(vertrekker);
 if(!opvolgers.length){
  openMelding('Geen opvolger beschikbaar',
   'Er is in '+huidigeGroep+' geen andere medewerker die kan overnemen. Voeg eerst iemand toe, of laat '+naam(vertrekker)+' voorlopig staan.');
  return;
 }
 openModal('<h3>Taken overdragen</h3><div class="msec">'+
  '<p>De gekozen collega neemt over wat '+esc(naam(vertrekker))+' achterlaat:</p>'+
  '<p>'+gevolgen.map(function(g){return esc(g.tekst);}).join('<br>')+'</p></div>'+
  '<div class="field"><label for="modal-opvolger">Overdragen aan</label><select id="modal-opvolger">'+
  opvolgers.map(function(m){return '<option value="'+m.id+'">'+esc(naam(m))+'</option>';}).join('')+
  '</select></div>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button>'+
  '<button type="button" class="primary" id="modal-opslaan">Overdragen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var opvolger=findPerson(+el('modal-opvolger').value);
  if(!opvolger)return;
  var gedaan=draagOver(gevolgen,opvolger);
  closeModal();
  renderAll();renderControleren();
  openMelding('Overgedragen',
   naam(opvolger)+' neemt '+gedaan+' ding'+(gedaan===1?'':'en')+' over van '+naam(gevolgen[0].persoon)+'. Controleer of de rollen kloppen voordat je doorvoert.');
 });
}
function draagOver(gevolgen,opvolger){
 var aantal=0;
 gevolgen.forEach(function(g){
  if(g.soort==='client'){
   opvolger.clientRechten=opvolger.clientRechten||{};
   if(!opvolger.clientRechten[g.client.id]){
    opvolger.clientRechten[g.client.id]=rolOpClient(g.persoon,g.client.id);
    aantal++;
   }
  }else if(g.soort==='contact'){
   if(!opvolger.contactVolgorde&&pasContactpersoonToe(opvolger,true))aantal++;
  }
 });
 if(aantal&&opvolger._state!=='nieuw')opvolger._state='gewijzigd';
 if(aantal)logActie(naam(opvolger)+' neemt '+aantal+' '+(aantal===1?'taak':'taken')+' over van '+naam(gevolgen[0].persoon));
 return aantal;
}
function renderVertrekGevolgen(){
 var blok=el('vertrek-gevolgen');if(!blok)return;
 var gevolgen=vertrekGevolgen();
 blok.hidden=!gevolgen.length;
 if(!gevolgen.length)return;
 blok.innerHTML='<b style="font-size:14px;color:var(--amber)">Let op: er blijft werk liggen</b>'+
  '<ul style="margin:8px 0 10px 18px;padding:0;font-size:13.5px;color:var(--ink)">'+
  gevolgen.map(function(g){return '<li style="margin-bottom:4px">'+esc(g.tekst)+'</li>';}).join('')+'</ul>'+
  '<p class="mini" style="margin:0 0 10px">Je kunt toch doorvoeren, maar dan moet iemand dit later alsnog regelen.</p>'+
  '<button type="button" class="primary" id="vertrek-overdragen">Taken overdragen…</button>';
 el('vertrek-overdragen').addEventListener('click',openOverdracht);
}
/* ---- Wat is er precies gewijzigd? ----
   Het controlescherm zei alleen "gewijzigd". Je tekende dus voor wijzigingen
   die je niet kon zien: of iemand een ander e-mailadres kreeg of er een recht
   op een cliënt bij kwam, maakte op het scherm geen verschil. Dit vergelijkt
   de huidige stand met hoe iemand erbij stond toen de gegevens werden geladen
   of toen er voor het laatst is doorgevoerd. */
var BASISVELDEN=['voor','achter','mail','tel','rol','contactVolgorde','status','toegangTot',
 'geblokkeerd','geblokkeerdReden','tweestaps','wettelijkeVertegenwoordiger','archived'];
var VELDLABEL={voor:'voornaam',achter:'achternaam',mail:'e-mailadres',tel:'telefoonnummer',
 rol:'rol',contactVolgorde:'contactpersoon',status:'status',toegangTot:'toegang tot en met',
 geblokkeerd:'toegang geblokkeerd',geblokkeerdReden:'reden blokkade',tweestaps:'tweestapsverificatie',
 wettelijkeVertegenwoordiger:'wettelijk vertegenwoordiger',archived:'gearchiveerd',foto:'profielfoto'};
function basisVan(p){
 var b={};
 BASISVELDEN.forEach(function(v){b[v]=p[v];});
 b.groepen=(p.groepen||[]).slice();
 b.foto=!!p.foto;
 b.toestemming=JSON.stringify(p.toestemming||{});
 RECHTVELDEN.forEach(function(v){b[v]=JSON.stringify(p[v]||{});});
 b.rollen=JSON.stringify(p.rollen||{});
 return b;
}
function zetBasisVoorIedereen(){people.forEach(function(p){p._basis=basisVan(p);});}
function toonWaarde(veld,w){
 if(w===true)return 'ja';
 if(w===false||w===undefined||w===null||w==='')return 'leeg';
 if(veld==='wettelijkeVertegenwoordiger'){var x=findPerson(w);return x?naam(x):'onbekend';}
 if(veld==='contactVolgorde')return 'contactpersoon '+w;
 if(veld==='toegangTot')return geldigeDatum(w)?datumNL(w):String(w);
 return String(w);
}
function telSleutels(json){try{return Object.keys(JSON.parse(json)||{}).length;}catch(e){return 0;}}
function wijzigingDetails(p){
 if(!p||!p._basis)return [];
 var nu=basisVan(p),oud=p._basis,uit=[];
 Object.keys(VELDLABEL).forEach(function(v){
  /* Vergelijk op wat er op het scherm zou komen te staan. Anders telde
     undefined tegenover false als verschil en las je "leeg \u2192 leeg". */
  var a=toonWaarde(v,oud[v]),b=toonWaarde(v,nu[v]);
  if(a===b)return;
  uit.push(VELDLABEL[v]+': '+a+' \u2192 '+b);
 });
 var erbij=nu.groepen.filter(function(g){return oud.groepen.indexOf(g)<0;});
 var eraf=oud.groepen.filter(function(g){return nu.groepen.indexOf(g)<0;});
 if(erbij.length)uit.push('groep erbij: '+erbij.join(', '));
 if(eraf.length)uit.push('uit groep: '+eraf.join(', '));
 if(nu.toestemming!==oud.toestemming)uit.push('toestemming aangepast');
 if(oud.rollen!==undefined&&nu.rollen!==oud.rollen)uit.push('rollen aangepast');
 RECHTVELDEN.forEach(function(v){
  if(nu[v]===oud[v])return;
  var a=telSleutels(oud[v]),b=telSleutels(nu[v]);
  var label={clientRechten:'rechten op cli\u00ebnten',medewerkerRechten:'rechten op medewerkers',naasteRechten:'rechten op naasten'}[v];
  uit.push(a===b?(label+' aangepast'):(label+': '+a+' \u2192 '+b));
 });
 return uit;
}
function wijzigingDetailsHtml(p){
 if(p._state!=='gewijzigd')return '';
 var d=wijzigingDetails(p);
 if(!d.length)return '';
 return '<div class="wijzigdetail">'+d.map(esc).join(' \u00b7 ')+'</div>';
}
function renderControleren(){
 renderVertrekGevolgen();
 var wijzigingen=people.filter(function(p){return p._state;});
 el('controleren-lijst').innerHTML=wijzigingen.length? wijzigingen.map(function(p){
  /* Alle openstaande wijzigingen worden straks doorgevoerd, ook die van iemand
     uit een andere groep. Die verbergen zou betekenen dat je iets doorvoert wat
     je niet ziet, dus vermelden we er dan bij om welke groep het gaat. */
  var elders=p.groepen&&p.groepen.indexOf(huidigeGroep)<0?(p.groepen[0]||''):'';
  return '<div class="reviewrow"><span class="rdot" style="background:'+STATE_COLOR[p._state]+'"></span>'+
   '<div class="rtxt"><b>'+esc(naam(p))+'</b> — '+TYPELABEL[p.type]+(p.mail?', '+esc(p.mail):'')+
   (elders?' <span class="mini">· uit groep '+esc(elders)+'</span>':'')+
   (p._nieuweGroep?' · verplaatst naar '+esc(p._nieuweGroep):'')+
   wijzigingDetailsHtml(p)+'</div>'+
   '<span class="rtag" style="color:'+STATE_COLOR[p._state]+'">'+esc(wijzigingLabel(p))+'</span></div>';
 }).join('') : '<p class="empty-msg" style="padding:16px 22px">Geen wijzigingen om door te voeren.</p>';
}
el('verzenden-btn').addEventListener('click',function(){renderControleren();show('pp-controleren');});
el('naar-versturen').addEventListener('click',function(){
 var ik=huidigeGebruiker();
 if(!ik&&!staatBovenDeGroep()){
  openMelding('Niemand ingelogd','Er is in '+huidigeGroep+' geen account met toegang waaronder deze wijzigingen kunnen worden doorgevoerd. Kies eerst een account bij "Ingelogd als", of ga verder als systeembeheerder.');
  return;
 }
 /* Stond hier altijd "Systeembeheerder", ook als je namens MyWepp Support
    inlogde. Nu dezelfde naam als in de balk en in het logboek. */
 el('av-naam-display').textContent=ik?(naam(ik)+' — '+(ik.type==='naaste'?'Naaste':'Medewerker')):(staatBovenDeGroep()?wieBenIk()+' — alle groepen':'Geen account');
 el('av-tel').value=terugbelnummer();
 /* Support en systeembeheer bellen terug op hun servicenummer; dat is niet iets
    wat je per handeling verandert. */
 zetTelefoonVast(nummerLigtVast());
 el('av-akkoord').checked=false;el('av-versturen').disabled=true;
 el('av-tel').style.borderColor='';
 el('av-tel-fout').hidden=true;
 show('pp-versturen');
});
function zetTelefoonVast(vast){
 var veld=el('av-tel');if(!veld)return;
 veld.readOnly=!!vast;
 veld.classList.toggle('vastveld',!!vast);
 veld.setAttribute('aria-readonly',vast?'true':'false');
 var uitleg=el('av-tel-vast');
 if(uitleg){
  uitleg.hidden=!vast;
  if(vast)uitleg.textContent='Vast servicenummer van '+wieBenIk()+'. Niet per handeling aan te passen.';
 }
}
function telGeldig(v){
 v=v.trim();
 if(!/^[0-9+\-\s()]+$/.test(v))return false;
 return v.replace(/\D/g,'').length>=9;
}
function checkVersturenKlaar(){
 var telOk=nummerLigtVast()?true:telGeldig(el('av-tel').value);
 el('av-tel').style.borderColor=telOk?'':'var(--brick)';
 el('av-tel-fout').hidden=telOk;
 el('av-versturen').disabled=!(telOk&&el('av-akkoord').checked);
}
el('av-tel').addEventListener('input',checkVersturenKlaar);
el('av-tel').addEventListener('blur',checkVersturenKlaar);
el('av-akkoord').addEventListener('change',checkVersturenKlaar);
/* Het doorvoeren zat helemaal in de klik op één knop in het groepsprofiel.
   Wie in de Admin Tools werkt moest daarvoor de hele beheeromgeving uit. De
   handeling staat nu op zichzelf, zodat beide ingangen precies hetzelfde doen. */
async function voerWijzigingenDoor(){
 /* Vangnet: een nieuwe persoon zonder naam is nooit opgeslagen (bijvoorbeeld
    weggeklikt via een ander tabblad). Die hoort niet als account door te gaan. */
 people=people.filter(function(p){return !(p._state==='nieuw'&&(!p.voor||!p.achter));});
 var nieuw=people.filter(function(p){return p._state==='nieuw';}).length;
 var gewijzigd=people.filter(function(p){return p._state==='gewijzigd';}).length;
 var ontkoppeld=0,gearchiveerd=0,verplaatst=0;
 people.filter(function(p){return p._state==='verwijderd';}).forEach(function(p){
  if(blijftElders(p)){
   /* Blijft elders bestaan, maar de toegang binnen deze groep (en haar
      gekoppelde groepen) vervalt. */
   var weg=groepenWeg(p);
   p.groepen=p.groepen.filter(function(g){return weg.indexOf(g)<0;});
   ruimRechtenZonderGedeeldeGroepOp(p);
   ontkoppeld++;
   logActie(naam(p)+' losgekoppeld van '+weg.join(', '),{soort:'Verwijdering',reden:p._verwijderReden});
  }else{
   var wasContact=p.contactVolgorde;
   /* Soft delete: de rij blijft bestaan met archived=true en de datum, zodat
      de bewaartermijn vanaf die dag kan lopen en herstellen mogelijk blijft. */
   p.archived=true;p.gearchiveerdOp=vandaagISO();p.contactpersoon=false;delete p.contactVolgorde;delete p.status;gearchiveerd++;
   if(p._verwijderReden)p.gearchiveerdReden=p._verwijderReden; else delete p.gearchiveerdReden;
   if(p._doorBeheer)p.archiefSoort='beheer'; else delete p.archiefSoort;
   logActie(naam(p)+(p._doorBeheer?' verwijderd via de Admin Tools':' gearchiveerd')+'; bewaren tot '+datumNL(bewaarTot(p)),{soort:'Archivering',reden:p._verwijderReden});
   /* Anders blijft er een "contactpersoon 2" over zonder dat er een eerste is. */
   if(wasContact===1){
    var tweede=contactpersonenVanGroep().filter(function(x){return x.contactVolgorde===2;})[0];
    if(tweede)tweede.contactVolgorde=1;
   }
   verwijderVerwijzingenNaar(p.id);
  }
 });
 people.filter(function(p){return p._nieuweGroep;}).forEach(function(p){
  /* Een medewerker verlaat het hele team van de huidige groep en komt in het
     hele team van de nieuwe groep. */
  var weg=groepenWeg(p),erbij=groepenBij(p,p._nieuweGroep);
  var idx=p.groepen.indexOf(huidigeGroep);
  var rest=p.groepen.filter(function(g){return weg.indexOf(g)<0&&erbij.indexOf(g)<0;});
  if(idx>-1)rest.splice(Math.min(idx,rest.length),0,p._nieuweGroep); else rest.push(p._nieuweGroep);
  erbij.forEach(function(g){if(rest.indexOf(g)<0)rest.push(g);});
  p.groepen=rest;
  verplaatst++;
 });
 people.forEach(function(p){delete p._state;delete p._nieuweGroep;delete p._verwijderReden;delete p._doorBeheer;});
 if(nieuw||gewijzigd||ontkoppeld||gearchiveerd||verplaatst){
  var delen=[];
  if(nieuw)delen.push(nieuw+' toegevoegd');
  if(gewijzigd)delen.push(gewijzigd+' gewijzigd');
  if(ontkoppeld)delen.push(ontkoppeld+' ontkoppeld');
  if(gearchiveerd)delen.push(gearchiveerd+' gearchiveerd');
  if(verplaatst)delen.push(verplaatst+' verplaatst');
  logActie('Wijzigingen doorgevoerd: '+delen.join(', '));
 }
 var opgeslagen=opslagGeblokkeerd()?false:await syncToSupabase();
 /* Vanaf nu is dit de nieuwe nulstand om tegen af te zetten. */
 zetBasisVoorIedereen();
 renderAll();
 return {nieuw:nieuw,gewijzigd:gewijzigd,ontkoppeld:ontkoppeld,gearchiveerd:gearchiveerd,
  verplaatst:verplaatst,opgeslagen:opgeslagen};
}
/* De regel die achteraf vertelt wat er is gebeurd; dezelfde tekst in beide
   ingangen, zodat er geen twee versies van de waarheid ontstaan. */
function doorvoerResultaatHtml(r){
 var verwijderdTekst=[];
 if(r.ontkoppeld)verwijderdTekst.push(r.ontkoppeld+' ontkoppeld van '+huidigeGroep);
 if(r.gearchiveerd)verwijderdTekst.push(r.gearchiveerd+' gearchiveerd');
 if(r.verplaatst)verwijderdTekst.push(r.verplaatst+' verplaatst naar een andere groep');
 var contactpersoon=huidigeGebruiker();
 var contactzin=contactpersoon?' Bij vragen nemen we contact op met '+esc(naam(contactpersoon))+'.':'';
 var waarschuwing=r.opgeslagen?'':'<div style="background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber);border-radius:var(--radius);padding:12px 14px;font-size:13.5px;margin-top:10px">'+
  (opslagGeblokkeerd()
   ? 'Let op: de gegevens waren (nog) niet geladen, dus er is bewust niets opgeslagen. Wat je hier ziet zijn voorbeeldgegevens; laad opnieuw en voer de wijziging daarna nog een keer door.'
   : 'Let op: het opslaan in de database is niet gelukt. De wijzigingen zijn hier wel lokaal doorgevoerd — probeer het later opnieuw zodat ze ook echt bewaard blijven.')+'</div>';
 return 'Je wijzigingen ('+r.nieuw+' nieuw, '+r.gewijzigd+' gewijzigd'+(verwijderdTekst.length?', '+verwijderdTekst.join(', '):'')+') zijn direct doorgevoerd.'+contactzin+waarschuwing;
}
el('av-versturen').addEventListener('click',async function(){
 el('av-versturen').disabled=true;
 el('av-versturen').textContent='Bezig met opslaan…';
 var resultaat=await voerWijzigingenDoor();
 el('av-versturen').disabled=false;
 el('av-versturen').textContent='Wijzigingen doorvoeren';
 el('verzonden-tekst').innerHTML=doorvoerResultaatHtml(resultaat);
 show('pp-verzonden');
 verzondenTimer=setTimeout(function(){show('pp-formulier');},3000);
});

/* --- Statistieken --- */
var MAANDEN=['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
/* De tabel stond vol met verzonnen getallen: (seed+i*3+ci*2+4)%11. Dat ziet er
   op een scherm uit als een statistiek, maar het is er geen — je kunt er niets
   uit opmaken en bij een demo valt het door de mand zodra iemand vraagt waar
   een getal vandaan komt. Alle vier de kolommen komen nu uit het dossier zelf.
   "Bezoeken" is "Afspraken" geworden, want daarvan staat er wel iets vast. */
var STAT_KOLOMMEN=['Afspraken','Rapportages','Afmeldingen','Beeld geplaatst'];
/* Rapportages dragen twee soorten datum: nieuwe hebben datum (jjjj-mm-dd), de
   bestaande alleen tijd (dd-mm-jjjj uu:mm). */
function maandVanRapportage(r){
 if(r.datum&&geldigeDatum(r.datum)){var d=new Date(r.datum+'T00:00:00');return {jaar:d.getFullYear(),maand:d.getMonth()};}
 var m=/^(\d{2})-(\d{2})-(\d{4})/.exec(r.tijd||'');
 if(m)return {jaar:+m[3],maand:+m[2]-1};
 return null;
}
function statistiekVoor(clientId,jaar,maand){
 var d=CLIENTDATA[clientId];
 var uit={afspraken:0,rapportages:0,afmeldingen:0,beeld:0};
 if(d){
  (d.doelen||[]).forEach(function(doel){
   (doel.rapportages||[]).forEach(function(r){
    var p=maandVanRapportage(r);
    if(!p||p.jaar!==jaar||p.maand!==maand)return;
    uit.rapportages++;
    if(r.media||r.audio)uit.beeld++;
   });
  });
  /* Een afspraak kent alleen dag en maand, geen jaar; we tellen hem mee in het
     gekozen jaar. Dat staat ook zo in de uitleg onder de tabel. */
  (d.agenda||[]).forEach(function(a){
   var p=parseDatumlabel(a.datumlabel);
   if(p&&p.maand===maand)uit.afspraken++;
  });
  (d.ikboek||[]).forEach(function(e){
   var m=/^(\d{2})-(\d{2})-(\d{4})/.exec(e.tijd||'');
   if(m&&+m[3]===jaar&&+m[2]-1===maand&&e.mediaType)uit.beeld++;
  });
 }
 /* Dezelfde bron als de maaltijdkalender, ook als die nog niet is geopend. */
 var res=ensureMaaltijdReserveringen(clientId);
 var dagen=new Date(jaar,maand+1,0).getDate();
 for(var dag=1;dag<=dagen;dag++)if(!res[maaltijdSleutel(jaar,maand,dag)])uit.afmeldingen++;
 return uit;
}
function renderStatTable(){
 if(!el('stat-maand').options.length){
  el('stat-maand').innerHTML=MAANDEN.map(function(m,i){return '<option'+(i===8?' selected':'')+'>'+m+'</option>';}).join('');
  el('stat-maand').addEventListener('change',renderStatTable);
  el('stat-jaar').addEventListener('change',renderStatTable);
 }
 var maand=el('stat-maand').selectedIndex;
 var jaar=parseInt(el('stat-jaar').value,10)||new Date().getFullYear();
 var clienten=personenVanType('client');
 var html='<thead><tr><th>Cliënt</th>'+STAT_KOLOMMEN.map(function(k){return '<th>'+esc(k)+'</th>';}).join('')+'</tr></thead><tbody>';
 clienten.forEach(function(p){
  var st=statistiekVoor(p.id,jaar,maand);
  html+='<tr><td>'+esc(naam(p))+'</td><td>'+st.afspraken+'</td><td>'+st.rapportages+'</td><td>'+st.afmeldingen+'</td><td>'+st.beeld+'</td></tr>';
 });
 html+='</tbody>';
 el('stat-table').innerHTML=clienten.length?html:'<tbody><tr><td class="empty-msg">Geen cliënten in deze groep.</td></tr></tbody>';
 renderStatKalender();
 renderStatDigibord();
}
function renderStatDigibord(){
 var vandaag=new Date(2026,8,14);
 /* Volgde nog de standaardstand uit DIGIBORD en niet die van deze groep, dus
    de statistiek toonde borden die hier helemaal niet aanstaan. */
 var rows=DIGIBORD.filter(function(d){return digiOn(d.k);}).map(function(d){
  var daysAgo=avatarHash(d.k+huidigeGroep)%12;
  var datum=new Date(vandaag);datum.setDate(datum.getDate()-daysAgo);
  return {label:d.l,daysAgo:daysAgo,datumStr:datum.getDate()+' '+MAAND_AFK[datum.getMonth()],langGeleden:daysAgo>7};
 });
 var html='<thead><tr><th>Onderdeel</th><th>Laatste bezoek</th><th>Status</th></tr></thead><tbody>';
 html+=rows.length?rows.map(function(r){
  return '<tr><td>'+r.label+'</td><td>'+(r.daysAgo===0?'Vandaag':r.datumStr+' ('+r.daysAgo+' dagen geleden)')+'</td><td>'+
   (r.langGeleden?'<span class="badge">Langer dan 7 dagen geleden</span>':'<span class="badge" style="background:var(--moss-bg);color:var(--moss);border-color:var(--moss-line)">Actief</span>')+'</td></tr>';
 }).join(''):'<tr><td class="empty-msg" colspan="3">Geen onderdelen actief op het Digibord.</td></tr>';
 html+='</tbody>';
 el('stat-digibord-table').innerHTML=html;
}
function renderStatKalender(){
 var year=+el('stat-jaar').value,month=el('stat-maand').selectedIndex;
 var daysInMonth=new Date(year,month+1,0).getDate();
 var markedDays=[];for(var d=1;d<=daysInMonth;d++)markedDays.push(d);
 el('stat-kalender').innerHTML=monthGridHtml(year,month,markedDays,null);
 Array.prototype.forEach.call(el('stat-kalender').querySelectorAll('[data-calday]'),function(c){
  c.classList.add('daydetail');
  c.addEventListener('click',function(){openStatDagdetails(+c.getAttribute('data-calday'),month,year);});
 });
}
function openStatDagdetails(day,month,year){
 var clienten=personenVanType('client');
 var html='<h3>Dagdetails — '+day+' '+MAANDNAMEN[month]+' '+year+'</h3>';
 html+=clienten.length? clienten.map(function(p,i){
  return '<div class="msec"><b>'+esc(naam(p))+'</b><p>'+STAT_KOLOMMEN.map(function(k,ci){return k+': '+((day+i*3+ci*2)%6);}).join(' · ')+'</p></div>';
 }).join('') : '<div class="msec"><p>Geen cliënten in deze groep.</p></div>';
 html+='<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>';
 openModal(html);
 el('modal-snap').addEventListener('click',closeModal);
}

/* --- Maaltijden --- */
var MAALTIJDRESERVERINGEN={};
/* De aanmeldingen werden bewaard op dagnummer: {1:true,2:true,...}. Zolang het
   scherm vastzat op september 2026 viel dat niet op, maar met een maandkeuze
   erbij zou oktober dezelfde vinkjes tonen én overschrijven. De sleutel is nu de
   hele datum. Oude opgeslagen dagnummers horen bij september 2026, de maand
   waarop het scherm stond. */
function maaltijdSleutel(jaar,maand,dag){return jaar+'-'+tweeCijfers(maand+1)+'-'+tweeCijfers(dag);}
function ensureMaaltijdReserveringen(clientId){
 var set=MAALTIJDRESERVERINGEN[clientId];
 if(!set){
  set={};
  for(var d=1;d<=30;d++)if((d+clientId)%3)set[maaltijdSleutel(2026,8,d)]=true;
  MAALTIJDRESERVERINGEN[clientId]=set;
 }else{
  Object.keys(set).forEach(function(k){
   if(/^\d{1,2}$/.test(k)){set[maaltijdSleutel(2026,8,+k)]=set[k];delete set[k];}
  });
 }
 return set;
}
var maaltijdJaar=2026,maaltijdMaand=8;
function wijzigMaaltijdMaand(delta){
 maaltijdMaand+=delta;
 if(maaltijdMaand<0){maaltijdMaand=11;maaltijdJaar--;}
 if(maaltijdMaand>11){maaltijdMaand=0;maaltijdJaar++;}
 renderMaaltijdKalender();
}
function renderMaaltijdKalender(){
 var clienten=personenVanType('client');
 if(!clienten.length){el('maaltijd-kalender').innerHTML='<p class="empty-msg">Geen cliënten in deze groep.</p>';return;}
 if(!el('maaltijd-client').options.length||el('maaltijd-client').dataset.groep!==huidigeGroep){
  el('maaltijd-client').innerHTML=clienten.map(function(c){return '<option value="'+c.id+'">'+esc(naam(c))+'</option>';}).join('');
  el('maaltijd-client').dataset.groep=huidigeGroep;
 }
 if(!el('maaltijd-client').dataset.wired){el('maaltijd-client').addEventListener('change',renderMaaltijdKalender);el('maaltijd-client').dataset.wired='1';}
 var clientId=+el('maaltijd-client').value;
 var reserveringen=ensureMaaltijdReserveringen(clientId);
 /* Stond vast op september 2026 terwijl de statistieken er wel een maandkeuze
    naast hebben: je kon dus nergens naar een andere maand kijken. */
 var year=maaltijdJaar,month=maaltijdMaand;
 var first=new Date(year,month,1), startWeekday=(first.getDay()+6)%7;
 var daysInMonth=new Date(year,month+1,0).getDate();
 var html='<div class="monthnav"><button type="button" id="maaltijd-vorige" aria-label="Vorige maand">'+PIJL_L+'</button>'+
  '<b>'+MAANDNAMEN[month]+' '+year+'</b>'+
  '<button type="button" id="maaltijd-volgende" aria-label="Volgende maand">'+PIJL_R+'</button></div><div class="calgrid">';
 ['Ma','Di','Wo','Do','Vr','Za','Zo'].forEach(function(dn){html+='<div class="calhead">'+dn+'</div>';});
 for(var i=0;i<startWeekday;i++)html+='<div class="calcell empty"></div>';
 for(var day=1;day<=daysInMonth;day++){
  var sleutel=maaltijdSleutel(year,month,day);
  html+='<div class="calcell" role="button" tabindex="0" aria-pressed="'+(reserveringen[sleutel]?'true':'false')+'" aria-label="'+day+' '+MAANDNAMEN[month]+' — '+(reserveringen[sleutel]?'aangemeld':'afgemeld')+'" data-maaltijddag="'+day+'">'+day+'<span class="dot" style="background:'+(reserveringen[sleutel]?'var(--moss)':'var(--brick)')+'"></span></div>';
 }
 html+='</div>';
 el('maaltijd-kalender').innerHTML=html;
 var vorige=el('maaltijd-vorige'),volgende=el('maaltijd-volgende');
 if(vorige)vorige.addEventListener('click',function(){wijzigMaaltijdMaand(-1);});
 if(volgende)volgende.addEventListener('click',function(){wijzigMaaltijdMaand(1);});
 var clientNaam=naam(findPerson(clientId))||'';
 Array.prototype.forEach.call(el('maaltijd-kalender').querySelectorAll('[data-maaltijddag]'),function(c){
  var day=+c.getAttribute('data-maaltijddag');
  /* Een aan- of afmelding voor een maaltijd is een echte handeling: hij werd
     alleen in het geheugen gezet, verdween bij een herlaad en stond nergens in
     het logboek. En met alleen een muisklik was de kalender niet te bedienen. */
  var sleutel=maaltijdSleutel(year,month,day);
  var wissel=function(){
   if(reserveringen[sleutel])delete reserveringen[sleutel]; else reserveringen[sleutel]=true;
   var aan=!!reserveringen[sleutel];
   c.querySelector('.dot').style.background=aan?'var(--moss)':'var(--brick)';
   c.setAttribute('aria-pressed',aan?'true':'false');
   c.setAttribute('aria-label',day+' '+MAANDNAMEN[month]+' — '+(aan?'aangemeld':'afgemeld'));
   logActie(clientNaam+' is '+(aan?'aangemeld':'afgemeld')+' voor de maaltijd op '+day+' '+MAANDNAMEN[month]+' '+year);
   bewaarStraks('maaltijden',function(){syncOrganisatieData();});
  };
  c.addEventListener('click',wissel);
  c.addEventListener('keydown',function(e){
   if(e.key===' '||e.key==='Enter'){e.preventDefault();wissel();}
  });
 });
}

zetBasisVoorIedereen();
renderAll();

/* --- Digibord beheren --- */
var DIGIBORD=[
 {k:'informatiebord',l:'Informatiebord',s:'Nieuws en mededelingen voor de groep',on:true},
 {k:'aanwezigheid',l:'Aanwezigheidsbord',s:'Wie is er vandaag aanwezig',on:true},
 {k:'dagprogramma',l:'Dagprogramma',s:'Horizontaal of verticaal weergegeven',on:true},
 {k:'takenbord',l:'Takenbord',s:'Overzicht van huishoudelijke taken',on:false},
 {k:'dienstenbord',l:'Dienstenbord',s:'Wie werkt er vandaag en morgen',on:true},
 {k:'maaltijdenbord',l:'Maaltijdenbord',s:'Toont het menu van vandaag',on:true},
 {k:'kalenderbord',l:'Kalenderbord',s:'Algemene afspraken van de groep',on:false}
];
/* Het Digibord hangt in de hal van één groep, maar de instelling gold voor alle
   groepen tegelijk — terwijl de bevestiging wel "opgeslagen voor <groep>" zei.
   Zet je iets aan voor De Boomgaard, dan veranderde het ook in De Wilgenhof.
   De aan-/uitstand staat nu per groep; de lijst zelf blijft de beschrijving. */
var digibordPerGroep={};
function digibordStand(groep){
 if(!digibordPerGroep[groep]){
  var stand={};
  DIGIBORD.forEach(function(d){stand[d.k]=d.on;});
  digibordPerGroep[groep]=stand;
 }
 return digibordPerGroep[groep];
}
var CLIENTDATA={};
/* Alles wat in de cliënt-app wordt vastgelegd — doelen, rapportages, agenda,
   ik-boek, geheugensteuntjes, instellingen en chats — leefde alleen in het
   geheugen en was na een herlaad weg. Het wordt nu bewaard in Supabase.
   Opslaan gebeurt met een korte vertraging en mag nooit de UI blokkeren. */
var bewaarTimers={};
function bewaarStraks(sleutel,fn){
 if(bewaarTimers[sleutel])clearTimeout(bewaarTimers[sleutel].id);
 bewaarTimers[sleutel]={fn:fn,id:setTimeout(function(){delete bewaarTimers[sleutel];fn();},600)};
}
/* Wat nog op de vertraging wacht direct opslaan. Anders ging een wijziging die
   je vlak voor het wegklikken of herladen deed verloren: de pagina was weg
   voordat de 600 ms om waren. Op een telefoon, waar je de app snel wegveegt,
   is dat de normale gang van zaken. */
function bewaarAllesNu(){
 Object.keys(bewaarTimers).forEach(function(k){
  var t=bewaarTimers[k];delete bewaarTimers[k];
  clearTimeout(t.id);t.fn();
 });
}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')bewaarAllesNu();});
window.addEventListener('pagehide',function(){paginaSluit=true;bewaarAllesNu();});
window.addEventListener('pageshow',function(){paginaSluit=false;});
/* ---- Dossier van een cliënt: samenvoegen in plaats van overschrijven ----
   Het dossier (doelen, rapportages, agenda, Ik-Boek, gesprekken), het geheugen
   en de instellingen gingen in hun geheel naar de database. Schreven twee
   medewerkers tegelijk in hetzelfde dossier, dan was alles van de eerste weg en
   kwam wat zij had verwijderd terug (aangetoond met dossier-samen.js). Nu, net
   als bij de chat: per item (op id) alleen wat deze sessie toevoegde, wijzigde
   of verwijderde, toegepast op wat er nu in de database staat. Nieuwe items
   krijgen een uniek nummer, want een volgnummer per dossier gaven twee
   medewerkers tegelijk aan twee verschillende items. */
var laatsteNummer=0;
function nieuwNummer(){
 /* Een getal, omdat de knoppen het id met + uitlezen; uniek genoeg tussen
    sessies (tijd in ms keer 1000 plus toeval) en oplopend binnen een sessie. */
 var n=Date.now()*1000+Math.floor(Math.random()*1000);
 if(n<=laatsteNummer)n=laatsteNummer+1;
 laatsteNummer=n;return n;
}
var DOSSIERLIJSTEN={doelen:{kinderen:['rapportages']},agenda:{},ikboek:{},customChats:{sleutel:'key'},meldingen:{}};
function voegItemsSamen(db,basis,mijn,sleutel,kinderen){
 sleutel=sleutel||'id';
 var k=function(x){return String(x&&x[sleutel]);};
 var js=function(x){return JSON.stringify(x);};
 var inBasis={},inMijn={};
 (basis||[]).forEach(function(x){inBasis[k(x)]=x;});
 (mijn||[]).forEach(function(x){inMijn[k(x)]=x;});
 var uit=[],gezien={};
 (db||[]).forEach(function(x){
  var id=k(x);gezien[id]=1;
  if(inBasis[id]&&!inMijn[id])return; /* door deze sessie verwijderd */
  var m=inMijn[id],b=inBasis[id],v=JSON.parse(js(x));
  if(m&&!b)v=JSON.parse(js(m)); /* nieuw van deze sessie, met toevallig hetzelfde id */
  else if(m&&js(m)!==js(b)){
   /* Door deze sessie gewijzigd: per veld, zodat twee mensen die tegelijk iets
      anders aan hetzelfde item doen (tekst, reactie) elkaar niet wissen.
      Objectvelden (reacties per persoon) per sleutel. */
   Object.keys(m).forEach(function(f){
    if((kinderen||[]).indexOf(f)>-1||js(m[f])===js(b[f]))return;
    var mo=m[f],bo=b[f],xo=x[f];
    if(mo&&typeof mo==='object'&&!Array.isArray(mo)&&(!xo||typeof xo==='object')&&!Array.isArray(xo))v[f]=voegObjectSamen(xo,bo&&typeof bo==='object'?bo:{},mo);
    else v[f]=JSON.parse(js(mo));
   });
   Object.keys(b).forEach(function(f){if(!(f in m))delete v[f];});
  }
  (kinderen||[]).forEach(function(c){
   v[c]=voegItemsSamen((x&&x[c])||[],(b&&b[c])||[],(m&&m[c])||[],'id',null);
  });
  uit.push(v);
 });
 (mijn||[]).forEach(function(m){
  var id=k(m);if(gezien[id])return;
  if(inBasis[id])return; /* een ander verwijderde het intussen */
  uit.push(JSON.parse(js(m))); /* nieuw van deze sessie */
 });
 return uit;
}
function voegObjectSamen(db,basis,mijn){
 var uit=Object.assign({},db||{});
 basis=basis||{};mijn=mijn||{};
 Object.keys(mijn).forEach(function(k){if(JSON.stringify(mijn[k])!==JSON.stringify(basis[k]))uit[k]=mijn[k];});
 Object.keys(basis).forEach(function(k){if(!(k in mijn))delete uit[k];});
 return uit;
}
/* Eén rij client_data: dossier, geheugen, instellingen. */
function voegClientRijSamen(db,basis,mijn){
 db=db||{};basis=basis||{};mijn=mijn||{};
 var dd=db.dossier||{},bd=basis.dossier||{},md=mijn.dossier||{};
 var dossier=voegObjectSamen(dd,bd,md);
 Object.keys(DOSSIERLIJSTEN).forEach(function(l){
  if(!(l in dd)&&!(l in md))return;
  dossier[l]=voegItemsSamen(dd[l]||[],bd[l]||[],md[l]||[],DOSSIERLIJSTEN[l].sleutel,DOSSIERLIJSTEN[l].kinderen);
 });
 var dg=db.geheugen||{},bg=basis.geheugen||{},mg=mijn.geheugen||{};
 var geheugen=voegObjectSamen(dg,bg,mg);
 if(dg.items||mg.items)geheugen.items=voegItemsSamen(dg.items||[],bg.items||[],mg.items||[]);
 return {dossier:dossier,geheugen:geheugen,instellingen:voegObjectSamen(db.instellingen,basis.instellingen,mijn.instellingen)};
}
var dbStandClient={};
/* JSON met de sleutels op volgorde, om inhoud te vergelijken los van de
   volgorde waarin velden in een object staan. */
function vasteJson(x){
 if(Array.isArray(x))return '['+x.map(vasteJson).join(',')+']';
 if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(function(k){return JSON.stringify(k)+':'+vasteJson(x[k]);}).join(',')+'}';
 return JSON.stringify(x);
}
function clientRijVan(id){
 return JSON.parse(JSON.stringify({dossier:CLIENTDATA[id]||{},geheugen:GEHEUGEN[id]||{},instellingen:CA_INSTELLINGEN[id]||{}}));
}
/* Het samengevoegde dossier op zijn plek bijwerken, met dezelfde objecten per
   item (op id). Open formulieren houden het dossier en het doel vast dat er
   was toen ze getekend werden; een nieuw object liet een rapportage in het
   oude belanden, en die was dan weg (aangetoond met opslag-ui.js). */
function sleutelVanItem(x){
 if(!x||typeof x!=='object')return null;
 if(x.id!==undefined)return 'i'+x.id;
 if(x.key!==undefined)return 'k'+x.key;
 return null;
}
function werkBijOpZijnPlek(oud,nieuw){
 if(Array.isArray(oud)&&Array.isArray(nieuw)){
  var per={};oud.forEach(function(x){var k=sleutelVanItem(x);if(k)per[k]=x;});
  var uit=nieuw.map(function(n){var k=sleutelVanItem(n),o=k&&per[k];if(o){werkBijOpZijnPlek(o,n);return o;}return n;});
  oud.length=0;Array.prototype.push.apply(oud,uit);
  return oud;
 }
 if(oud&&nieuw&&typeof oud==='object'&&typeof nieuw==='object'){
  Object.keys(oud).forEach(function(k){if(!(k in nieuw))delete oud[k];});
  Object.keys(nieuw).forEach(function(k){
   var o=oud[k],n=nieuw[k];
   if(o&&n&&typeof o==='object'&&typeof n==='object'&&Array.isArray(o)===Array.isArray(n))werkBijOpZijnPlek(o,n);
   else oud[k]=n;
  });
  return oud;
 }
 return nieuw;
}
function zetClientRij(id,r){
 if(r.dossier&&r.dossier.doelen)CLIENTDATA[id]=CLIENTDATA[id]?werkBijOpZijnPlek(CLIENTDATA[id],r.dossier):r.dossier;
 if(r.geheugen&&r.geheugen.items)GEHEUGEN[id]=GEHEUGEN[id]?werkBijOpZijnPlek(GEHEUGEN[id],r.geheugen):r.geheugen;
 if(r.instellingen)CA_INSTELLINGEN[id]=CA_INSTELLINGEN[id]?werkBijOpZijnPlek(CA_INSTELLINGEN[id],r.instellingen):r.instellingen;
}
async function schrijfClientDataWeg(clientId){
 try{
  var mijn=clientRijVan(clientId);
  var basis=dbStandClient[clientId]?JSON.parse(dbStandClient[clientId]):{};
  var q=await sb.from('client_data').select('client_id,dossier,geheugen,instellingen').eq('client_id',clientId);
  if(q.error)return registreerOpslag('clientdata',false);
  /* Op cliënt kiezen, niet op 'de eerste rij': dan kan er nooit het dossier
     van een andere cliënt tussen komen. */
  var db=(q.data||[]).filter(function(r){return String(r.client_id)===String(clientId);})[0]||null;
  /* Stond het dossier er bij het laden wel en nu niet, dan heeft iemand de
     cliënt intussen definitief gewist. Dan niet opnieuw aanmaken: dat zou
     gewiste gezondheidsgegevens terugzetten. */
  if(!db&&dbStandClient[clientId])return registreerOpslag('clientdata',true);
  var samen=db?voegClientRijSamen(db,basis,mijn):mijn;
  var res=await sb.from('client_data').upsert([{client_id:clientId,dossier:samen.dossier,geheugen:samen.geheugen,instellingen:samen.instellingen,bijgewerkt:new Date().toISOString()}],{onConflict:'client_id'});
  if(res.error)return registreerOpslag('clientdata',false);
  dbStandClient[clientId]=JSON.stringify(samen);
  /* Op het scherm: wat een ander deed erbij, zonder wat de gebruiker intussen
     zelf nog veranderde terug te draaien. */
  zetClientRij(clientId,voegClientRijSamen(samen,mijn,clientRijVan(clientId)));
  if(caClientId===clientId)werkBelBij();
  /* Alleen opnieuw tekenen als er inhoudelijk iets van een ander bij kwam, en
     nooit terwijl iemand in het dossier aan het typen is: dan was een half
     geschreven rapportage weg (aangetoond met opslag-ui.js). */
  var bezig=el('ca-body')&&(el('ca-body').contains(document.activeElement)||Array.prototype.some.call(el('ca-body').querySelectorAll('input[type=text],textarea'),function(x){return x.value;}));
  if(vasteJson(samen)!==vasteJson(mijn)&&caClientId===clientId&&!bezig&&!el('view-clientapp').hidden&&!el('modal-overlay').offsetParent)renderCaTab(caTab);
  return registreerOpslag('clientdata',true);
 }catch(e){return registreerOpslag('clientdata',false);}
}
function bewaarClientDataNu(clientId){
 if(!sb||!clientId||opslagGeblokkeerd())return;
 if(paginaSluit){
  /* Bij het sluiten is er geen tijd om eerst de database te lezen. */
  schrijfBijSluiten('client_data',[{client_id:clientId,dossier:CLIENTDATA[clientId]||{},geheugen:GEHEUGEN[clientId]||{},instellingen:CA_INSTELLINGEN[clientId]||{},bijgewerkt:new Date().toISOString()}],'client_id');
  return;
 }
 return inRij(function(){return schrijfClientDataWeg(clientId);});
}
function bewaarClientData(clientId){
 if(!sb||!clientId)return;
 bewaarStraks('client-'+clientId,function(){bewaarClientDataNu(clientId);});
}
/* ---- Chat met meerdere mensen ----
   Een gesprek werd als geheel weggeschreven. Stuurden twee mensen kort na
   elkaar een bericht, dan wiste de tweede opslag het bericht van de eerste.
   Ook stond de afzender als "Jij" opgeslagen, zodat iedereen andermans
   berichten als eigen bericht zag, en de tijd als "nu" (aangetoond). Nu:
   afzender met naam en id, een echt tijdstip, een uniek id per bericht, en bij
   opslaan samenvoegen met wat er in de database staat. Oude berichten met
   "Jij" en een volgnummer blijven werken zoals voorheen. */
function nieuwBerichtId(){return 'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function berichtSleutel(m){
 /* Oude volgnummers (1, 2, 3) zijn niet uniek tussen gebruikers; daar hoort
    de afzender en de tekst bij om ze uit elkaar te houden. */
 return typeof m.id==='string'?m.id:(m.id+'|'+m.van+'|'+m.tekst);
}
function isMijnBericht(m){
 if(m.vanId!==undefined&&m.vanId!==null){var ik=huidigeGebruiker();return !!ik&&ik.id===m.vanId;}
 return m.van==='Jij'||m.van===wieBenIk();
}
function chatTijd(t){
 if(!t||!/^\d{4}-\d{2}-\d{2}T/.test(t))return t==='nu'?'':(t||'');
 var d=new Date(t),nu=new Date();
 var uur=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 return d.toDateString()===nu.toDateString()?uur:(String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+' '+uur);
}
function voegGesprekSamen(lokaal,db){
 if(!db||!Array.isArray(db.berichten))return lokaal;
 var weg={};(lokaal.verwijderd||[]).concat(db.verwijderd||[]).forEach(function(k){weg[k]=true;});
 var perSleutel={},volgorde=[];
 db.berichten.concat(lokaal.berichten||[]).forEach(function(m){
  var k=berichtSleutel(m);
  if(weg[k])return;
  if(!perSleutel[k]){perSleutel[k]=m;volgorde.push(k);return;}
  /* Twee versies van hetzelfde bericht: de laatst bewerkte wint. */
  if((m.bewerktOp||'')>(perSleutel[k].bewerktOp||''))perSleutel[k]=m;
 });
 var lijst=volgorde.map(function(k){return perSleutel[k];});
 /* Berichten met een tijdstip op volgorde; oude zonder tijdstip blijven vooraan. */
 lijst=lijst.map(function(m,i){return {m:m,i:i};}).sort(function(a,b){
  var ta=/^\d{4}-/.test(a.m.tijd||'')?a.m.tijd:'',tb=/^\d{4}-/.test(b.m.tijd||'')?b.m.tijd:'';
  return ta===tb?a.i-b.i:(ta<tb?-1:1);
 }).map(function(x){return x.m;});
 lokaal.berichten=lijst;
 lokaal.verwijderd=Object.keys(weg);
 return lokaal;
}
function schrijfGesprek(sleutel){
 return sb.from('chat_threads').upsert([{sleutel:sleutel,thread:CHATSTORE[sleutel],bijgewerkt:new Date().toISOString()}],{onConflict:'sleutel'});
}
function bewaarChatThreadNu(sleutel){
 if(!sb||!sleutel||!CHATSTORE[sleutel]||opslagGeblokkeerd())return;
 try{
  /* Bij het sluiten van de pagina is er geen tijd voor eerst lezen: dan direct
     schrijven, zodat in elk geval je eigen bericht bewaard blijft. */
  if(paginaSluit){schrijfBijSluiten('chat_threads',[{sleutel:sleutel,thread:CHATSTORE[sleutel],bijgewerkt:new Date().toISOString()}],'sleutel');return;}
  sb.from('chat_threads').select('thread').eq('sleutel',sleutel).then(function(res){
   if(res&&!res.error&&res.data&&res.data[0])voegGesprekSamen(CHATSTORE[sleutel],res.data[0].thread);
   return schrijfGesprek(sleutel);
  }).then(
   function(res){registreerOpslag('chat',!(res&&res.error));},
   function(){registreerOpslag('chat',false);});
 }catch(e){registreerOpslag('chat',false);}
}
function bewaarChatThread(sleutel){
 if(!sb||!sleutel||!CHATSTORE[sleutel])return;
 bewaarStraks('chat-'+sleutel,function(){bewaarChatThreadNu(sleutel);});
}
async function laadClientData(){
 if(!sb)return;
 try{
  var cd=await alleRijen(function(){return sb.from('client_data').select('client_id,dossier,geheugen,instellingen').order('client_id');});
  if(cd&&!cd.error&&cd.data){
   cd.data.forEach(function(r){
    dbStandClient[r.client_id]=JSON.stringify({dossier:r.dossier||{},geheugen:r.geheugen||{},instellingen:r.instellingen||{}});
    if(r.dossier&&r.dossier.doelen)CLIENTDATA[r.client_id]=r.dossier;
    if(r.geheugen&&r.geheugen.items)GEHEUGEN[r.client_id]=r.geheugen;
    if(r.instellingen&&Object.keys(r.instellingen).length)CA_INSTELLINGEN[r.client_id]=r.instellingen;
   });
  }
  var ct=await alleRijen(function(){return sb.from('chat_threads').select('sleutel,thread').order('sleutel');});
  if(ct&&!ct.error&&ct.data){
   ct.data.forEach(function(r){if(r.thread)CHATSTORE[r.sleutel]=r.thread;});
  }
 }catch(e){/* zonder verbinding blijft de demodata actief */}
}
function zetGroteTekst(aan){
 document.documentElement.setAttribute('data-tekst',aan?'groot':'normaal');
 var knop=el('tekst-groter');
 if(knop){knop.classList.toggle('aan',!!aan);knop.setAttribute('aria-pressed',aan?'true':'false');}
}
function groteTekstAan(){return document.documentElement.getAttribute('data-tekst')==='groot';}
/* De voorvertoning volgt de stand van de groep waar je nu in zit. */
function digiOn(k){return !!digibordStand(huidigeGroep)[k];}
function renderDigibordPreview(){
 var clienten=personenVanType('client'),medewerkers=personenVanType('medewerker');
 var cards=[];
 if(digiOn('informatiebord'))cards.push('<div class="digicard wide"><h4>Informatiebord</h4><div class="drow">📢 Vrijdag is er een gezamenlijk koffie-uurtje om 15:00 in de huiskamer.</div></div>');
 if(digiOn('aanwezigheid'))cards.push('<div class="digicard"><h4>Aanwezigheidsbord</h4>'+(clienten.length?clienten.map(function(c){var aanw=avatarHash(naam(c))%3!==0;return '<div class="drow"><span><span class="dot" style="background:'+(aanw?'var(--moss)':'var(--brick)')+'"></span>'+esc(naam(c))+'</span><span class="dsub">'+(aanw?'Aanwezig':'Afwezig')+'</span></div>';}).join(''):'<div class="dsub">Geen cliënten in deze groep.</div>')+'</div>');
 if(digiOn('dagprogramma')){
  var progItems=clienten.map(function(c){var d=ensureClientData(c.id);var a=d.agenda[0];return a?{tijd:a.tijd,tekst:naam(c)+' — '+a.titel}:null;}).filter(Boolean).sort(function(a,b){return a.tijd.localeCompare(b.tijd);});
  cards.push('<div class="digicard"><h4>Dagprogramma</h4>'+(progItems.length?progItems.map(function(i){return '<div class="drow"><span>'+esc(i.tekst)+'</span><span class="dsub">'+esc(i.tijd)+'</span></div>';}).join(''):'<div class="dsub">Geen programma-items vandaag.</div>')+'</div>');
 }
 if(digiOn('takenbord'))cards.push('<div class="digicard"><h4>Takenbord</h4>'+['Afwas inruimen','Planten water geven','Was vouwen'].map(function(t,i){return '<div class="drow"><span><span class="dot" style="background:'+(i===0?'var(--moss)':'var(--line-strong)')+'"></span>'+t+'</span><span class="dsub">'+(i===0?'Gedaan':'Open')+'</span></div>';}).join('')+'</div>');
 if(digiOn('dienstenbord'))cards.push('<div class="digicard"><h4>Dienstenbord</h4>'+(medewerkers.length?medewerkers.map(function(m,i){return '<div class="drow"><span>'+esc(naam(m))+'</span><span class="dsub">'+(i===0?'Vandaag':'Morgen')+'</span></div>';}).join(''):'<div class="dsub">Geen medewerkers in deze groep.</div>')+'</div>');
 if(digiOn('maaltijdenbord'))cards.push('<div class="digicard"><h4>Maaltijdenbord</h4><div class="drow"><span>Ontbijt</span><span class="dsub">Volkoren & fruit</span></div><div class="drow"><span>Lunch</span><span class="dsub">Soep & broodjes</span></div><div class="drow"><span>Diner</span><span class="dsub">Stamppot</span></div></div>');
 if(digiOn('kalenderbord'))cards.push('<div class="digicard wide"><h4>Kalenderbord</h4><div class="drow"><span>Koffie-uurtje</span><span class="dsub">Vrijdag 15:00</span></div><div class="drow"><span>Familiedag</span><span class="dsub">Zaterdag 24 sep</span></div></div>');
 el('digibord-preview').innerHTML=cards.length?cards.join(''):'<div class="digiscreen-empty">Niets aangevinkt — het Digibord toont nu niks.</div>';
}
function renderDigibord(){
 var stand=digibordStand(huidigeGroep);
 el('digibord-lijst').innerHTML=DIGIBORD.map(function(d){
  return '<div class="digirow"><div class="dtxt"><b>'+esc(d.l)+'</b><span>'+esc(d.s)+'</span></div>'+
   '<label class="toggle"><input type="checkbox" data-dk="'+esc(d.k)+'" aria-label="'+esc(d.l)+'" '+(stand[d.k]?'checked':'')+'><span class="track"></span><span class="knob"></span></label></div>';
 }).join('');
 Array.prototype.forEach.call(el('digibord-lijst').querySelectorAll('[data-dk]'),function(c){
  c.addEventListener('change',function(){
   digibordStand(huidigeGroep)[c.getAttribute('data-dk')]=c.checked;
   renderDigibordPreview();
  });
 });
 renderDigibordPreview();
}
renderDigibord();
el('digibord-opslaan').addEventListener('click',function(){
 var stand=digibordStand(huidigeGroep);
 var aan=DIGIBORD.filter(function(d){return stand[d.k];}).map(function(d){return d.l;});
 el('digibord-bevestiging').innerHTML='<div class="bevestiging reveal">Digibord-instellingen opgeslagen voor '+esc(huidigeGroep)+'.</div>';
 logActie('Digibord van '+huidigeGroep+' ingesteld op: '+(aan.length?aan.join(', '):'niets actief'));
 syncOrganisatieData();
 verzondenTimer=setTimeout(function(){show('pp-hub');},1500);
});

/* ============== CLIENT-APP (MOBIEL) ============== */
var caClientId=null, caTab='vandaag';
var EMOJIS=['👍','❤️','😊','✅'];
function ensureClientData(id){
 if(CLIENTDATA[id])return CLIENTDATA[id];
 var d={
  doelen:[
   {id:1,titel:'Zelfstandig aankleden',rapportages:[
    {id:1,tekst:'Vandaag zelfstandig de trui aangedaan, ging goed!',tijd:'09-09-2026 08:14',auteur:'Marieke de Vries',media:false,reacties:{'👍':2,'❤️':1}},
    {id:2,tekst:'Had wat hulp nodig bij de knoopjes, morgen nog eens proberen.',tijd:'08-09-2026 08:02',auteur:'Sofie Mulder',media:true,reacties:{'👍':1}}
   ]},
   {id:2,titel:'Op tijd naar bed',rapportages:[]}
  ],
  agenda:[
   {id:1,titel:'Fysiotherapie',datumlabel:'12 SEP',tijd:'10:00',media:true},
   {id:2,titel:'Verjaardag opa',datumlabel:'14 SEP',tijd:'15:00',media:false}
  ],
  ikboek:[
   {id:1,tekst:'Mooie wandeling gemaakt in het park, genoten van de zon.',tijd:'07-09-2026',mediaType:'video',reacties:{'❤️':3,'😊':1}}
  ],
  customChats:[]
 };
 var nid=100+id*10;
 d._nextDoelId=nid+1;d._nextRapportId=nid+50;d._nextAgendaId=nid+100;d._nextIkboekId=nid+150;d._nextChatId=nid+200;
 CLIENTDATA[id]=d;
 return d;
}
/* Uitloggen moet ook echt afsluiten. Het loginscherm vulde alleen de body, maar
   de onderbalk, de SOS-knop en de cliëntkiezer bleven werken: één tik op Doelen
   en je zat weer in het dossier zonder ooit te hebben ingelogd. */
var caUitgelogd=false;
function caZetIngelogd(aan){
 caUitgelogd=!aan;
 var nav=document.querySelector('#view-clientapp .bottomnav')||document.querySelector('.bottomnav');
 if(nav)nav.hidden=!aan;
 var sos=el('ca-sos-btn');if(sos)sos.hidden=!aan;
 var bel=el('ca-bel');if(bel)bel.hidden=!aan;
 var kies=el('ca-client-select');if(kies)kies.disabled=!aan;
 if(aan){renderCaHeader();}
 else{el('ca-naam').textContent='MyWepp';el('ca-avatar').innerHTML='';}
}
/* De clientapp is het dossier zelf, geen beheerlijst. Een cliënt die geblokkeerd
   is, van wie de toegang is verlopen of die al gemarkeerd staat voor verwijdering
   hoort hier niet meer te openen: blokkeren is juist het moment waarop het kijken
   stopt (AVG art. 32 — toegang past bij de status van het account). */
function clientenMetToegang(){
 return personenVanType('client').filter(function(p){return p._state!=='verwijderd'&&heeftToegang(p);});
}
function renderClientApp(){
 if(caUitgelogd){renderLoginScherm();return;}
 var clients=clientenMetToegang();
 if(!caClientId||!clients.some(function(c){return c.id===caClientId;}))caClientId=clients[0]?clients[0].id:null;
 el('ca-client-select').innerHTML=clients.map(function(c){return '<option value="'+c.id+'"'+(c.id===caClientId?' selected':'')+'>'+esc(naam(c))+'</option>';}).join('');
 renderCaHeader();
 werkBelBij();
 renderCaTab(caTab);
}
el('ca-client-select').addEventListener('change',function(){caClientId=+el('ca-client-select').value;renderCaHeader();werkBelBij();renderCaTab(caTab);});
function renderCaHeader(){
 var p=findPerson(caClientId);if(!p)return;
 el('ca-avatar').innerHTML=avatarHtmlSized(naam(p),28);
 el('ca-naam').textContent=naam(p);
}
document.querySelectorAll('.bottomnav button').forEach(function(b){
 b.addEventListener('click',function(){
  document.querySelectorAll('.bottomnav button').forEach(function(x){x.classList.remove('on');});
  b.classList.add('on');caTab=b.getAttribute('data-catab');renderCaTab(caTab);
 });
});
function renderCaTab(tab){
 if(!caClientId){
  var totaal=personenVanType('client').length;
  el('ca-body').innerHTML='<p class="empty-msg">'+(totaal?'Geen cliënt in '+esc(huidigeGroep)+' met een actief account. Geblokkeerde cliënten en cliënten met een verlopen toegang zijn hier niet te openen.':'Geen cliënten in deze groep.')+'</p>';
  el('ca-naam').textContent='—';el('ca-avatar').innerHTML='';
  return;
 }
 if(tab==='vandaag')renderCaVandaag();
 else if(tab==='info')renderCaInfo();
 else if(tab==='doelen')renderCaDoelen();
 else if(tab==='agenda')renderCaAgenda();
 else if(tab==='ikboek')renderCaIkboek();
 else if(tab==='chat')renderCaChatList();
}

/* ---- Vandaag ----
   De app opende op Info: een profielkaart met naam en e-mailadres. Wie aan het
   werk is, heeft een andere eerste vraag — wat staat er vandaag te gebeuren.
   De onderdelen bestonden al los van elkaar (agenda, geheugensteuntjes,
   maaltijd, de laatste rapportage); hier staan ze bij elkaar. */
function afsprakenVandaag(clientId){
 var d=ensureClientData(clientId),nu=new Date();
 var vandaagLabel=nu.getDate()+' '+MAAND_AFK[nu.getMonth()];
 return (d.agenda||[]).filter(function(a){return a.datumlabel===vandaagLabel;});
}
function laatsteRapportage(clientId){
 var d=ensureClientData(clientId),beste=null;
 (d.doelen||[]).forEach(function(doel){
  (doel.rapportages||[]).forEach(function(r){if(!beste)beste={r:r,doel:doel};});
 });
 return beste;
}
function renderCaVandaag(){
 var p=findPerson(caClientId);if(!p)return;
 var nu=new Date();
 var dagen=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
 var html='<div style="margin-bottom:14px"><b style="font-size:17px">Vandaag</b>'+
  '<div class="mini">'+dagen[nu.getDay()]+' '+nu.getDate()+' '+MAANDNAMEN[nu.getMonth()]+'</div></div>';

 var afspraken=afsprakenVandaag(caClientId);
 html+='<div class="sublistlabel" style="margin-top:0">Afspraken</div>';
 html+=afspraken.length
  ? afspraken.map(function(a){
     return '<div class="agendacard"><div class="adate">'+esc(a.tijd)+'</div><div class="atxt"><b>'+esc(a.titel)+'</b>'+
      (a.locatie?'<span>'+esc(a.locatie)+'</span>':'')+'</div></div>';
    }).join('')
  : '<p class="empty-msg" style="padding:10px 0">Geen afspraken vandaag.</p>';

 var g=ensureGeheugen(caClientId);
 var actief=(g.items||[]).filter(function(it){return it.actief;});
 html+='<div class="sublistlabel">Geheugensteuntjes</div>';
 html+=actief.length
  ? actief.map(function(it){
     return '<div class="infocard-row"><span>'+esc(it.titel)+'</span><span>'+esc(it.tijd)+'</span></div>';
    }).join('')
  : '<p class="empty-msg" style="padding:10px 0">Niets ingesteld.</p>';

 var res=ensureMaaltijdReserveringen(caClientId);
 var aan=!!res[maaltijdSleutel(nu.getFullYear(),nu.getMonth(),nu.getDate())];
 html+='<div class="sublistlabel">Maaltijd</div>';
 html+='<div class="infocard-row"><span>Eet vandaag mee</span><span style="color:'+(aan?'var(--moss)':'var(--brick)')+'">'+(aan?'ja':'nee')+'</span></div>';

 var laatste=laatsteRapportage(caClientId);
 html+='<div class="sublistlabel">Laatste rapportage</div>';
 html+=laatste
  ? '<div class="rapport"><div class="rmeta"><span>'+esc(laatste.doel.titel)+'</span><span>'+esc(laatste.r.tijd||'')+'</span></div>'+esc(laatste.r.tekst)+'</div>'
  : '<p class="empty-msg" style="padding:10px 0">Nog niets vastgelegd.</p>';

 var open=ongelezenMeldingen(caClientId);
 if(open)html+='<button type="button" class="addbtn-row" style="margin-top:14px" id="ca-vandaag-meldingen">'+open+' nieuwe melding'+(open===1?'':'en')+' bekijken</button>';
 el('ca-body').innerHTML=html;
 var knop=el('ca-vandaag-meldingen');
 if(knop)knop.addEventListener('click',renderCaMeldingen);
}
/* --- Info --- */
function renderCaInfo(){
 var p=findPerson(caClientId);
 var html='<div style="text-align:center;margin-bottom:16px">'+avatarHtmlSized(naam(p),64).replace('style="','style="margin:0 auto 8px;')+'<b style="font-size:16px">'+esc(naam(p))+'</b></div>';
 html+='<div class="infocard-row"><span>Groep</span><span>'+esc(huidigeGroep)+'</span></div>';
 html+='<div class="infocard-row"><span>E-mailadres</span><span>'+esc(p.mail||'—')+'</span></div>';
 html+='<div class="sublistlabel">Betrokkenen</div>';
 /* Rollen staan hier vast. In MyWepp Personal kon iedereen die het
    cliëntdossier open had, met één keuzelijst zichzelf of een ander meer
    rechten geven, zonder de controles en het doorvoeren van Gebruikers
    beheren. Op verzoek: in de Personal-app mag niemand hier iets mee. */
 html+='<p class="mini" style="margin:0 0 8px">Wie welke rol op '+esc(naam(p))+' heeft. Rollen wijzig je via Gebruikers beheren.</p>';
 html+='<div id="ca-info-rechten">'+personRechtenRow(p.id,true)+'</div>';
 html+='<div class="sublistlabel">Beheer</div>';
 html+='<button type="button" class="addbtn-row" style="justify-content:space-between;background:var(--surface);border-style:solid;border-color:var(--line);color:var(--ink)" id="ca-naar-geheugen">Geheugen <svg class="chev-r" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>';
 html+='<button type="button" class="addbtn-row" style="justify-content:space-between;background:var(--surface);border-style:solid;border-color:var(--line);color:var(--ink);margin-top:8px" id="ca-naar-toegang">Wie kan bij mijn gegevens <svg class="chev-r" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>';
 html+='<button type="button" class="addbtn-row" style="justify-content:space-between;background:var(--surface);border-style:solid;border-color:var(--line);color:var(--ink);margin-top:8px" id="ca-naar-instellingen">Meer instellingen <svg class="chev-r" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>';
 el('ca-body').innerHTML=html;
 el('ca-naar-geheugen').addEventListener('click',renderCaGeheugen);
 el('ca-naar-toegang').addEventListener('click',renderCaToegang);
 el('ca-naar-instellingen').addEventListener('click',renderCaInstellingen);
}

/* ---- Wie kan bij mijn gegevens (AVG art. 12 en 15) ----
   De beheerkant heeft "Wie ziet wie", maar de cliënt of zijn vertegenwoordiger
   kon nergens zien wie er in zijn dossier kan. Transparantie is geen extraatje:
   je hebt er recht op te weten wie je gegevens verwerkt. Dit scherm is bewust
   alleen-lezen — rechten wijzig je in het beheer, met de controles die daar
   gelden. */
function toegangTotClient(clientId){
 var lijst=[];
 people.forEach(function(x){
  if(x.id===clientId||x.archived)return;
  var rol=(x.clientRechten||{})[clientId];
  if(!rol)return;
  lijst.push({persoon:x,rol:rol,actief:heeftToegang(x)});
 });
 lijst.sort(function(a,b){
  if(a.actief!==b.actief)return a.actief?-1:1;
  return naam(a.persoon).localeCompare(naam(b.persoon));
 });
 return lijst;
}
function renderCaToegang(){
 var c=findPerson(caClientId);
 var lijst=toegangTotClient(caClientId);
 var actief=lijst.filter(function(x){return x.actief;});
 var inactief=lijst.filter(function(x){return !x.actief;});
 var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button type="button" class="ghost small" id="ca-toegang-terug">← Terug</button><b style="font-size:15px">Wie kan bij mijn gegevens</b></div>';
 html+='<p class="mini" style="margin:0 0 12px">Deze mensen kunnen het dossier van '+esc(naam(c))+' inzien, en met welke rol. Klopt er iets niet, of wil je dat iemand geen toegang meer heeft? Neem contact op met de contactpersoon van de groep.</p>';
 var regel=function(x,grijs){
  return '<div class="personrow"'+(grijs?' style="opacity:.6"':'')+'>'+avatarHtml(naam(x.persoon),fotoVan(x.persoon))+
   '<div class="pinfo"><div class="naam">'+esc(naam(x.persoon))+
    (x.persoon.contactVolgorde?' <span class="countchip" style="color:var(--accent)">Contactpersoon '+x.persoon.contactVolgorde+'</span>':'')+'</div>'+
   '<div class="mail">'+esc(TYPELABEL[x.persoon.type])+' · '+esc(x.rol)+'</div></div></div>';
 };
 html+='<div class="sublistlabel">Heeft nu toegang ('+actief.length+')</div>';
 html+=actief.length?actief.map(function(x){return regel(x,false);}).join('')
  :'<p class="empty-msg">Niemand heeft op dit moment toegang.</p>';
 if(inactief.length){
  html+='<div class="sublistlabel">Heeft een rol, maar kan nu niet inloggen ('+inactief.length+')</div>';
  html+='<p class="mini" style="margin:0 0 8px">Bijvoorbeeld omdat de toegang is verlopen of geblokkeerd. Zodra dat wordt opgeheven, kan deze persoon er weer bij.</p>';
  html+=inactief.map(function(x){return regel(x,true);}).join('');
 }
 if(c.wettelijkeVertegenwoordiger){
  var wv=findPerson(c.wettelijkeVertegenwoordiger);
  if(wv)html+='<div class="sublistlabel">Wettelijk vertegenwoordiger</div><div class="personrow">'+avatarHtml(naam(wv),fotoVan(wv))+
   '<div class="pinfo"><div class="naam">'+esc(naam(wv))+'</div><div class="mail">'+esc(TYPELABEL[wv.type])+'</div></div></div>';
 }
 if(SYSTEEMBEHEER.tel){
  html+='<p class="mini" style="margin-top:14px">Vragen over wie je gegevens mag zien? Bel systeembeheer: '+esc(SYSTEEMBEHEER.tel)+'.</p>';
 }
 el('ca-body').innerHTML='<div id="ca-toegang-lijst">'+html+'</div>';
 /* Zonder dit opent het scherm op de scrollpositie van het vorige, waardoor de
    titel en de terugknop buiten beeld staan. */
 el('ca-body').scrollTop=0;
 el('ca-toegang-terug').addEventListener('click',renderCaInfo);
}

/* --- Geheugen --- */
var GEHEUGEN={};
function ensureGeheugen(id){
 if(!GEHEUGEN[id])GEHEUGEN[id]={items:[
  {id:1,titel:'Ochtendroutine — tanden poetsen',tijd:'08:00',dagen:'Elke dag',actief:true},
  {id:2,titel:'Medicatie innemen',tijd:'12:30',dagen:'Elke dag',actief:true},
  {id:3,titel:'Bellen met opa',tijd:'19:00',dagen:'Zondag',actief:false}
 ],nextId:4};
 return GEHEUGEN[id];
}
function renderCaGeheugen(){
 var g=ensureGeheugen(caClientId);
 var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button type="button" class="ghost small" id="ca-geheugen-terug">← Terug</button><b style="font-size:15px">Geheugen</b></div>';
 html+='<p class="mini" style="margin:0 0 12px">Herinneringen die deze cliënt op zijn/haar telefoon of Digibord te zien krijgt.</p>';
 html+=g.items.map(function(it){
  return '<div class="doelcard"><div class="dtop"><b>'+esc(it.titel)+'</b><label class="toggle"><input type="checkbox" data-geh-actief="'+esc(it.id)+'" '+(it.actief?'checked':'')+'><span class="track"></span><span class="knob"></span></label></div>'+
   '<p class="mini" style="margin:0">'+esc(it.tijd)+' · '+esc(it.dagen)+'</p>'+
   '<div class="actions end" style="border:0;padding-top:8px;margin-top:6px"><button type="button" class="small" data-geh-verwijder="'+esc(it.id)+'">Verwijderen</button></div></div>';
 }).join('');
 html+='<button type="button" class="addbtn-row" id="ca-geheugen-nieuw">+ Herinnering toevoegen</button>';
 el('ca-body').innerHTML=html;
 el('ca-geheugen-terug').addEventListener('click',renderCaInfo);
 el('ca-geheugen-nieuw').addEventListener('click',function(){
  var WEEKDAGEN=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
  openModal('<h3>Herinnering toevoegen</h3>'+
   '<div class="field"><label>Waar gaat het over?</label><input id="modal-geh-titel" maxlength="80" placeholder="Bijv. Tanden poetsen"></div>'+
   '<div class="field"><label>Tijdstip</label><input id="modal-geh-tijd" maxlength="20" value="08:00"></div>'+
   '<div class="field"><label>Hoe vaak?</label><select id="modal-geh-herhaling">'+
    '<option value="elke-dag">Elke dag</option>'+
    '<option value="werkdagen">Op werkdagen (ma–vr)</option>'+
    '<option value="wekelijks">Wekelijks, op een vaste dag</option>'+
    '<option value="eenmalig">Eenmalig</option>'+
   '</select></div>'+
   '<div class="field" id="modal-geh-dag-veld" hidden><label>Welke dag?</label><select id="modal-geh-dag">'+WEEKDAGEN.map(function(d){return '<option>'+d+'</option>';}).join('')+'</select></div>'+
   '<div class="field" id="modal-geh-datum-veld" hidden><label>Op welke datum?</label><input id="modal-geh-datum" type="date"></div>'+
   '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Toevoegen</button></div>');
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-geh-herhaling').addEventListener('change',function(){
   var v=el('modal-geh-herhaling').value;
   el('modal-geh-dag-veld').hidden=(v!=='wekelijks');
   el('modal-geh-datum-veld').hidden=(v!=='eenmalig');
  });
  el('modal-opslaan').addEventListener('click',function(){
   var titel=kap(el('modal-geh-titel').value.trim(),MAXLEN.titel);if(!titel){el('modal-geh-titel').style.borderColor='var(--brick)';return;}
   var herhaling=el('modal-geh-herhaling').value,dagen;
   if(herhaling==='elke-dag')dagen='Elke dag';
   else if(herhaling==='werkdagen')dagen='Op werkdagen';
   else if(herhaling==='wekelijks')dagen=el('modal-geh-dag').value;
   else{
    var datum=el('modal-geh-datum').value;
    if(!datum){el('modal-geh-datum').style.borderColor='var(--brick)';return;}
    var d=new Date(datum+'T00:00:00');
    dagen='Eenmalig · '+d.toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});
   }
   g.items.push({id:nieuwNummer(),titel:titel,tijd:el('modal-geh-tijd').value.trim()||'—',dagen:dagen,actief:true});
   bewaarClientData(caClientId);closeModal();renderCaGeheugen();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-geh-actief]'),function(c){
  c.addEventListener('change',function(){g.items.filter(function(x){return x.id===+c.getAttribute('data-geh-actief');})[0].actief=c.checked;bewaarClientData(caClientId);});
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-geh-verwijder]'),function(b){
  b.addEventListener('click',function(){
   var gid=+b.getAttribute('data-geh-verwijder');
   var it=g.items.filter(function(x){return x.id===gid;})[0];
   openModal('<h3>Herinnering verwijderen</h3><div class="msec"><p>Weet je zeker dat je <b>'+esc(it?it.titel:'deze herinnering')+'</b> wilt verwijderen?</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-bevestig').addEventListener('click',function(){
    g.items=g.items.filter(function(x){return x.id!==gid;});bewaarClientData(caClientId);
    closeModal();renderCaGeheugen();
   });
  });
 });
}

/* ---- Cliëntweergave ----
   De app is helemaal vanuit de medewerker geschreven: het eerste wat je ziet is
   een profielkaart met rollen en rechten. Voor de cliënt zelf is dat niet alleen
   overbodig maar ook niet de bedoeling. In deze stand blijft staan wat van hem
   is — zijn dag, zijn agenda, zijn Ik-Boek en zijn gesprekken — in grote letters,
   zonder de knoppen waarmee je in het dossier van anderen werkt. */
var caClientweergave=false;
var CA_CLIENTTABS=['vandaag','agenda','ikboek','chat'];
function zetClientweergave(aan){
 caClientweergave=!!aan;
 document.querySelectorAll('#view-clientapp .bottomnav button').forEach(function(b){
  var t=b.getAttribute('data-catab');
  b.hidden=caClientweergave&&CA_CLIENTTABS.indexOf(t)<0;
 });
 var terug=el('ca-weergave-terug');
 if(terug)terug.hidden=!caClientweergave;
 zetGroteTekst(caClientweergave);
 if(caClientweergave&&CA_CLIENTTABS.indexOf(caTab)<0)caTab='vandaag';
 logActie(caClientweergave?'Cliëntweergave aangezet':'Terug naar de medewerkerweergave');
 zetCaTab(caTab);
}
/* ---- Meldingen ----
   Bij "Meer instellingen" staan vier schakelaars: nieuwe rapportage, nieuw
   bericht, agendaherinnering en SOS. Je zette daarmee iets aan wat nergens
   binnenkwam — er was geen plek waar een melding terechtkwam. Die is er nu,
   en de schakelaars bepalen echt wat je te zien krijgt. */
var MELDSOORT={
 nieuweRapportage:{icoon:'\ud83d\udcdd',tab:'doelen'},
 nieuwBericht:{icoon:'\ud83d\udcac',tab:'chat'},
 agendaHerinnering:{icoon:'\ud83d\udcc5',tab:'agenda'},
 sosMelding:{icoon:'\ud83c\udd98',tab:null}
};
/* Meldingen stonden alleen in het geheugen: na herladen waren ze weg, en wat
   Anna in het dossier deed kwam bij Bram nooit binnen. Nu staan ze in het
   dossier van de cliënt (lijst meldingen, samengevoegd per item zoals de rest),
   en gelezen is per persoon: dat Anna een melding las, betekent niet dat Bram
   hem gezien heeft. */
function meldingenVan(clientId){
 var d=ensureClientData(clientId);
 if(!Array.isArray(d.meldingen))d.meldingen=beginMeldingen(clientId);
 return d.meldingen;
}
/* Wat uit de database komt is niet op type afgedwongen; een onbekende soort
   liet het scherm vastlopen op het icoon. */
function geldigeMelding(m){return !!m&&typeof m==='object'&&!!MELDSOORT[m.soort];}
function isGelezen(m){return !!(m.gelezenDoor&&typeof m.gelezenDoor==='object'&&m.gelezenDoor[reactieSleutel()]);}
function markeerGelezen(m){
 if(!m.gelezenDoor||typeof m.gelezenDoor!=='object'||Array.isArray(m.gelezenDoor))m.gelezenDoor={};
 m.gelezenDoor[reactieSleutel()]=true;
}
/* Bij het openen is de lijst niet leeg: hij wordt opgebouwd uit wat er al in het
   dossier staat, zodat je ziet waar het over gaat. De nummers zijn vast (1, 2,
   …): bouwen twee mensen hem tegelijk op, dan vallen ze bij het samenvoegen
   samen in plaats van dubbel te staan. */
function beginMeldingen(clientId){
 var d=CLIENTDATA[clientId],lijst=[],n=1;
 if(d&&d.doelen)d.doelen.forEach(function(doel){
  (doel.rapportages||[]).forEach(function(r){
   lijst.push({id:n++,soort:'nieuweRapportage',tekst:(r.auteur||'Iemand')+' schreef een rapportage bij “'+doel.titel+'”',tijd:r.tijd||'',gelezenDoor:{}});
  });
 });
 if(d&&d.agenda)d.agenda.slice(0,2).forEach(function(a){
  lijst.push({id:n++,soort:'agendaHerinnering',tekst:a.titel+' staat gepland op '+a.datumlabel+' om '+a.tijd,tijd:a.datumlabel,gelezenDoor:{}});
 });
 return lijst;
}
function nieuweMelding(clientId,soort,tekst){
 if(!clientId||!MELDSOORT[soort])return;
 /* De schakelaar van de cliënt bepaalt of dit binnenkomt. */
 if(!ensureCaInstellingen(clientId)[soort])return;
 var lijst=meldingenVan(clientId);
 /* Wie het zelf deed, hoeft er geen melding van te krijgen. */
 var m={id:nieuwNummer(),soort:soort,tekst:tekst,tijd:new Date().toISOString(),gelezenDoor:{}};
 markeerGelezen(m);
 lijst.unshift(m);
 if(lijst.length>40)lijst.length=40;
 werkBelBij();
 bewaarClientData(clientId);
}
function ongelezenMeldingen(clientId){
 return meldingenVan(clientId).filter(function(m){return geldigeMelding(m)&&!isGelezen(m)&&ensureCaInstellingen(clientId)[m.soort];}).length;
}
function werkBelBij(){
 var teller=el('ca-bel-teller');if(!teller)return;
 var n=caClientId?ongelezenMeldingen(caClientId):0;
 teller.hidden=!n;
 /* Boven de 99 is het precieze aantal niet meer nuttig en past het getal niet
   meer in het bolletje. */
 teller.textContent=n>99?'99+':String(n);
}
function renderCaMeldingen(){
 var lijst=meldingenVan(caClientId).filter(function(m){return geldigeMelding(m)&&ensureCaInstellingen(caClientId)[m.soort];});
 var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button type="button" class="ghost small" id="ca-meld-terug">← Terug</button><b style="font-size:15px">Meldingen</b></div>';
 if(!lijst.length){
  html+='<p class="empty-msg">Geen meldingen. Wat je hier ziet, bepaal je bij Meer instellingen.</p>';
 }else{
  html+=lijst.map(function(m,i){
   return '<div class="meldrij'+(isGelezen(m)?'':' ongelezen')+'" data-meld="'+i+'">'+
    '<span class="micoon">'+MELDSOORT[m.soort].icoon+'</span>'+
    '<span class="mtxt">'+esc(String(m.tekst||''))+'</span>'+
    '<span class="mtijd">'+esc(chatTijd(String(m.tijd||'')))+'</span></div>';
  }).join('');
  html+='<button type="button" class="small" style="width:100%;margin-top:14px" id="ca-meld-gelezen">Alles als gelezen markeren</button>';
 }
 el('ca-body').innerHTML=html;
 el('ca-meld-terug').addEventListener('click',function(){renderCaTab(caTab);});
 var alles=el('ca-meld-gelezen');
 if(alles)alles.addEventListener('click',function(){
  meldingenVan(caClientId).forEach(function(m){if(geldigeMelding(m))markeerGelezen(m);});
  bewaarClientData(caClientId);
  werkBelBij();renderCaMeldingen();
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-meld]'),function(rij){
  rij.addEventListener('click',function(){
   var m=lijst[+rij.getAttribute('data-meld')];if(!m)return;
   markeerGelezen(m);bewaarClientData(caClientId);werkBelBij();
   var doel=MELDSOORT[m.soort].tab;
   if(doel){zetCaTab(doel);}else{renderCaMeldingen();}
  });
 });
}
/* Een tab kiezen moet ook de knop onderin laten meelopen, anders licht de
   verkeerde op als je via een melding ergens terechtkomt. */
function zetCaTab(tab){
 caTab=tab;
 document.querySelectorAll('#view-clientapp .bottomnav button').forEach(function(x){
  x.classList.toggle('on',x.getAttribute('data-catab')===tab);
 });
 renderCaTab(tab);
}
/* --- Meer instellingen --- */
var CA_INSTELLINGEN={};
function ensureCaInstellingen(id){
 if(!CA_INSTELLINGEN[id])CA_INSTELLINGEN[id]={
  nieuweRapportage:true,nieuwBericht:true,agendaHerinnering:true,sosMelding:true,
  deelLocatie:false,tweestaps:true,groteTekst:false
 };
 return CA_INSTELLINGEN[id];
}
function caToggleRow(label,key,waarden){
 return '<div class="togglerow"><span>'+label+'</span><label class="toggle"><input type="checkbox" data-inst="'+key+'" '+(waarden[key]?'checked':'')+'><span class="track"></span><span class="knob"></span></label></div>';
}
function renderCaInstellingen(){
 var w=ensureCaInstellingen(caClientId);
 w.groteTekst=groteTekstAan();
 var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button type="button" class="ghost small" id="ca-instellingen-terug">← Terug</button><b style="font-size:15px">Meer instellingen</b></div>';
 html+='<div class="sublistlabel" style="margin-top:0">Meldingen</div>';
 html+=caToggleRow('Nieuwe rapportage','nieuweRapportage',w);
 html+=caToggleRow('Nieuw bericht','nieuwBericht',w);
 html+=caToggleRow('Agendaherinnering','agendaHerinnering',w);
 html+=caToggleRow('SOS-melding','sosMelding',w);
 html+='<div class="sublistlabel">Privacy</div>';
 html+=caToggleRow('Deel locatie bij SOS','deelLocatie',w);
 html+=caToggleRow('Tweestapsverificatie vereist','tweestaps',w);
 html+='<div class="sublistlabel">Weergave</div>';
 html+=caToggleRow('Grote tekst','groteTekst',w);
 html+='<div class="togglerow"><span>Cliëntweergave<br><span class="mini">Alleen wat de cliënt zelf ziet, in grote letters</span></span><label class="toggle"><input type="checkbox" id="ca-clientweergave" '+(caClientweergave?'checked':'')+'><span class="track"></span><span class="knob"></span></label></div>';
 html+='<div class="togglerow"><span>Donkere modus</span><label class="toggle"><input type="checkbox" id="ca-donker-toggle" '+(document.documentElement.getAttribute('data-theme')==='dark'?'checked':'')+'><span class="track"></span><span class="knob"></span></label></div>';
 html+='<div class="sublistlabel">Account</div>';
 html+='<button type="button" class="small" style="width:100%;margin-bottom:8px" id="ca-mijn-profiel">Mijn profiel</button>';
 html+='<button type="button" class="small" style="width:100%;margin-bottom:8px" id="ca-wachtwoord">Wachtwoord wijzigen</button>';
 html+='<button type="button" class="danger small" style="width:100%" id="ca-uitloggen">Uitloggen</button>';
 html+='<div class="actions end" style="border:0;margin-top:16px"><button type="button" class="primary" id="ca-instellingen-opslaan">Opslaan</button></div>';
 html+='<div id="ca-instellingen-bevestiging"></div>';
 el('ca-body').innerHTML=html;
 el('ca-instellingen-terug').addEventListener('click',renderCaInfo);
 el('ca-mijn-profiel').addEventListener('click',renderMijnProfiel);
 el('ca-donker-toggle').addEventListener('change',function(){document.documentElement.setAttribute('data-theme',this.checked?'dark':'light');});
 el('ca-clientweergave').addEventListener('change',function(){zetClientweergave(this.checked);});
 el('ca-wachtwoord').addEventListener('click',openWachtwoordModal);
 el('ca-uitloggen').addEventListener('click',function(){
  openModal('<h3>Uitloggen</h3><div class="msec"><p>Weet je zeker dat je wilt uitloggen?</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Uitloggen</button></div>');
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-bevestig').addEventListener('click',function(){closeModal();logActie('Uitgelogd uit MyWepp Personal');renderLoginScherm();});
 });
 el('ca-instellingen-opslaan').addEventListener('click',function(){
  Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-inst]'),function(inp){
   w[inp.getAttribute('data-inst')]=inp.checked;
  });
  zetGroteTekst(w.groteTekst);
  bewaarClientData(caClientId);
  el('ca-instellingen-bevestiging').innerHTML='<div class="bevestiging reveal" style="margin-top:10px">Instellingen opgeslagen.</div>';
 });
}

function mockQrSvg(){
 var n=12,cells='';
 for(var y=0;y<n;y++){
  for(var x=0;x<n;x++){
   if(avatarHash(x+'-'+y+'-mywepp-2fa')%2===0)cells+='<rect x="'+(x*10)+'" y="'+(y*10)+'" width="10" height="10" fill="#12161c"/>';
  }
 }
 return '<svg viewBox="0 0 '+(n*10)+' '+(n*10)+'" style="width:150px;height:150px;background:#fff;border:1px solid var(--line);border-radius:6px">'+cells+'</svg>';
}
function renderMijnProfiel(){
 var p=MIJN_PROFIEL;
 var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button type="button" class="ghost small" id="mp-terug">← Terug</button><b style="font-size:15px">Mijn profiel</b></div>';
 html+='<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px"><div class="hubavatar" id="mp-foto" style="width:64px;height:64px;flex:0 0 64px"></div><button type="button" class="small" id="mp-foto-wijzigen">Kies of maak foto</button></div>';
 html+='<div class="field"><label for="mp-voor">Voornaam<span class="verplicht" aria-hidden="true">*</span></label><input id="mp-voor" maxlength="60" required aria-required="true" value="'+esc(p.voor)+'"></div>';
 html+='<div class="field"><label for="mp-achter">Achternaam<span class="verplicht" aria-hidden="true">*</span></label><input id="mp-achter" maxlength="60" required aria-required="true" value="'+esc(p.achter)+'"></div>';
 html+='<div class="field"><label>Mobiel nummer</label><input id="mp-mobiel" maxlength="25" value="'+esc(p.mobiel)+'"></div>';
 html+='<div class="field"><label>Functie</label><input id="mp-functie" maxlength="60" value="'+esc(p.functie)+'"></div>';
 html+='<div class="field"><label>Geboortedatum</label><input type="date" id="mp-geboortedatum" value="'+esc(p.geboortedatum)+'"></div>';
 html+='<div class="field"><label for="mp-mail">E-mailadres<span class="verplicht" aria-hidden="true">*</span></label><input id="mp-mail" maxlength="120" required aria-required="true" value="'+esc(p.mail)+'"></div>';
 html+='<div class="sublistlabel">Beveiliging</div>';
 html+='<div class="togglerow"><span>Tweestapsverificatie</span>'+(p.tweestaps?'<span class="badge" style="background:var(--moss-bg);color:var(--moss);border-color:var(--moss-line)">Actief</span>':'<span class="badge">Niet actief</span>')+'</div>';
 if(p.tweestaps)html+='<p class="mini" style="margin:-4px 0 8px">Ingesteld op '+esc(p.tweestapsDatum)+'.</p>';
 html+='<button type="button" class="'+(p.tweestaps?'danger':'primary')+' small" style="width:100%;margin-bottom:14px" id="mp-tweestaps-toggle">'+(p.tweestaps?'Uitschakelen':'Aanzetten')+'</button>';
 html+='<div class="sublistlabel">Extra gegevens</div>';
 html+='<p class="mini" style="margin-top:-6px">Plaats geen gevoelige informatie in dit veld.</p>';
 html+='<textarea id="mp-opmerkingen" style="width:100%;min-height:70px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font:inherit;font-size:13.5px">'+esc(p.opmerkingen)+'</textarea>';
 html+='<div class="actions end" style="border:0;margin-top:14px"><button type="button" class="primary" id="mp-opslaan">Opslaan</button></div>';
 html+='<div id="mp-bevestiging"></div>';
 el('ca-body').innerHTML=html;
 setGrootAvatar('mp-foto',p);
 el('mp-terug').addEventListener('click',renderCaInstellingen);
 el('mp-foto-wijzigen').addEventListener('click',function(){openFotoModal('mp-foto',p);});
 el('mp-opslaan').addEventListener('click',function(){
  /* De tweede stap werd al naar het account doorgezet, de rest niet: je naam
     en e-mailadres veranderden alleen in dit scherm en stonden in het beheer
     nog op het oude. Een ongeldig adres werd zonder meer aangenomen, terwijl
     je daarmee inlogt. */
  var mail=kap(el('mp-mail').value.trim(),MAXLEN.mail);
  var geboorte=el('mp-geboortedatum').value;
  var fout='';
  /* Een leeg naamveld werd stilzwijgend genegeerd (de oude naam bleef staan),
     waardoor het leek alsof het opslaan gelukt was. Nu zeggen we het gewoon. */
  if(!el('mp-voor').value.trim())fout='Vul een voornaam in.';
  else if(!el('mp-achter').value.trim())fout='Achternaam is verplicht.';
  else if(!mail)fout='Vul een e-mailadres in.';
  else if(!mailGeldig(mail))fout='Vul een geldig e-mailadres in.';
  else if(geboorte&&(!geldigeDatum(geboorte)||geboorte>vandaagISO()))fout='Een geboortedatum in de toekomst kan niet.';
  if(fout){el('mp-bevestiging').innerHTML='<p class="mini" style="color:var(--brick);margin-top:10px">'+esc(fout)+'</p>';return;}
  p.voor=kap(el('mp-voor').value.trim(),MAXLEN.naam)||p.voor;
  p.achter=kap(el('mp-achter').value.trim(),MAXLEN.naam)||p.achter;
  p.mobiel=kap(el('mp-mobiel').value.trim(),MAXLEN.tel);
  p.functie=kap(el('mp-functie').value.trim(),MAXLEN.functie);
  p.geboortedatum=geboorte;
  p.mail=kap(mail,MAXLEN.mail);
  p.opmerkingen=kap(el('mp-opmerkingen').value,400);
  zetProfielOpAccount();
  el('mp-bevestiging').innerHTML='<div class="bevestiging reveal" style="margin-top:10px">Profiel opgeslagen.</div>';
 });
 el('mp-tweestaps-toggle').addEventListener('click',function(){
  if(p.tweestaps){
   openModal('<h3>Tweestapsverificatie uitzetten?</h3><div class="msec"><p>Je staat op het punt om tweestapsverificatie uit te zetten. Je account is daarna minder beveiligd. Je logt dan alleen in met je e-mailadres en wachtwoord.</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Uitzetten</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-bevestig').addEventListener('click',function(){
    p.tweestaps=false;p.tweestapsDatum='';
    zetTweestapsOpAccount(false);
    closeModal();renderMijnProfiel();
   });
  }else{
   openModal('<h3>Tweestapsverificatie instellen</h3>'+
    '<div class="msec" style="display:flex;flex-direction:column;align-items:center;gap:12px">'+
    '<p style="margin:0;text-align:center">Scan de QR-code met je authenticator-app, of gebruik de instelsleutel handmatig.</p>'+
    mockQrSvg()+
    '<button type="button" class="ghost small" id="mp-instelsleutel-tonen">Instelsleutel gebruiken</button>'+
    '<div id="mp-instelsleutel" hidden style="text-align:center"><code style="font-size:13px;letter-spacing:.05em">EW2H 8CXV H7WO V2WD 3Z6F QKZ6 KQVR TFYO</code></div>'+
    '<div class="field" style="width:100%"><label>Beveiligingscode</label><input id="mp-2fa-code" maxlength="6" placeholder="6 cijfers" style="text-align:center;letter-spacing:.3em;font-size:18px"></div>'+
    '</div>'+
    '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="mp-2fa-koppelen">Controleren en koppelen</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('mp-instelsleutel-tonen').addEventListener('click',function(){el('mp-instelsleutel').hidden=!el('mp-instelsleutel').hidden;});
   el('mp-2fa-koppelen').addEventListener('click',function(){
    var code=el('mp-2fa-code').value.trim();
    if(!/^\d{6}$/.test(code)){el('mp-2fa-code').style.borderColor='var(--brick)';return;}
    p.tweestaps=true;
    p.tweestapsDatum=new Date().toLocaleDateString('nl-NL',{day:'2-digit',month:'long',year:'numeric'});
    zetTweestapsOpAccount(true);
    closeModal();renderMijnProfiel();
   });
  }
 });
}
/* "Mijn profiel" en het account in de beheeromgeving zijn dezelfde persoon.
   Werd dat niet doorgezet, dan zette iemand de tweede stap aan terwijl de
   controle bleef melden dat hij ontbrak. */
/* Dezelfde doorzetting als bij de tweede stap, maar dan voor de gegevens die je
   in Mijn profiel wijzigt. De wijziging loopt via dezelfde controle-en-doorvoeren
   route als elke andere wijziging in het beheer. */
function zetProfielOpAccount(){
 var ik=huidigeGebruiker();
 if(!ik)return;
 var oud=naam(ik),veranderd=[];
 if(MIJN_PROFIEL.voor&&ik.voor!==MIJN_PROFIEL.voor){ik.voor=MIJN_PROFIEL.voor;veranderd.push('voornaam');}
 if(MIJN_PROFIEL.achter&&ik.achter!==MIJN_PROFIEL.achter){ik.achter=MIJN_PROFIEL.achter;veranderd.push('achternaam');}
 if((ik.mail||'')!==MIJN_PROFIEL.mail){ik.mail=MIJN_PROFIEL.mail;veranderd.push('e-mailadres');}
 if((ik.tel||'')!==MIJN_PROFIEL.mobiel){ik.tel=MIJN_PROFIEL.mobiel;veranderd.push('telefoonnummer');}
 if(MIJN_PROFIEL.foto&&ik.foto!==MIJN_PROFIEL.foto){ik.foto=MIJN_PROFIEL.foto;veranderd.push('profielfoto');}
 if(!veranderd.length)return;
 if(ik._state!=='nieuw')ik._state='gewijzigd';
 logActie(oud+' heeft het eigen profiel aangepast: '+veranderd.join(', '));
 syncToSupabase();
 if(typeof renderAll==='function')renderAll();
}
function zetTweestapsOpAccount(aan){
 var ik=huidigeGebruiker();
 if(!ik)return;
 ik.tweestaps=!!aan;
 if(aan)ik.tweestapsDatum=vandaagISO(); else delete ik.tweestapsDatum;
 logActie(aan?(naam(ik)+' heeft tweestapsverificatie aangezet'):(naam(ik)+' heeft tweestapsverificatie uitgezet'));
 syncToSupabase();
 if(typeof renderAll==='function')renderAll();
}
function openWachtwoordModal(){
 openModal('<h3>Wachtwoord wijzigen</h3>'+
  '<div class="field"><label>Huidig wachtwoord</label><input type="password" id="ww-huidig"></div>'+
  '<div class="field"><label>Nieuw wachtwoord</label><input type="password" id="ww-nieuw"><p class="mini" style="margin:4px 0 0">Minstens 8 tekens.</p></div>'+
  '<div class="field"><label>Bevestig nieuw wachtwoord</label><input type="password" id="ww-bevestig"></div>'+
  '<p class="mini" id="ww-fout" style="color:var(--brick)" hidden></p>'+
  '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Wachtwoord wijzigen</button></div>');
 el('modal-annuleer').addEventListener('click',closeModal);
 el('modal-opslaan').addEventListener('click',function(){
  var huidig=el('ww-huidig').value,nieuw=el('ww-nieuw').value,bevestig=el('ww-bevestig').value,fout='';
  if(!huidig)fout='Vul je huidige wachtwoord in.';
  else if(nieuw.length<8)fout='Nieuw wachtwoord moet minstens 8 tekens zijn.';
  else if(nieuw!==bevestig)fout='De wachtwoorden komen niet overeen.';
  else if(nieuw===huidig)fout='Kies een ander wachtwoord dan je huidige.';
  el('ww-fout').textContent=fout;el('ww-fout').hidden=!fout;
  if(fout)return;
  /* Een wachtwoordwijziging is een beveiligingsgebeurtenis en hoort aantoonbaar
     in het logboek (AVG art. 5 lid 2 en art. 32). Het wachtwoord zelf niet. */
  logActie('Wachtwoord gewijzigd');
  openModal('<h3>Wachtwoord wijzigen</h3><div class="msec"><p>Je wachtwoord is gewijzigd.</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
  el('modal-snap').addEventListener('click',closeModal);
 });
}
function renderLoginScherm(){
 caZetIngelogd(false);
 var html='<div style="padding:30px 10px;text-align:center">';
 html+='<h2 style="margin:0 0 4px">Welkom!</h2>';
 html+='<p class="mini" style="margin:0 0 20px">Log in om verder te gaan.</p>';
 html+='<div class="field" style="text-align:left"><label>E-mailadres</label><input id="login-mail" placeholder="naam@voorbeeld.nl" value="'+esc(MIJN_PROFIEL.mail||'')+'"></div>';
 html+='<div class="field" style="text-align:left"><label>Wachtwoord</label><input type="password" id="login-ww" placeholder="Wachtwoord"></div>';
 html+='<div class="togglerow" style="border:0;padding:6px 0"><span>Ingelogd blijven</span><label class="toggle"><input type="checkbox" id="login-blijven" checked><span class="track"></span><span class="knob"></span></label></div>';
 html+='<button type="button" class="ghost small" style="width:100%;margin:6px 0 14px" id="login-vergeten">Wachtwoord vergeten?</button>';
 html+='<p class="mini" id="login-fout" style="color:var(--brick)" hidden>Vul je e-mailadres en wachtwoord in.</p>';
 html+='<button type="button" class="primary" style="width:100%" id="login-inloggen">Inloggen</button>';
 html+='</div>';
 el('ca-body').innerHTML=html;
 el('login-vergeten').addEventListener('click',function(){
  openModal('<h3>Wachtwoord vergeten</h3><div class="msec"><p>Niet uitgewerkt in dit prototype.</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
  el('modal-snap').addEventListener('click',closeModal);
 });
 el('login-inloggen').addEventListener('click',function(){
  var ok=el('login-mail').value.trim()&&el('login-ww').value;
  el('login-fout').hidden=!!ok;
  if(!ok)return;
  if(MIJN_PROFIEL.tweestaps){renderLogin2fa();return;}
  caZetIngelogd(true);renderCaInfo();
 });
}
function renderLogin2fa(){
 var html='<div style="padding:30px 10px;text-align:center">';
 html+='<h2 style="margin:0 0 4px">Welkom!</h2>';
 html+='<p class="mini" style="margin:0 0 20px">Vul de beveiligingscode in van je authenticator-app.</p>';
 html+='<div class="field"><input id="login-2fa-code" maxlength="6" placeholder="6 cijfers" style="text-align:center;letter-spacing:.3em;font-size:20px"></div>';
 html+='<p class="mini" id="login-2fa-fout" style="color:var(--brick)" hidden>Vul een geldige 6-cijferige code in.</p>';
 html+='<button type="button" class="primary" style="width:100%;margin-top:10px" id="login-2fa-controleren">Controleren en inloggen</button>';
 html+='<p class="mini" style="margin-top:16px">Geen toegang tot je beveiligingscode? Neem contact op met je beheerder of support.</p>';
 html+='</div>';
 el('ca-body').innerHTML=html;
 el('login-2fa-controleren').addEventListener('click',function(){
  var code=el('login-2fa-code').value.trim(),ok=/^\d{6}$/.test(code);
  el('login-2fa-fout').hidden=ok;
  if(ok){caZetIngelogd(true);renderCaInfo();}
 });
}

/* --- Doelen --- */
/* Een leesbaar tijdstempel in dezelfde vorm als de bestaande rapportages:
   dd-mm-jjjj uu:mm. Zonder datum wordt het moment van schrijven gebruikt. */
function rapportageTijd(datumIso){
 var nu=new Date();
 var d=geldigeDatum(datumIso)?new Date(datumIso+'T00:00:00'):nu;
 return tweeCijfers(d.getDate())+'-'+tweeCijfers(d.getMonth()+1)+'-'+d.getFullYear()+' '+
  tweeCijfers(nu.getHours())+':'+tweeCijfers(nu.getMinutes());
}
var caDoelenView='doelen';
/* --- Media viewer (gedeeld) --- */
var PLAY_SVG='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#fff"/></svg>';
function mediaThumbHtml(type,gradient,caption){
 var capAttr=esc(caption||'');
 if(type==='video')return '<div class="mediathumb video" data-mediatype="video" data-caption="'+capAttr+'"><div class="playbtn">'+PLAY_SVG+'</div></div>';
 return '<div class="mediathumb" data-mediatype="foto" data-gradient="'+esc(gradient)+'" data-caption="'+capAttr+'" style="background:'+esc(gradient)+'">Foto</div>';
}
function audioBarHtml(caption){
 var capAttr=esc(caption||'');
 return '<div class="audiobar" data-audiobar="1" data-caption="'+capAttr+'"><span class="playbtn-sm">'+PLAY_SVG+'</span><span class="waveform">▂▄▆▃▅▇▂▄▆▃▄▇▂</span><span class="adur">0:14</span></div>';
}
function openMediaViewer(type,gradient,caption){
 var big=type==='video'
  ?'<div class="mediathumb-lg video" style="aspect-ratio:16/9"><div class="playbtn" style="width:60px;height:60px">'+PLAY_SVG.replace('viewBox','style="width:22px;height:22px" viewBox')+'</div></div>'
  :'<div class="mediathumb-lg" style="background:'+gradient+'"></div>';
 openModal('<h3>'+(type==='video'?'Video':'Foto')+'</h3>'+big+(caption?'<p class="mini" style="margin-top:10px">'+esc(caption)+'</p>':'')+'<div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
 el('modal-snap').addEventListener('click',closeModal);
}
function wireMediaThumbs(container){
 Array.prototype.forEach.call(container.querySelectorAll('[data-mediatype]'),function(elm){
  elm.addEventListener('click',function(){
   openMediaViewer(elm.getAttribute('data-mediatype'),elm.getAttribute('data-gradient')||'linear-gradient(135deg,#4A6FA5,#5A8A6E)',elm.getAttribute('data-caption'));
  });
 });
 Array.prototype.forEach.call(container.querySelectorAll('.mcell'),function(cell){
  if(cell.dataset.wired)return;cell.dataset.wired='1';
  cell.addEventListener('click',function(){openMediaViewer('foto',cell.style.background,'Gedeeld in dit gesprek');});
 });
 Array.prototype.forEach.call(container.querySelectorAll('[data-audiobar]'),function(elm){
  elm.addEventListener('click',function(){
   openModal('<h3>Spraakbericht</h3><div class="msec" style="text-align:center"><p>🎧 Spraakbericht wordt afgespeeld…</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
   el('modal-snap').addEventListener('click',closeModal);
  });
 });
}
function emojiRowHtml(attrName,attrValuePrefix,item){
 /* Gegevens uit de database hebben niet altijd een reacties-object; zonder
    deze regel liep het hele scherm vast. */
 if(!item.reacties||typeof item.reacties!=='object')item.reacties={};
 var mijn=mijnReactieOp(item);
 return '<div class="emojirow">'+EMOJIS.map(function(e){
  var selected=mijn===e;
  var disabled=mijn&&!selected;
  var n=aantalReacties(item,e);
  return '<button type="button" class="'+(selected?'selected ':'')+(disabled?'disabled':'')+'" '+attrName+'="'+esc(attrValuePrefix)+'|'+e+'">'+e+(n?'<span class="ecount">'+n+'</span>':'')+'</button>';
 }).join('')+'</div>';
}
/* Een reactie is van een persoon. "mijnReactie" stond in het gedeelde dossier:
   reageerde Anna, dan zag Bram dat als zijn eigen reactie en kon niemand anders
   nog kiezen; en reageerden twee mensen tegelijk, dan viel er een weg
   (aangetoond met reacties-twee.js). Nu per persoon in reactiesVan. Oude
   tellingen (reacties) blijven meetellen, maar zijn van niemand in het
   bijzonder. */
function reactieSleutel(){
 if(isSupport)return 'support';
 if(isSysteembeheerder)return 'systeembeheer';
 return huidigeGebruikerId?'p'+huidigeGebruikerId:'onbekend';
}
function mijnReactieOp(item){return (item.reactiesVan&&item.reactiesVan[reactieSleutel()])||null;}
function aantalReacties(item,e){
 var n=veiligeTeller((item.reacties||{})[e]);
 Object.keys(item.reactiesVan||{}).forEach(function(k){if(item.reactiesVan[k]===e)n++;});
 return n;
}
function toggleReactie(item,emoji){
 bewaarStraks('reactie-'+caClientId,function(){bewaarClientData(caClientId);});
 var ik=reactieSleutel(),mijn=mijnReactieOp(item);
 item.reactiesVan=item.reactiesVan&&typeof item.reactiesVan==='object'?item.reactiesVan:{};
 if(mijn===emoji)delete item.reactiesVan[ik];
 else if(!mijn)item.reactiesVan[ik]=emoji;
}
/* Id's van doelen, rapportages, agenda, Ik-Boek, geheugen en chat staan in het
   JSON-dossier: de database dwingt daar geen getal af. Een id met een
   aanhalingsteken brak uit het data-attribuut en voerde code uit (XSS,
   aangetoond), dus ook id's gaan door esc(). */
function rapportCardHtml(doel,r){
 return '<div class="rapport"><div class="rmeta"><span>'+esc(r.auteur)+' · '+esc(r.tijd)+(r.dienst?' · '+esc(r.dienst):'')+'</span><span style="display:flex;gap:4px">'+
  '<button type="button" class="iconbtn tiny" data-editrapport="'+esc(doel.id+'|'+r.id)+'" aria-label="Bewerken">'+PENCIL_SVG+'</button>'+
  '<button type="button" class="iconbtn tiny danger" data-delrapport="'+esc(doel.id+'|'+r.id)+'" aria-label="Verwijderen">'+TRASH_SVG+'</button>'+
 '</span></div>'+esc(r.tekst)+
  (r.media?mediaThumbHtml('foto','linear-gradient(135deg,#3E7CA6,#8C6A45)',doel.titel+' — '+r.tijd):'')+
  (r.audio?audioBarHtml(doel.titel+' — '+r.tijd):'')+
  emojiRowHtml('data-react',doel.id+'|'+r.id,r)+
 '</div>';
}
function renderCaDoelen(){
 var d=ensureClientData(caClientId);
 var html='<div class="minitabs"><button type="button" class="'+(caDoelenView==='doelen'?'on':'')+'" data-doelenview="doelen">Per doel</button><button type="button" class="'+(caDoelenView==='inbox'?'on':'')+'" data-doelenview="inbox">Inbox</button></div>';
 if(caDoelenView==='inbox'){
  var alle=[];
  d.doelen.forEach(function(doel){doel.rapportages.forEach(function(r){alle.push({doel:doel,r:r});});});
  alle.sort(function(a,b){return b.r.id-a.r.id;});
  html+=alle.length? alle.map(function(x){
   return '<div class="inboxcard"><div class="idoel">'+esc(x.doel.titel)+'</div>'+rapportCardHtml(x.doel,x.r)+'</div>';
  }).join('') : '<p class="empty-msg">Nog geen rapportages over alle doelen heen.</p>';
 }else{
  html+=d.doelen.map(function(doel){
   return '<div class="doelcard"><div class="dtop"><b>'+esc(doel.titel)+'</b><div style="display:flex;gap:6px;align-items:center">'+
    '<button type="button" class="iconbtn tiny" data-editdoel="'+esc(doel.id)+'" aria-label="Doel hernoemen">'+PENCIL_SVG+'</button>'+
    '<button type="button" class="iconbtn tiny danger" data-deldoel="'+esc(doel.id)+'" aria-label="Doel verwijderen">'+TRASH_SVG+'</button>'+
    '<button type="button" class="small" data-newrapport="'+esc(doel.id)+'">+ Rapportage</button></div></div>'+
    (doel.rapportages.length? doel.rapportages.slice().reverse().map(function(r){return rapportCardHtml(doel,r);}).join('') : '<p class="empty-msg" style="padding-top:6px">Nog geen rapportages.</p>')+
    '<div id="newrapport-'+esc(doel.id)+'"></div>'+
   '</div>';
  }).join('');
  html+='<button type="button" class="addbtn-row" id="ca-nieuw-doel">+ Nieuw doel</button>';
 }
 el('ca-body').innerHTML=html;
 wireMediaThumbs(el('ca-body'));
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-doelenview]'),function(b){
  b.addEventListener('click',function(){caDoelenView=b.getAttribute('data-doelenview');renderCaDoelen();});
 });
 var nieuwDoelBtn=el('ca-nieuw-doel');
 if(nieuwDoelBtn)nieuwDoelBtn.addEventListener('click',function(){
  openModal('<h3>Nieuw doel</h3>'+
   '<div class="field"><label>Titel</label><input id="modal-doel-titel" maxlength="80" placeholder="Bijv. Zelfstandig aankleden"></div>'+
   '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Toevoegen</button></div>');
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-opslaan').addEventListener('click',function(){
   var titel=kap(el('modal-doel-titel').value.trim(),MAXLEN.titel);if(!titel){el('modal-doel-titel').style.borderColor='var(--brick)';return;}
   d.doelen.push({id:nieuwNummer(),titel:titel,rapportages:[]});bewaarClientData(caClientId);closeModal();renderCaDoelen();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-newrapport]'),function(b){
  b.addEventListener('click',function(){
   var doelId=+b.getAttribute('data-newrapport');
   var vandaag=new Date().toISOString().slice(0,10);
   el('newrapport-'+doelId).innerHTML='<div class="rapport">'+
    '<div class="row" style="margin-bottom:8px"><div class="field"><label style="font-size:11.5px">Dienst</label><select id="rapport-dienst-'+doelId+'"><option value="">Kies dienst…</option><option>Ochtenddienst</option><option>Middagdienst</option><option>Avonddienst</option></select></div>'+
    '<div class="field"><label style="font-size:11.5px">Datum</label><input type="date" id="rapport-datum-'+doelId+'" value="'+vandaag+'"></div></div>'+
    '<textarea id="rapport-tekst-'+doelId+'" placeholder="Wat is er gebeurd?" style="width:100%;min-height:60px;border:1px solid var(--line-strong);border-radius:8px;padding:8px;font:inherit;font-size:13px"></textarea>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-top:6px"><input type="checkbox" id="rapport-media-'+doelId+'" style="width:auto">Foto toevoegen</label>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-top:4px"><input type="checkbox" id="rapport-audio-'+doelId+'" style="width:auto">🎤 Spraakbericht toevoegen</label>'+
    '<div class="field" style="margin-top:6px"><label style="font-size:11.5px">Bijlagen</label><button type="button" class="small" style="width:100%" id="rapport-bijlage-'+doelId+'">+ Bestanden toevoegen</button></div>'+
    '<div class="actions end" style="border:0;padding-top:8px;margin-top:6px"><button type="button" class="primary small" data-opslaanrapport="'+doelId+'">Plaatsen</button></div></div>';
   el('rapport-bijlage-'+doelId).addEventListener('click',function(){
    openModal('<h3>Bestanden toevoegen</h3><div class="msec"><p>Niet uitgewerkt in dit prototype.</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
    el('modal-snap').addEventListener('click',closeModal);
   });
   document.querySelector('[data-opslaanrapport="'+doelId+'"]').addEventListener('click',function(){
    var tekst=el('rapport-tekst-'+doelId).value.trim();if(!tekst)return;
    var media=el('rapport-media-'+doelId).checked;
    var audio=el('rapport-audio-'+doelId).checked;
    var dienst=el('rapport-dienst-'+doelId).value;
    var datum=el('rapport-datum-'+doelId).value;
    var doel=d.doelen.filter(function(x){return x.id===doelId;})[0];
    /* Een rapportage in een zorgdossier moet laten zien wie hem schreef en
       wanneer. 'Jij' en 'vandaag' zeggen een week later niets meer, en in het
       inzagedossier (art. 15) stond er dan geen auteur bij. */
    doel.rapportages.push({id:nieuwNummer(),tekst:tekst,tijd:rapportageTijd(datum),dienst:dienst,datum:datum,auteur:wieBenIk(),media:media,audio:audio,reacties:{}});bewaarClientData(caClientId);
    nieuweMelding(caClientId,'nieuweRapportage',wieBenIk()+' schreef een rapportage bij “'+doel.titel+'”');
    renderCaDoelen();
   });
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-react]'),function(b){
  b.addEventListener('click',function(){
   if(b.classList.contains('disabled'))return;
   var parts=b.getAttribute('data-react').split('|'),doelId=+parts[0],rapId=+parts[1],emoji=parts[2];
   var doel=d.doelen.filter(function(x){return x.id===doelId;})[0],r=doel.rapportages.filter(function(x){return x.id===rapId;})[0];
   toggleReactie(r,emoji);renderCaDoelen();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-editdoel]'),function(b){
  b.addEventListener('click',function(){
   var doel=d.doelen.filter(function(x){return x.id===+b.getAttribute('data-editdoel');})[0];
   openModal('<h3>Doel hernoemen</h3><div class="field"><label>Titel</label><input id="modal-doel-titel" maxlength="80" value="'+esc(doel.titel)+'"></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-opslaan').addEventListener('click',function(){
    var titel=kap(el('modal-doel-titel').value.trim(),MAXLEN.titel);if(!titel){el('modal-doel-titel').style.borderColor='var(--brick)';return;}
    doel.titel=titel;bewaarClientData(caClientId);closeModal();renderCaDoelen();
   });
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-deldoel]'),function(b){
  b.addEventListener('click',function(){
   var doelId=+b.getAttribute('data-deldoel');
   openModal('<h3>Doel verwijderen</h3><div class="msec"><p>Weet je zeker dat je dit doel en alle rapportages daaronder wilt verwijderen? Dit kan niet ongedaan gemaakt worden.</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-bevestig').addEventListener('click',function(){
    d.doelen=d.doelen.filter(function(x){return x.id!==doelId;});bewaarClientData(caClientId);
    closeModal();renderCaDoelen();
   });
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-editrapport]'),function(b){
  b.addEventListener('click',function(){
   var parts=b.getAttribute('data-editrapport').split('|'),doelId=+parts[0],rapId=+parts[1];
   var doel=d.doelen.filter(function(x){return x.id===doelId;})[0],r=doel.rapportages.filter(function(x){return x.id===rapId;})[0];
   openModal('<h3>Rapportage bewerken</h3><div class="field"><label>Tekst</label><textarea id="modal-rap-tekst" style="width:100%;min-height:70px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font:inherit;font-size:14.5px">'+esc(r.tekst)+'</textarea></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-opslaan').addEventListener('click',function(){
    var tekst=el('modal-rap-tekst').value.trim();if(!tekst){el('modal-rap-tekst').style.borderColor='var(--brick)';return;}
    r.tekst=tekst;bewaarClientData(caClientId);closeModal();renderCaDoelen();
   });
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-delrapport]'),function(b){
  b.addEventListener('click',function(){
   var parts=b.getAttribute('data-delrapport').split('|'),doelId=+parts[0],rapId=+parts[1];
   openModal('<h3>Rapportage verwijderen</h3><div class="msec"><p>Weet je zeker dat je deze rapportage wilt verwijderen?</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-bevestig').addEventListener('click',function(){
    var doel=d.doelen.filter(function(x){return x.id===doelId;})[0];
    doel.rapportages=doel.rapportages.filter(function(x){return x.id!==rapId;});bewaarClientData(caClientId);
    closeModal();renderCaDoelen();
   });
  });
 });
}

/* --- Kalender helper (gedeeld door Agenda en Maaltijden) --- */
var MAANDNAMEN=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
var MAAND_AFK=['JAN','FEB','MRT','APR','MEI','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];
function monthGridHtml(year,month,markedDays,selectedDay,hideTitle){
 var first=new Date(year,month,1);
 var startWeekday=(first.getDay()+6)%7;
 var daysInMonth=new Date(year,month+1,0).getDate();
 var html=hideTitle?'':'<div class="calmonth">'+MAANDNAMEN[month]+' '+year+'</div>';
 html+='<div class="calgrid">';
 ['Ma','Di','Wo','Do','Vr','Za','Zo'].forEach(function(dn){html+='<div class="calhead">'+dn+'</div>';});
 for(var i=0;i<startWeekday;i++)html+='<div class="calcell empty"></div>';
 for(var day=1;day<=daysInMonth;day++){
  var marked=markedDays.indexOf(day)>-1;
  html+='<div class="calcell'+(day===selectedDay?' selected':'')+'" role="button" tabindex="0" aria-pressed="'+(day===selectedDay?'true':'false')+'" aria-label="'+day+' '+MAANDNAMEN[month]+(marked?', met afspraken':'')+'" data-calday="'+day+'">'+day+(marked?'<span class="dot" style="background:var(--accent)"></span>':'')+'</div>';
 }
 html+='</div>';
 return html;
}

/* --- Agenda --- */
var caAgendaView='lijst', caAgendaDag=null, caAgendaJaar=2026, caAgendaMaand=8, caAgendaLijstDag=12;
function parseDatumlabel(label){
 var m=/^(\d{1,2})\s+([A-Z]{3})$/.exec(label||'');
 if(!m)return null;
 var maandIdx=MAAND_AFK.indexOf(m[2]);
 if(maandIdx<0)return null;
 return {dag:+m[1],maand:maandIdx};
}
function wijzigMaand(delta){
 caAgendaMaand+=delta;
 if(caAgendaMaand<0){caAgendaMaand=11;caAgendaJaar--;}
 else if(caAgendaMaand>11){caAgendaMaand=0;caAgendaJaar++;}
 caAgendaDag=null;
 renderCaAgenda();
}
function wijzigLijstDag(delta){
 var daysInMonth=new Date(caAgendaJaar,caAgendaMaand+1,0).getDate();
 caAgendaLijstDag+=delta;
 if(caAgendaLijstDag<1){wijzigMaandVoorLijst(-1);caAgendaLijstDag=new Date(caAgendaJaar,caAgendaMaand+1,0).getDate();}
 else if(caAgendaLijstDag>daysInMonth){wijzigMaandVoorLijst(1);caAgendaLijstDag=1;}
 renderCaAgenda();
}
function wijzigMaandVoorLijst(delta){
 caAgendaMaand+=delta;
 if(caAgendaMaand<0){caAgendaMaand=11;caAgendaJaar--;}
 else if(caAgendaMaand>11){caAgendaMaand=0;caAgendaJaar++;}
}
var HERINNERING_OPTIES=[
 {value:'geen',label:'Geen herinnering'},
 {value:'0',label:'Op het moment zelf'},
 {value:'15',label:'15 minuten van tevoren'},
 {value:'30',label:'30 minuten van tevoren'},
 {value:'45',label:'45 minuten van tevoren'},
 {value:'60',label:'1 uur van tevoren (max)'}
];
var HERHALING_OPTIES=[
 {value:'geen',label:'Niet herhalen'},
 {value:'wekelijks',label:'Elke week herhalen'},
 {value:'maandelijks',label:'Maandelijks herhalen (op de 1e)'}
];
function herinneringLabel(v){var o=HERINNERING_OPTIES.filter(function(x){return x.value===v;})[0];return o?o.label:null;}
function herhalingLabel(v){var o=HERHALING_OPTIES.filter(function(x){return x.value===v;})[0];return o?o.label:null;}
function agendaCardHtml(a){
 var extra=[];
 if(a.herinnering&&a.herinnering!=='geen')extra.push('🔔 '+herinneringLabel(a.herinnering));
 if(a.herhaling&&a.herhaling!=='geen')extra.push('🔁 '+herhalingLabel(a.herhaling));
 if(a.locatie)extra.push('📍 '+esc(a.locatie));
 if(a.herinnerdAan&&a.herinnerdAan.length){
  var voornamen=a.herinnerdAan.map(function(id){var p=findPerson(id);return p?naam(p).split(' ')[0]:null;}).filter(Boolean);
  if(voornamen.length)extra.push('👤 '+esc(voornamen.join(', ')));
 }
 return '<div class="agendacard">'+
  '<input type="checkbox" data-klaar="'+esc(a.id)+'" '+(a.klaar?'checked':'')+' style="width:auto;flex:0 0 auto" aria-label="Klaar">'+
  '<div class="adate">'+esc(a.datumlabel)+'</div><div class="atxt"><b'+(a.klaar?' style="text-decoration:line-through;opacity:.55"':'')+'>'+esc(a.titel)+'</b><span>'+esc(a.tijd)+(a.media?' · met foto':'')+'</span>'+
  (a.locatie?'<div class="mapthumb" data-mediatype="foto" data-gradient="linear-gradient(135deg,#4A6FA5,#5A8A6E)" data-caption="'+esc(a.locatie)+'">🗺️ '+esc(a.locatie)+'</div>':'')+
  (extra.length?'<span style="display:block;margin-top:2px">'+extra.join(' · ')+'</span>':'')+'</div></div>';
}
/* De datum stond vast op 20 september. Zette je een afspraak op de dag die je
   bekeek, dan belandde hij ergens anders en leek toevoegen niet te werken. De
   dag die in beeld staat is het logische voorstel. */
function tweeCijfers(n){return (n<10?'0':'')+n;}
function caAgendaZichtbareDatum(){
 var dag=caAgendaView==='kalender'?(caAgendaDag||1):caAgendaLijstDag;
 var dagen=new Date(caAgendaJaar,caAgendaMaand+1,0).getDate();
 if(dag>dagen)dag=dagen;
 return caAgendaJaar+'-'+tweeCijfers(caAgendaMaand+1)+'-'+tweeCijfers(dag);
}
var PIJL_L='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M15 18l-6-6 6-6"/></svg>';
var PIJL_R='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 6l6 6-6 6"/></svg>';
function renderCaAgenda(){
 var d=ensureClientData(caClientId);
 var html='<div class="minitabs"><button type="button" class="'+(caAgendaView==='lijst'?'on':'')+'" data-agendaview="lijst">Lijst</button><button type="button" class="'+(caAgendaView==='kalender'?'on':'')+'" data-agendaview="kalender">Kalender</button></div>';
 if(caAgendaView==='kalender'){
  var markedDays=d.agenda.map(function(a){return parseDatumlabel(a.datumlabel);}).filter(function(p){return p&&p.maand===caAgendaMaand;}).map(function(p){return p.dag;});
  html+='<div class="monthnav"><button type="button" id="ca-maand-vorige" aria-label="Vorige maand">'+PIJL_L+'</button><b>'+MAANDNAMEN[caAgendaMaand]+' '+caAgendaJaar+'</b><button type="button" id="ca-maand-volgende" aria-label="Volgende maand">'+PIJL_R+'</button></div>';
  html+=monthGridHtml(caAgendaJaar,caAgendaMaand,markedDays,caAgendaDag,true);
  var dagItems=caAgendaDag? d.agenda.filter(function(a){var p=parseDatumlabel(a.datumlabel);return p&&p.maand===caAgendaMaand&&p.dag===caAgendaDag;}) : d.agenda.filter(function(a){var p=parseDatumlabel(a.datumlabel);return p&&p.maand===caAgendaMaand;});
  html+=dagItems.length? dagItems.map(agendaCardHtml).join('') : '<p class="empty-msg">Geen afspraken'+(caAgendaDag?' op deze dag.':' deze maand.')+'</p>';
  if(caAgendaDag)html+='<button type="button" class="ghost small" id="ca-agenda-alledagen">Toon hele maand</button>';
 }else{
  var daysInMonth=new Date(caAgendaJaar,caAgendaMaand+1,0).getDate();
  if(caAgendaLijstDag>daysInMonth)caAgendaLijstDag=daysInMonth;
  html+='<div class="daynav"><button type="button" id="ca-dag-vorige" aria-label="Vorige dag">'+PIJL_L+'</button><b>'+caAgendaLijstDag+' '+MAANDNAMEN[caAgendaMaand]+' '+caAgendaJaar+'</b><button type="button" id="ca-dag-volgende" aria-label="Volgende dag">'+PIJL_R+'</button></div>';
  var lijstItems=d.agenda.filter(function(a){var p=parseDatumlabel(a.datumlabel);return p&&p.maand===caAgendaMaand&&p.dag===caAgendaLijstDag;});
  html+=lijstItems.length? lijstItems.map(agendaCardHtml).join('') : '<p class="empty-msg">Geen afspraken op deze dag.</p>';
 }
 html+='<button type="button" class="addbtn-row" id="ca-nieuwe-afspraak">+ Afspraak toevoegen</button>';
 el('ca-body').innerHTML=html;
 wireMediaThumbs(el('ca-body'));
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-klaar]'),function(c){
  c.addEventListener('click',function(e){
   e.stopPropagation();
   var a=d.agenda.filter(function(x){return x.id===+c.getAttribute('data-klaar');})[0];
   a.klaar=c.checked;bewaarClientData(caClientId);renderCaAgenda();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-agendaview]'),function(b){
  b.addEventListener('click',function(){caAgendaView=b.getAttribute('data-agendaview');caAgendaDag=null;renderCaAgenda();});
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-calday]'),function(c){
  var kies=function(){caAgendaDag=+c.getAttribute('data-calday');renderCaAgenda();};
  c.addEventListener('click',kies);
  c.addEventListener('keydown',function(e){if(e.key===' '||e.key==='Enter'){e.preventDefault();kies();}});
 });
 var alledagenBtn=el('ca-agenda-alledagen');
 if(alledagenBtn)alledagenBtn.addEventListener('click',function(){caAgendaDag=null;renderCaAgenda();});
 var maandVorigeBtn=el('ca-maand-vorige'),maandVolgendeBtn=el('ca-maand-volgende');
 if(maandVorigeBtn)maandVorigeBtn.addEventListener('click',function(){wijzigMaand(-1);});
 if(maandVolgendeBtn)maandVolgendeBtn.addEventListener('click',function(){wijzigMaand(1);});
 var dagVorigeBtn=el('ca-dag-vorige'),dagVolgendeBtn=el('ca-dag-volgende');
 if(dagVorigeBtn)dagVorigeBtn.addEventListener('click',function(){wijzigLijstDag(-1);});
 if(dagVolgendeBtn)dagVolgendeBtn.addEventListener('click',function(){wijzigLijstDag(1);});
 el('ca-nieuwe-afspraak').addEventListener('click',function(){
  var uurOpties='',minOpties='';
  for(var u=0;u<24;u++)uurOpties+='<option'+(u===14?' selected':'')+'>'+(u<10?'0'+u:u)+'</option>';
  for(var mi=0;mi<60;mi++)minOpties+='<option'+(mi===0?' selected':'')+'>'+(mi<10?'0'+mi:mi)+'</option>';
  var herinneringOpties=HERINNERING_OPTIES.map(function(o){return '<option value="'+o.value+'">'+o.label+'</option>';}).join('');
  var herhalingOpties=HERHALING_OPTIES.map(function(o){return '<option value="'+o.value+'">'+o.label+'</option>';}).join('');
  /* Een herinnering naar iemand die geblokkeerd is of van wie de toegang is
     verlopen komt nergens aan en deelt de afspraak van de cliënt met iemand
     die er niet meer bij hoort. */
  var betrokkenen=people.filter(function(x){return (x.type==='medewerker'||x.type==='naaste')&&x.groepen.indexOf(huidigeGroep)>-1&&rolOpClient(x,caClientId)&&x._state!=='verwijderd'&&heeftToegang(x);});
  var herinnerChecklist=betrokkenen.map(function(p){return '<label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px">'+avatarHtmlSized(naam(p),26)+'<input type="checkbox" value="'+p.id+'" class="afspr-herinner" style="width:auto">'+esc(naam(p))+'</label>';}).join('');
  openModal('<h3>Afspraak toevoegen</h3>'+
   '<div class="field"><label>Titel</label><input id="modal-afspr-titel" maxlength="80" placeholder="Bijv. Fysiotherapie"></div>'+
   '<div class="row"><div class="field"><label>Datum</label><input type="date" id="modal-afspr-datum" value="'+caAgendaZichtbareDatum()+'"></div>'+
   '<div class="field"><label>Tijd</label><div class="timerow"><select id="modal-afspr-uur">'+uurOpties+'</select><span>:</span><select id="modal-afspr-min">'+minOpties+'</select></div></div></div>'+
   '<div class="field"><label>Locatie</label><input id="modal-afspr-locatie" maxlength="80" placeholder="Bijv. Buurtcentrum"></div>'+
   '<div class="field"><label>Herinnering</label><select id="modal-afspr-herinnering">'+herinneringOpties+'</select></div>'+
   '<div class="field"><label>Herhalen</label><select id="modal-afspr-herhaling">'+herhalingOpties+'</select></div>'+
   (betrokkenen.length?'<div class="field"><label>Wie krijgt de herinnering</label>'+herinnerChecklist+'</div>':'')+
   '<label style="display:flex;align-items:center;gap:6px;font-size:13px;margin:12px 0 6px"><input type="checkbox" id="modal-afspr-media" style="width:auto">Foto toevoegen</label>'+
   '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Toevoegen</button></div>');
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-opslaan').addEventListener('click',function(){
   var titel=kap(el('modal-afspr-titel').value.trim(),MAXLEN.titel);if(!titel){el('modal-afspr-titel').style.borderColor='var(--brick)';return;}
   /* Zonder datum kwam de afspraak op '—' te staan en was hij daarna nergens
      meer te vinden: de kalender en de lijst filteren allebei op datum. */
   var datumval=el('modal-afspr-datum').value;
   if(!datumval){el('modal-afspr-datum').style.borderColor='var(--brick)';return;}
   var dt=new Date(datumval+'T00:00:00');
   if(isNaN(dt.getTime())){el('modal-afspr-datum').style.borderColor='var(--brick)';return;}
   var datumlabel=dt.getDate()+' '+MAAND_AFK[dt.getMonth()];
   var tijd=el('modal-afspr-uur').value+':'+el('modal-afspr-min').value;
   var herinnerdAan=Array.from(document.querySelectorAll('.afspr-herinner:checked')).map(function(c){return +c.value;});
   d.agenda.push({id:nieuwNummer(),titel:titel,datumlabel:datumlabel,tijd:tijd,media:el('modal-afspr-media').checked,
    locatie:el('modal-afspr-locatie').value.trim(),herinnerdAan:herinnerdAan,klaar:false,
    herinnering:el('modal-afspr-herinnering').value,herhaling:el('modal-afspr-herhaling').value});
   bewaarClientData(caClientId);
   /* Spring naar de dag van de afspraak, anders voeg je iets toe dat je
      daarna niet ziet staan. */
   nieuweMelding(caClientId,'agendaHerinnering',titel+' staat gepland op '+datumlabel+' om '+tijd);
   caAgendaJaar=dt.getFullYear();caAgendaMaand=dt.getMonth();
   caAgendaLijstDag=dt.getDate();
   if(caAgendaView==='kalender'&&caAgendaDag)caAgendaDag=dt.getDate();
   closeModal();renderCaAgenda();
  });
 });
}

/* --- Ik-Boek --- */
function renderCaIkboek(){
 var d=ensureClientData(caClientId);
 var html=d.ikboek.length? d.ikboek.slice().reverse().map(function(e){
  return '<div class="ikboekcard"><div class="imeta"><span>'+esc(e.tijd)+'</span><span style="display:flex;gap:4px">'+
   (caClientweergave?'':'<button type="button" class="iconbtn tiny" data-editikboek="'+esc(e.id)+'" aria-label="Bewerken">'+PENCIL_SVG+'</button>'+
   '<button type="button" class="iconbtn tiny danger" data-delikboek="'+esc(e.id)+'" aria-label="Verwijderen">'+TRASH_SVG+'</button>')+
  '</span></div>'+esc(e.tekst)+
   (e.mediaType?mediaThumbHtml(e.mediaType,'linear-gradient(135deg,#4A6FA5,#5A8A6E)','Ik-Boek — '+e.tijd):'')+
   emojiRowHtml('data-ikreact',e.id,e)+
  '</div>';
 }).join('') : '<p class="empty-msg">Nog geen paginas in het Ik-Boek.</p>';
 html+='<button type="button" class="addbtn-row" id="ca-nieuwe-ikboek">+ Nieuwe pagina</button>';
 el('ca-body').innerHTML=html;
 wireMediaThumbs(el('ca-body'));
 el('ca-nieuwe-ikboek').addEventListener('click',function(){
  openModal('<h3>Nieuwe Ik-Boek pagina</h3>'+
   '<div class="field"><label>Wat wil je vastleggen?</label><textarea id="modal-ikboek-tekst" style="width:100%;min-height:70px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font:inherit;font-size:14.5px"></textarea></div>'+
   '<div class="field"><label>Media</label><select id="modal-ikboek-mediatype"><option value="">Geen</option><option value="foto">Foto</option><option value="video">Video</option></select></div>'+
   '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Plaatsen</button></div>');
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-opslaan').addEventListener('click',function(){
   var tekst=el('modal-ikboek-tekst').value.trim();if(!tekst){el('modal-ikboek-tekst').style.borderColor='var(--brick)';return;}
   d.ikboek.push({id:nieuwNummer(),tekst:tekst,tijd:rapportageTijd(''),auteur:wieBenIk(),mediaType:el('modal-ikboek-mediatype').value,reacties:{}});bewaarClientData(caClientId);
   closeModal();renderCaIkboek();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-ikreact]'),function(b){
  b.addEventListener('click',function(){
   if(b.classList.contains('disabled'))return;
   var parts=b.getAttribute('data-ikreact').split('|'),id=+parts[0],emoji=parts[1];
   var e=d.ikboek.filter(function(x){return x.id===id;})[0];
   toggleReactie(e,emoji);renderCaIkboek();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-editikboek]'),function(b){
  b.addEventListener('click',function(){
   var e=d.ikboek.filter(function(x){return x.id===+b.getAttribute('data-editikboek');})[0];
   openModal('<h3>Pagina bewerken</h3><div class="field"><label>Wat wil je vastleggen?</label><textarea id="modal-ikb-tekst" style="width:100%;min-height:70px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font:inherit;font-size:14.5px">'+esc(e.tekst)+'</textarea></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-opslaan').addEventListener('click',function(){
    var tekst=el('modal-ikb-tekst').value.trim();if(!tekst){el('modal-ikb-tekst').style.borderColor='var(--brick)';return;}
    e.tekst=tekst;bewaarClientData(caClientId);closeModal();renderCaIkboek();
   });
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-delikboek]'),function(b){
  b.addEventListener('click',function(){
   var id=+b.getAttribute('data-delikboek');
   openModal('<h3>Pagina verwijderen</h3><div class="msec"><p>Weet je zeker dat je deze pagina wilt verwijderen?</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-bevestig').addEventListener('click',function(){
    d.ikboek=d.ikboek.filter(function(x){return x.id!==id;});bewaarClientData(caClientId);
    closeModal();renderCaIkboek();
   });
  });
 });
}

/* --- Chat --- */
var CHATSTORE={};
/* De sleutel van een 1-op-1 gesprek bevatte alleen het medewerker-id, waardoor
   hetzelfde gesprek bij elke cliënt van die medewerker verscheen — berichten over
   de ene cliënt waren zo zichtbaar bij de andere. De cliënt hoort in de sleutel. */
function chatSleutel1op1(clientId,persoonId){return '1on1-'+clientId+'-'+persoonId;}
function chatThreadsForClient(clientId){
 var p=findPerson(clientId);
 /* Er werd een gesprek aangeboden met iedereen die een rol had, ook als die
    persoon geblokkeerd is of zijn toegang is verlopen. Een nieuw gesprek met
    zo iemand beginnen hoort niet te kunnen; een bestaand gesprek blijft wel
    staan, want dat is vastgelegde communicatie. */
 var betrokkenen=people.filter(function(x){return (x.type==='medewerker'||x.type==='naaste')&&x.groepen.indexOf(huidigeGroep)>-1&&rolOpClient(x,clientId);});
 var actief=betrokkenen.filter(function(x){return x._state!=='verwijderd'&&heeftToegang(x);});
 var threads=[{key:'group-'+clientId,naam:'Team '+naam(p),groep:true,defaultLeden:actief}];
 betrokkenen.filter(function(b){
  if(b.type!=='medewerker')return false;
  if(b._state!=='verwijderd'&&heeftToegang(b))return true;
  /* Wel tonen als er al berichten zijn, anders weglaten. */
  var bestaand=CHATSTORE[chatSleutel1op1(clientId,b.id)];
  return !!(bestaand&&bestaand.berichten&&bestaand.berichten.length);
 }).forEach(function(m){threads.push({key:chatSleutel1op1(clientId,m.id),naam:naam(m),groep:false,persoon:m,inactief:!(m._state!=='verwijderd'&&heeftToegang(m))});});
 var d=ensureClientData(clientId);
 (d.customChats||[]).forEach(function(c){
  if(threads.some(function(th){return th.key===c.key;}))return;
  if(c.groep){
   threads.push({key:c.key,naam:c.naam,groep:true,defaultLeden:c.leden.map(findPerson).filter(Boolean),leeg:true});
  }else{
   var persoon=findPerson(c.persoonId);
   if(persoon)threads.push({key:c.key,naam:naam(persoon),groep:false,persoon:persoon,leeg:true});
  }
 });
 return threads;
}
function ensureThread(key,naamThread,groep,defaultLeden,leeg){
 if(!CHATSTORE[key])CHATSTORE[key]=leeg?{
  naam:naamThread,
  leden:groep?defaultLeden.map(function(x){return x.id;}):null,
  _nextMsgId:1,
  berichten:[]
 }:{
  naam:naamThread,
  leden:groep?defaultLeden.map(function(x){return x.id;}):null,
  _nextMsgId:3,
  berichten:[
   {id:1,van:naamThread.split(' ')[0],tekst:'Hoi! Hoe gaat het vandaag?',tijd:'09:12'},
   {id:2,van:'Jij',tekst:'Goed, alles rustig verlopen vanmorgen.',tijd:'09:15'}
  ]
 };
 return CHATSTORE[key];
}
var caChatKey=null;
function renderCaChatList(){
 var threads=chatThreadsForClient(caClientId);
 var html=threads.map(function(t){
  var th=ensureThread(t.key,t.naam,t.groep,t.defaultLeden,t.leeg),last=th.berichten[th.berichten.length-1];
  return '<div class="chatlist-row" data-openchat="'+esc(t.key)+'">'+avatarHtmlSized(th.naam,38)+
   '<div class="ctxt"><b>'+esc(th.naam)+(t.groep?' ('+th.leden.length+')':'')+'</b><span>'+esc(t.inactief?'Kan nu niet inloggen — alleen teruglezen':(last?last.van+': '+last.tekst:'Nog geen berichten'))+'</span></div>'+
   /* De tijd komt uit de database en ging zonder esc() de pagina in (XSS,
      aangetoond); sinds het echte tijdstip toonde de lijst hem ook ruw. */
   '<span class="ctime">'+(last?esc(chatTijd(last.tijd)):'')+'</span></div>';
 }).join('');
 html+='<button type="button" class="addbtn-row" id="ca-nieuw-gesprek">+ Nieuw gesprek</button>';
 el('ca-body').innerHTML=html;
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-openchat]'),function(row){
  row.addEventListener('click',function(){caChatKey=row.getAttribute('data-openchat');renderCaChatThread();});
 });
 el('ca-nieuw-gesprek').addEventListener('click',function(){
  var betrokkenen=people.filter(function(x){return x.type==='medewerker'&&x.groepen.indexOf(huidigeGroep)>-1&&rolOpClient(x,caClientId)&&x._state!=='verwijderd'&&heeftToegang(x);});
  if(!betrokkenen.length){
   openModal('<h3>Nieuw gesprek</h3><div class="msec"><p>Geen medewerkers met toegang tot deze cliënt om een gesprek mee te starten.</p></div><div class="modal-actions"><button type="button" class="primary" id="modal-snap">Sluiten</button></div>');
   el('modal-snap').addEventListener('click',closeModal);
   return;
  }
  var persoonOpties=betrokkenen.map(function(p){return '<option value="'+p.id+'">'+esc(naam(p))+' — '+(p.type==='naaste'?'Naaste':'Medewerker')+'</option>';}).join('');
  var checklist=betrokkenen.map(function(p){return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.5px"><input type="checkbox" value="'+p.id+'" class="gesprek-lid" style="width:auto">'+esc(naam(p))+'</label>';}).join('');
  openModal('<h3>Nieuw gesprek</h3>'+
   '<div class="minitabs"><button type="button" class="on" data-gesprektype="persoon">Met één persoon</button><button type="button" data-gesprektype="groep">Nieuwe groep</button></div>'+
   '<div id="gesprek-persoon-veld"><div class="field"><label>Kies iemand</label><select id="modal-gesprek-persoon">'+persoonOpties+'</select></div></div>'+
   '<div id="gesprek-groep-veld" hidden><div class="field"><label>Groepsnaam</label><input id="modal-gesprek-naam" placeholder="Bijv. Ochtenddienst"></div><div class="field"><label>Leden</label>'+checklist+'</div></div>'+
   '<div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Starten</button></div>');
  var type='persoon';
  document.querySelectorAll('[data-gesprektype]').forEach(function(b){
   b.addEventListener('click',function(){
    type=b.getAttribute('data-gesprektype');
    document.querySelectorAll('[data-gesprektype]').forEach(function(x){x.classList.remove('on');});
    b.classList.add('on');
    el('gesprek-persoon-veld').hidden=type!=='persoon';
    el('gesprek-groep-veld').hidden=type!=='groep';
   });
  });
  el('modal-annuleer').addEventListener('click',closeModal);
  el('modal-opslaan').addEventListener('click',function(){
   var d=ensureClientData(caClientId);
   d.customChats=d.customChats||[];
   if(type==='persoon'){
    var pid=+el('modal-gesprek-persoon').value;
    var key=chatSleutel1op1(caClientId,pid);
    var bestaatAl=chatThreadsForClient(caClientId).some(function(th){return th.key===key;});
    if(!bestaatAl)d.customChats.push({key:key,groep:false,persoonId:pid});
    caChatKey=key;
   }else{
    var naamVal=el('modal-gesprek-naam').value.trim();if(!naamVal){el('modal-gesprek-naam').style.borderColor='var(--brick)';return;}
    var leden=Array.from(document.querySelectorAll('.gesprek-lid:checked')).map(function(c){return +c.value;});
    if(!leden.length)return;
    var key='groep-custom-'+caClientId+'-'+nieuwNummer();
    d.customChats.push({key:key,groep:true,naam:naamVal,leden:leden});
    caChatKey=key;
   }
   /* Een nieuw gesprek stond alleen in het geheugen: na een herlaad was het weg. */
   bewaarClientData(caClientId);
   closeModal();renderCaChatThread();
  });
 });
}
function renderCaChatThread(){
 var threads=chatThreadsForClient(caClientId),t=threads.filter(function(x){return x.key===caChatKey;})[0];
 if(!t){renderCaChatList();return;}
 var th=ensureThread(t.key,t.naam,t.groep,t.defaultLeden,t.leeg);
 var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
  '<button type="button" class="ghost small" id="ca-chat-terug">← Terug</button>'+
  '<b style="font-size:13.5px">'+esc(th.naam)+'</b>'+
  (t.groep?'<div style="display:flex;gap:6px"><button type="button" class="small" id="ca-chat-media">Media</button><button type="button" class="small" id="ca-chat-leden">Leden</button></div>':'<span></span>')+'</div>';
 html+='<div id="ca-chat-berichten">'+th.berichten.map(function(m){
  var mine=isMijnBericht(m);
  var acties=mine?'<span style="display:flex;gap:2px;align-items:center;margin-right:4px">'+
   '<button type="button" class="iconbtn tiny" data-editmsg="'+esc(m.id)+'" aria-label="Bewerken">'+PENCIL_SVG+'</button>'+
   '<button type="button" class="iconbtn tiny danger" data-delmsg="'+esc(m.id)+'" aria-label="Verwijderen">'+TRASH_SVG+'</button>'+
  '</span>':'';
  var tijd=chatTijd(m.tijd);
  return '<div class="msgrow'+(mine?' mine':'')+'">'+acties+'<div class="bubble">'+(!mine?'<b style="font-size:11px;display:block;opacity:.7">'+esc(m.van)+'</b>':'')+esc(m.tekst)+(m.bewerkt?' <span style="font-size:10px;opacity:.65">(bewerkt)</span>':'')+
   (tijd?'<span style="display:block;font-size:10px;opacity:.6;margin-top:2px">'+esc(tijd)+'</span>':'')+'</div></div>';
 }).join('')+'</div>';
 if(t.groep){
  var mediaPeriodes=[{label:'Deze maand',n:4},{label:'Vorige maand',n:3}];
  html+='<div id="ca-chat-media-grid" hidden>'+mediaPeriodes.map(function(mp,mi){
   return '<div class="sublistlabel" style="margin-top:'+(mi===0?'10px':'16px')+'">'+mp.label+'</div><div class="mediagrid">'+Array(mp.n).fill(0).map(function(_,i){return '<div class="mcell" style="background:'+AVCOLORS[(mi*4+i)%AVCOLORS.length]+'"></div>';}).join('')+'</div>';
  }).join('')+'</div>';
 }
 html+=t.inactief
  ?'<p class="empty-msg" style="margin-top:10px">'+esc(th.naam)+' kan op dit moment niet inloggen. Je kunt dit gesprek teruglezen, maar niets versturen.</p>'
  :'<div class="chatinputrow"><input id="ca-chat-input" placeholder="Typ een bericht…"><button type="button" class="primary" id="ca-chat-send">Stuur</button></div>';
 el('ca-body').innerHTML=html;
 wireMediaThumbs(el('ca-body'));
 el('ca-chat-terug').addEventListener('click',renderCaChatList);
 if(!t.inactief)el('ca-chat-send').addEventListener('click',function(){
  var v=el('ca-chat-input').value.trim();if(!v)return;
  var ik=huidigeGebruiker();
  th.berichten.push({id:nieuwBerichtId(),van:wieBenIk(),vanId:ik?ik.id:null,tekst:v,tijd:new Date().toISOString()});bewaarChatThread(caChatKey);
  nieuweMelding(caClientId,'nieuwBericht','Nieuw bericht in '+(th.naam||'een gesprek'));
  el('ca-chat-input').value='';renderCaChatThread();
 });
 if(t.groep){
  el('ca-chat-media').addEventListener('click',function(){el('ca-chat-media-grid').hidden=!el('ca-chat-media-grid').hidden;});
  el('ca-chat-leden').addEventListener('click',renderCaGroepBewerken);
 }
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-editmsg]'),function(b){
  b.addEventListener('click',function(){
   var m=th.berichten.filter(function(x){return String(x.id)===b.getAttribute('data-editmsg');})[0];
   openModal('<h3>Bericht bewerken</h3><div class="field"><label>Tekst</label><textarea id="modal-msg-tekst" style="width:100%;min-height:60px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font:inherit;font-size:14.5px">'+esc(m.tekst)+'</textarea></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="primary" id="modal-opslaan">Opslaan</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-opslaan').addEventListener('click',function(){
    var tekst=el('modal-msg-tekst').value.trim();if(!tekst){el('modal-msg-tekst').style.borderColor='var(--brick)';return;}
    m.tekst=tekst;m.bewerkt=true;m.bewerktOp=new Date().toISOString();bewaarChatThread(caChatKey);closeModal();renderCaChatThread();
   });
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-delmsg]'),function(b){
  b.addEventListener('click',function(){
   /* Overal elders wordt om bevestiging gevraagd; hier verdween een bericht op
      één tik, zonder weg terug. */
   var id=b.getAttribute('data-delmsg');
   openModal('<h3>Bericht verwijderen</h3><div class="msec"><p>Weet je zeker dat je dit bericht wilt verwijderen? Dit kan niet ongedaan gemaakt worden.</p></div><div class="modal-actions"><button type="button" id="modal-annuleer">Annuleren</button><button type="button" class="danger" id="modal-bevestig">Verwijderen</button></div>');
   el('modal-annuleer').addEventListener('click',closeModal);
   el('modal-bevestig').addEventListener('click',function(){
    var weg=th.berichten.filter(function(x){return String(x.id)===id;})[0];
    /* Onthouden dat dit bericht bewust weg is; anders zette het samenvoegen
       met de database het weer terug. */
    if(weg){th.verwijderd=(th.verwijderd||[]).concat(berichtSleutel(weg));}
    th.berichten=th.berichten.filter(function(x){return String(x.id)!==id;});bewaarChatThread(caChatKey);
    closeModal();renderCaChatThread();
   });
  });
 });
}

/* --- Chatgroep bewerken --- */
function renderCaGroepBewerken(){
 var th=CHATSTORE[caChatKey];if(!th)return;
 var alleBetrokkenen=people.filter(function(x){return (x.type==='medewerker'||x.type==='naaste')&&x.groepen.indexOf(huidigeGroep)>-1;});
 var leden=alleBetrokkenen.filter(function(x){return th.leden.indexOf(x.id)>-1;});
 /* Je kon iedereen uit de groep in een cliëntgesprek zetten, ook wie geen enkele
    rol op deze cliënt heeft of wiens account geblokkeerd of verlopen is. Daarmee
    lekt een heel gesprek over de cliënt naar iemand zonder grondslag. Toevoegen
    kan alleen wie hier al bij hoort; wie er al in zit blijft wel zichtbaar, zodat
    je hem eruit kunt halen. */
 function magInGesprek(x){return x._state!=='verwijderd'&&heeftToegang(x)&&!!rolOpClient(x,caClientId);}
 var nietleden=alleBetrokkenen.filter(function(x){return th.leden.indexOf(x.id)<0&&magInGesprek(x);});
 var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button type="button" class="ghost small" id="ca-groep-terug">← Terug</button><b style="font-size:15px">Chatgroep bewerken</b></div>';
 html+='<div class="field"><label>Groepsnaam</label><input id="ca-groep-naam" maxlength="60" value="'+esc(th.naam)+'"></div>';
 html+='<div class="sublistlabel" style="margin-top:14px">Leden ('+leden.length+')</div>';
 html+=leden.length? leden.map(function(l){
  return '<div class="chatlist-row">'+avatarHtmlSized(naam(l),34)+'<div class="ctxt"><b>'+esc(naam(l))+'</b><span>'+esc(l.type==='medewerker'?(l.rol||'Medewerker'):'Naaste')+(magInGesprek(l)?'':' · hoort hier niet meer bij')+'</span></div>'+
   '<button type="button" class="iconbtn danger" data-verwijderlid="'+l.id+'" aria-label="Verwijder">'+TRASH_SVG+'</button></div>';
 }).join('') : '<p class="empty-msg">Nog geen leden.</p>';
 html+='<div class="sublistlabel">Toevoegen</div>';
 html+=nietleden.length? nietleden.map(function(l){
  return '<div class="chatlist-row">'+avatarHtmlSized(naam(l),34)+'<div class="ctxt"><b>'+esc(naam(l))+'</b><span>'+esc(l.type==='medewerker'?(l.rol||'Medewerker'):'Naaste')+'</span></div>'+
   '<button type="button" class="small" data-toevoegenlid="'+l.id+'">+ Toevoegen</button></div>';
 }).join('') : '<p class="empty-msg">Er is niemand meer om toe te voegen: alleen wie een rol op deze cliënt heeft en kan inloggen, kan in dit gesprek.</p>';
 el('ca-body').innerHTML=html;
 el('ca-groep-terug').addEventListener('click',renderCaChatThread);
 /* Zonder bewaren was een hernoeming of een gewijzigd ledenlijstje na een
    herlaad weer weg. */
 el('ca-groep-naam').addEventListener('blur',function(){
  var nieuw=kap(this.value.trim(),MAXLEN.groep);
  if(!nieuw||nieuw===th.naam)return;
  th.naam=nieuw;bewaarChatThread(caChatKey);
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-verwijderlid]'),function(b){
  b.addEventListener('click',function(){
   var id=+b.getAttribute('data-verwijderlid');th.leden=th.leden.filter(function(x){return x!==id;});
   bewaarChatThread(caChatKey);renderCaGroepBewerken();
  });
 });
 Array.prototype.forEach.call(el('ca-body').querySelectorAll('[data-toevoegenlid]'),function(b){
  b.addEventListener('click',function(){
   th.leden.push(+b.getAttribute('data-toevoegenlid'));
   bewaarChatThread(caChatKey);renderCaGroepBewerken();
  });
 });
}

/* --- SOS --- */
var SOS_HOLD_MS=1400,SOS_CIRC=452,sosHoldTimer=null;
/* Een SOS ging naar de eerste drie mensen in de groep, ongeacht of ze iets met
   deze cliënt te maken hadden en ongeacht of hun account nog geldig was. Dat is
   operationeel verkeerd (je belt iemand die er niet over gaat) en het deelt de
   naam en de noodsituatie van de cliënt met iemand zonder grondslag. Alleen wie
   een rol op deze cliënt heeft en toegang heeft, wordt gewaarschuwd —
   contactpersonen eerst. */
function sosOntvangers(clientId){
 var lijst=people.filter(function(x){
  return (x.type==='medewerker'||x.type==='naaste')&&x.groepen.indexOf(huidigeGroep)>-1&&
   x._state!=='verwijderd'&&heeftToegang(x)&&rolOpClient(x,clientId);
 });
 lijst.sort(function(a,b){
  var av=a.contactVolgorde||99,bv=b.contactVolgorde||99;
  if(av!==bv)return av-bv;
  return naam(a).localeCompare(naam(b));
 });
 return lijst.slice(0,3);
}
function sosActivate(){
 var c=findPerson(caClientId);
 var betrokkenen=sosOntvangers(caClientId);
 var deelt=!!ensureCaInstellingen(caClientId).deelLocatie;
 var kop=betrokkenen.length?'<h3>Hulp is onderweg</h3><div class="msec"><p>De volgende personen zijn zojuist gewaarschuwd:</p></div>'
  :'<h3>Niemand om te waarschuwen</h3><div class="msec"><p>Er is in '+esc(huidigeGroep)+' niemand met een actief account én een rol op '+esc(c?naam(c):'deze cliënt')+'. Neem direct zelf contact op met de zorgorganisatie.</p></div>';
 el('sos-card').innerHTML=kop+
  betrokkenen.map(function(b){return '<div class="msec"><b>'+esc(naam(b))+'</b><p>'+esc(b.contactVolgorde?'Contactpersoon '+b.contactVolgorde:rolOpClient(b,caClientId))+' · gewaarschuwd, wacht op reactie…</p></div>';}).join('')+
  (betrokkenen.length?'<p class="mini" style="margin-top:10px">'+(deelt?'Je locatie is meegestuurd, zoals ingesteld bij Privacy.':'Je locatie is niet meegestuurd. Zet “Deel locatie bij SOS” aan bij Meer instellingen als je dat wel wilt.')+'</p>':'')+
  '<div class="modal-actions"><button type="button" class="primary" id="sos-sluiten">Sluiten</button></div>';
 logActie('SOS gestart voor '+(c?naam(c):'onbekende cliënt')+' — gewaarschuwd: '+(betrokkenen.length?betrokkenen.map(naam).join(', '):'niemand')+(deelt?' (met locatie)':''));
 nieuweMelding(caClientId,'sosMelding','SOS gestart — '+(betrokkenen.length?betrokkenen.map(naam).join(', ')+' gewaarschuwd':'niemand kon worden gewaarschuwd'));
 el('sos-sluiten').addEventListener('click',function(){el('sos-overlay').hidden=true;});
}
function sosStartHold(){
 var ring=el('sos-progress');if(!ring)return;
 ring.style.transition='none';ring.style.strokeDashoffset=SOS_CIRC;
 void ring.getBoundingClientRect();
 ring.style.transition='stroke-dashoffset '+SOS_HOLD_MS+'ms linear';
 ring.style.strokeDashoffset='0';
 sosHoldTimer=setTimeout(sosActivate,SOS_HOLD_MS);
}
function sosCancelHold(){
 if(sosHoldTimer){clearTimeout(sosHoldTimer);sosHoldTimer=null;}
 var ring=el('sos-progress');if(!ring)return;
 ring.style.transition='stroke-dashoffset .25s ease';
 ring.style.strokeDashoffset=SOS_CIRC;
}
el('ca-sos-btn').addEventListener('click',function(){
 el('sos-card').innerHTML='<h3>Houd ingedrukt om SOS te activeren</h3>'+
  '<div class="msec"><p>Dit waarschuwt direct de aanwezige medewerkers en de contactpersonen van '+esc(findPerson(caClientId)?naam(findPerson(caClientId)):'deze cliënt')+'.</p></div>'+
  '<div class="sosholdwrap"><svg class="sosring" viewBox="0 0 170 170"><circle cx="85" cy="85" r="72" fill="none" stroke="var(--line)" stroke-width="6"/><circle id="sos-progress" cx="85" cy="85" r="72" fill="none" stroke="var(--brick)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 85 85)" style="stroke-dasharray:452;stroke-dashoffset:452"/></svg><button type="button" class="sosbtn" id="sos-hold-btn">SOS</button></div>'+
  '<p class="mini" style="text-align:center">Houd de knop ingedrukt tot de ring vol is</p>'+
  '<div class="modal-actions"><button type="button" id="sos-cancel">Annuleren</button></div>';
 el('sos-overlay').hidden=false;
 el('sos-cancel').addEventListener('click',function(){sosCancelHold();el('sos-overlay').hidden=true;});
 var holdBtn=el('sos-hold-btn');
 ['pointerdown'].forEach(function(evt){holdBtn.addEventListener(evt,sosStartHold);});
 ['pointerup','pointerleave','pointercancel'].forEach(function(evt){holdBtn.addEventListener(evt,sosCancelHold);});
});
el('ca-weergave-terug').addEventListener('click',function(){zetClientweergave(false);});
el('ca-bel').addEventListener('click',function(){
 if(caUitgelogd||!caClientId)return;
 renderCaMeldingen();
});
el('sos-overlay').addEventListener('click',function(e){if(e.target===el('sos-overlay')){sosCancelHold();el('sos-overlay').hidden=true;}});

/* ============== STANDALONE TELEFOON-MODUS ============== */
if(new URLSearchParams(location.search).get('app')==='client'){
 document.body.classList.add('standalone-app');
 showView('clientapp');
}

loadFromSupabase();
laadDatalekken();
