# 🎓 Schul-Trivia Quiz (Sachsen-Edition)

Ein klassisches, rundenbasiertes Quiz-Brettspiel für 2 bis 4 Spieler, basierend auf dem sächsischen Lehrplan ab der 2. Klasse bis zur Oberstufe (Klasse 12). 

Das Spiel läuft **vollständig ohne KI**, ist datenschutzfreundlich und kann sowohl lokal an einem Gerät als auch online über das Internet gespielt werden.

---

## 🌟 Highlights & Features

* **📚 8 Schulfächer & Wissensecken:**
  * 🔵 **Deutsch:** Sprache, Grammatik & Literatur
  * 🔴 **Mathe & Physik:** Rechnen, Logik & Naturgesetze
  * 🟢 **Sachunterricht:** Sachkunde, Geografie, Biologie & Geschichte
  * 🟡 **Englisch:** Vokabeln, Grammatik & Landeskunde
  * 🟣 **Kunst & Musik:** Epochen, Instrumente & Kulturgeschichte
  * 🟠 **Sport:** Regeln, Gesundheit & Sportarten
  * 🌸 **Werken & Gestalten:** Technik, Werkzeuge & Physik
  * ⚪ **Ethik & Philosophie:** Werte, Religionen & Denker

* **🌐 Online-Multiplayer (Internet):**
  * Über einen schnellen Vermittlungsserver per WebRTC (PeerJS) direkt im Browser verbinden.
  * **Kein Account oder Login nötig:** Der Host erstellt einen Raum, teilt den 6-stelligen Code oder Einladungslink, und die Mitspieler können sofort beitreten.
  * Vollständig synchronisiertes Spielbrett, Live-Zuschauen und Reaktions-Emojis.

* **🏠 Lokales Spiel (Pass & Play):**
  * Gemütlich mit Freunden oder der Familie an einem einzigen Bildschirm (PC, Tablet oder Laptop) spielen.

* **📁 CSV-Export & -Import für eigene Fragen:**
  * **Export:** Alle aktuell geladenen Fragen können mit einem Klick als saubere CSV-Datei mit Kopfzeile heruntergeladen werden.
  * **Excel-Kompatibel:** Enthält UTF-8-BOM (`\uFEFF`) und Semikolon-Trennung, damit deutsche Umlaute (ä, ö, ü, ß) in Excel und LibreOffice fehlerfrei dargestellt werden.
  * **Import:** Eigene Fragenkataloge können per Drag-and-Drop oder Dateiauswahl hochgeladen und wahlweise angehängt (*Merge*) oder ersetzt werden.

* **⏱️ Nervenkitzel & Dynamik:**
  * 30 Sekunden Bedenkzeit pro Frage mit animierter Zeitleiste.
  * Interaktiver 3D-Würfel und automatische Berechnung legaler Zielfelder auf dem Speichenrad.

---

## 🎲 Spielregeln

1. **Würfeln:** Wer am Zug ist, wirft den Würfel und wählt eines der gelb markierten Zielfelder auf dem Brett.
2. **Frage beantworten:** Eine Multiple-Choice-Frage aus der Kategorie des Feldes (angepasst an die gewählte Klassenstufe des Spielers) wird gestellt.
3. **Richtige Antwort:** Du bleibst am Zug und darfst sofort noch einmal würfeln!
4. **Wissensecken sammeln:** Landest du auf einem der 8 Stern-Felder (**★**) und beantwortest die Frage richtig, erhältst du die Wissensecke dieses Schulfachs.
5. **Ziel & Sieg:** Wer alle 8 Ecken gesammelt hat, zieht in das Zentrum des Rads und beantwortet die finale Meisterfrage zum Sieg!

---

## 📄 CSV-Format für eigene Fragenkataloge

Wenn du eigene Fragen erstellen oder importieren möchtest, nutze einfach folgenden Aufbau:

```csv
id;kategorie;klasse;frage;antwort;option1;option2;option3;option4
d_03_01;Deutsch: Sprache & Literatur;3;Was ist das Gegenteil von "hell"?;dunkel;dunkel;kalt;leise;schwer
m_04_01;Mathe & Physik: Logik / Natur;4;Was ist 25 x 4?;100;75;80;100;125
su_04_01;Sachkunde / Geo / Bio / Geschichte;4;Wie heißt die Landeshauptstadt von Sachsen?;Dresden;Dresden;Leipzig;Chemnitz;Zwickau
Trennzeichen: Semikolon (;), Komma (,) oder Tabulator.
Klassenstufen: 2 bis 12.
Optionen: Die richtige Antwort muss entweder in den Optionen enthalten sein oder wird automatisch ergänzt.
🛠️ Technische Details (Tech Stack)
Frontend: React 19, TypeScript
Styling: Tailwind CSS, responsive für Desktop & Tablets
Networking / Multiplayer: WebRTC via PeerJS (Peer-to-Peer Datenübertragung)
Lokale Datenbank: Browser-native IndexedDB (offline-fähig, kein externer Datenbankserver nötig)
Build-Tool: Vite
💻 Installation & Lokaler Start
Voraussetzung: Node.js (Version 18 oder neuer)
Repository klonen:
code
Bash
git clone https://github.com/DEIN-BENUTZERNAME/DEIN-REPO.git
cd DEIN-REPO
Abhängigkeiten installieren:
code
Bash
npm install
Entwicklungsserver starten:
code
Bash
npm run dev
Die App läuft anschließend unter http://localhost:3000.
Produktions-Build erstellen:
code
Bash
npm run build
⚖️ Lizenz & Markenhinweis
Dieses Projekt ist ein unabhängiges Lern- und Bildungsquiz und steht in keiner Verbindung zu Hasbro oder geschützten Marken.
Die Fragen und Inhalte orientieren sich an Lehrplänen und Allgemeinwissen.
Lizenz: MIT License (oder die von dir gewählte Lizenz).
