# Now-Playing-Overlay — Design

**Datum:** 2026-08-06
**Status:** Genehmigt

## Ziel

Eine vollflächige "Now Playing"-Ansicht (ähnlich Spotify), die den aktuell
laufenden Track mit größerem Cover, Metadaten, Lyrics, Artist-Bio und
Warteschlange zeigt. Aktuell existiert nur die kleine Bottom-Player-Leiste
(`ui/src/layout/NowPlayingPanel.jsx`).

## Einstieg

Klick auf Cover oder Track-Titel in der bestehenden Player-Leiste öffnet das
Overlay. Kein zusätzlicher Button nötig.

## Darstellung

Vollflächiges Overlay über der gesamten App (kein Routenwechsel, keine neue
URL). Schließen per Pfeil-nach-unten-Button oder Escape. Der Player selbst
läuft im Hintergrund unverändert weiter — das Overlay liest nur den
bestehenden Player-State, es gibt kein Remount/keine neue Player-Instanz.

## Inhalt

1. **Großes Cover** — bestehende Cover-Art-URLs, gleiche Auflösungslogik wie
   auf der Album-Seite.
2. **Metadaten** — Track-Titel, Artist, Album, Jahr, Genre. Alles bereits im
   `player.queue`-Redux-State vorhanden (siehe `playerReducer.js`).
3. **Lyrics** — Backend parst Lyrics bereits (`model/lyrics.go`,
   `model/lyrics_parse.go`) und liefert sie im Queue-Item (`item.lyrics`,
   siehe `playerReducer.js:59`). Bisher nirgends groß gerendert — nur
   anzeigen, keine neue Datenbeschaffung. Kein Lyrics-Feld vorhanden →
   bestehender i18n-String `emptyLyricText` ("No lyrics").
4. **Artist-Bio** — Bereits vorhanden über Last.fm-Anbindung
   (`ArtistShow.jsx`, `DesktopArtistDetails.jsx` liest
   `artistInfo?.biography`). Logik aus `DesktopArtistDetails.jsx`
   extrahieren/wiederverwenden statt duplizieren, per Artist-ID des aktuellen
   Tracks nachladen. Keine Bio vorhanden → Abschnitt ausblenden.
5. **Warteschlange** — aus `state.player.queue`, gleiche Datenquelle, die
   `Menu.jsx` heute schon für das Playlist-Sidebar-Badge nutzt.

## Technischer Ansatz

- Neue Komponente `NowPlayingOverlay.jsx` unter `ui/src/layout/`.
- Redux-Selector zur Ableitung des "aktuellen Tracks" aus der Queue
  (Index/aktive Track-ID), damit Overlay und Mini-Player dieselbe
  Datenquelle nutzen.
- Styling folgt dem Spotify-Theme-Muster, das bereits für
  `NDAlbumDetails`/`NDPlaylistDetails` existiert (dunkler Verlauf-Hintergrund
  passend zum Cover).
- Kein Backend-Change nötig — alle benötigten Daten sind bereits über
  bestehende Endpoints/State verfügbar.

## Fehlerbehandlung

- Kein Cover vorhanden → bestehendes Platzhalter-Verhalten.
- Keine Lyrics → vorhandener "No lyrics"-Hinweis.
- Keine Bio → Abschnitt komplett ausblenden statt leere Box zu zeigen.

## Explizit außerhalb des Scopes

- Tour-/Konzertdaten (externe API-Anbindung, z.B. Bandsintown) — eigenes
  Folgeprojekt, hängt von einer separaten Entscheidung über externe
  Datenquelle/API-Key ab.
- Keine neue Route/URL, kein Eingriff in bestehende Player-Logik.
