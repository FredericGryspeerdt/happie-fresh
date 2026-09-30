# Start: gedeeld huishoudenoverzicht

Status: geïmplementeerd op branch `codex/home-dashboard`.

Visuele basis: [verfijnde optie 3](assets/2026-09-30-home-selected.png). De
bestaande appbalk, ledenchip en MD3-iconen blijven behouden.

## Doel en bereik

Start geeft snel inzicht in wat aandacht vraagt in het huishouden, met directe
toegang tot bijbehorende acties. De eerste versie gebruikt bestaande
mogelijkheden. Het overzicht is gedeeld voor het hele huishouden; persoonlijke
filtering en terugkerende klusjes vallen buiten deze versie.

Happie opent bij een gewone start op Start. Specifieke links, waaronder links
vanuit meldingen, blijven rechtstreeks naar hun bestemming gaan.

## Volgorde

1. Te doen
2. Boodschappen
3. Weekmenu

Te doen brengt geplande zaken onder de aandacht. Boodschappen volgt meteen omdat
dit het meest frequent gebruikte onderdeel is.

## Te doen

- Toon open to-do's die vandaag gepland zijn of voorbij de geplande tijd zijn.
  To-do's zonder geplande datum blijven bereikbaar via Te doen.
- Toon maximaal vijf: eerst die van vandaag, op gepland tijdstip; daarna die van
  eerdere dagen die voorbij de geplande tijd zijn, oudste eerst. Een to-do van
  vandaag die al voorbij de geplande tijd is, verschijnt één keer, in de groep
  van vandaag.
- Bepaal vandaag in de lokale tijdzone van de kijker, conform ADR 0004.
- Toon aan wie een to-do is toegewezen. Niet-toegewezen to-do's doen ook mee.
- Laat to-do's rechtstreeks als klaar markeren.
- Een link naar alle relevante to-do's vermeldt het totale aantal, ook wanneer
  slechts vijf zichtbaar zijn.

## Boodschappen

- Bij elke boodschappenlijst staat de optie **Toon op Start**. Deze keuze geldt
  voor het hele huishouden, niet per lid of toestel.
- Toon alle geselecteerde lijsten met het aantal resterende producten.
- Een geselecteerde lijst blijft zichtbaar wanneer alles gekocht is, met **Alles
  gekocht**. Aantikken opent de lijst.
- Aanvankelijk is geen lijst geselecteerd. Start toont een compacte uitnodiging:
  **Welke boodschappenlijsten wil je op Start zien?**, met **Kies lijsten**.
- Bij elke getoonde lijst staat **Product toevoegen**. Dit opent rechtstreeks de
  bestaande productkiezer voor die lijst. Na toevoegen blijft de gebruiker op
  Start en wordt het aantal resterende producten bijgewerkt.

## Weekmenu

- Toon een compacte tekstuele weergave van maximaal zeven gerechten, met hun
  weekdag indien gekozen. Gerechten zonder gekozen weekdag doen ook mee.
- Bied een link **Bekijk weekmenu**; een gerecht aantikken opent de bijbehorende
  module.
- Toon geen ingrediënten of grote afbeeldingen.
- Gebruik de titel **Weekmenu**, niet de stellige belofte **Vandaag eten we**.
  Het huidige weekmenu bewaart weekdagen, maar geen concrete datums of
  weeknummer. Gerechten kunnen dus nog van een vorige week zijn. Automatisch
  onderscheid tussen weken vraagt een aparte beslissing buiten dit ontwerp.

## Lege inhoud en bestaande interactiepatronen

Lege onderdelen krijgen één rustige regel met een passende actie of link.
Hanteer bij uitvoering de bestaande foutafhandeling, laadfeedback en
mutatiepatronen uit `docs/ui-ux-patterns.md`, ook bij acties op Start.

## Documentatiegrens

Dit document beschrijft het bevestigde productontwerp. Het introduceert geen
nieuw domeinbegrip voor `CONTEXT.md`. De keuzes zijn omkeerbare
presentatiekeuzes; daarom is geen aparte ADR nodig. Bestaande domeinafspraken
blijven gelden.
