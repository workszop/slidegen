/* ============================================================
   The example deck every workspace opens with.

   One deck for all flavours: the app works the same everywhere,
   only the visual style differs, so the guide stays brand-neutral
   and never names a palette or a company. Slide titles carry no
   numbering — the flow comes first, the options after the
   "Opcje / Options" section slide.
   ============================================================ */
window.EXAMPLE_DECK = {
  pl: `# doc2slide
Zamień dokument w gotową prezentację: tekst i ilustracje przygotuje AI, a Ty poprawisz je w edytorze.
---
## Jak to działa
- Wgraj dokument w panelu **Dokument** albo wklej tekst
- Kliknij **Generuj slajdy**, a AI zamieni materiał w prezentację
- Sprawdź wynik, popraw treść i uruchom **Prezentuj**

> Ten przewodnik przejrzysz przyciskami pod slajdem albo klawiszami ← i →.
---
## Dodaj materiał
- Obsługiwane formaty to **.txt**, **.md** i **.pdf**; limit pliku PDF wynosi 19 MB
- Tekst możesz też wkleić bezpośrednio pod polem wyboru pliku
- Plik .md z separatorami \`---\` otworzy się od razu jako gotowa prezentacja, bez udziału AI
---
## Wybierz model AI
- Kliknij nazwę modelu w sekcji **Generowanie**
- Tekst przygotuje Gemini, OpenAI albo Claude, każdy na Twoim własnym kluczu API
- Klucz zostaje w pamięci tej przeglądarki i trafia wyłącznie do wybranego dostawcy

> Podczas generowania treść dokumentu jest wysyłana bezpośrednio do dostawcy AI.
---
## Generuj slajdy
- Kliknij **Generuj slajdy**; edytor otworzy się sam i pokaże strumień odpowiedzi
- Generowanie możesz przerwać w dowolnym momencie
- Gotowe slajdy rozdziela osobna linia \`---\`
---
## Sprawdź i popraw
- Przejrzyj slajdy i upewnij się, że nie brakuje ważnych informacji
- Kliknij **Edytuj**, aby otworzyć tekst prezentacji po prawej stronie
- Zmiany widać na bieżąco; skracaj akapity, jeden slajd to jedna myśl
- Zweryfikuj fakty wygenerowane przez AI, zanim je udostępnisz
---
## Prezentuj i zapisz
- **Prezentuj** uruchamia tryb pełnoekranowy
- **Pobierz html** zapisuje samodzielną prezentację do otwarcia w przeglądarce
- **Pobierz .pptx** tworzy edytowalną prezentację PowerPoint

| Klawisz | Działanie |
|---------|-----------|
| → | następny slajd |
| ← | poprzedni slajd |
| Esc | powrót do edycji |
---
## Opcje
---
## Opcje generowania
- Strzałka przy nagłówku **Generowanie** rozwija dodatkowe ustawienia
- **Auto** zachowuje język dokumentu; możesz wymusić polski albo angielski
- W polu **Dodatkowe instrukcje dla AI** opiszesz ton, odbiorców lub zakres prezentacji
- Instrukcje uzupełniają zasady doc2slide, ale nie zastępują formatu slajdów
---
## Styl i czcionka
- Cztery style zmieniają kolory całej prezentacji jednym kliknięciem
- Strzałka przy nagłówku **Styl** rozwija wybór czcionki
- Do wyboru są cztery kroje albo dowolna czcionka Google wpisana z nazwy
- Wybrany styl i czcionka trafiają także do pliku PowerPoint
---
## Ilustracje AI
- Model obrazu wybierzesz w ustawieniach modelu AI; ilustracje wymagają klucza OpenAI
- Przejdź do slajdu treści i kliknij **Ilustruj ten slajd** pod podglądem
- Każdą ilustrację generujesz osobno; możesz ją usunąć albo powtórzyć
- Generowanie obrazów zwiększa czas i koszt wywołań API

Gotowe – wgraj własny dokument w panelu po lewej stronie.`,

  en: `# doc2slide
Turn a document into a finished deck: AI writes the slides and the illustrations, you refine them in the editor.
---
## How it works
- Drop a document in the **Document** panel, or paste text
- Click **Generate slides** and the AI turns the material into a deck
- Review the result, edit the text, then hit **Present**

> Browse this guide with the buttons under the slide, or with ← and →.
---
## Load your material
- Supported formats are **.txt**, **.md**, and **.pdf**; PDFs go up to 19 MB
- You can also paste text straight into the box below the file control
- A .md file split by \`---\` opens as a finished deck, with no AI involved
---
## Pick an AI model
- Click the model name in the **Generate** section
- Gemini, OpenAI, or Claude writes the slides, each on your own API key
- The key stays in this browser and goes only to the provider you picked

> During generation the document is sent straight to that provider.
---
## Generate the slides
- Click **Generate slides**; the editor opens itself and streams the answer
- You can cancel generation at any point
- Finished slides are separated by a \`---\` line
---
## Review and edit
- Read the deck through and check that nothing important is missing
- **Edit** opens the presentation text to the right of the slide
- Changes render live; keep paragraphs short, one slide is one idea
- Verify AI-generated facts before you share the deck
---
## Present and save
- **Present** switches to full-screen mode
- **Download HTML** saves a standalone presentation that opens in a browser
- **Download .pptx** creates an editable PowerPoint file

| Key | Action |
|-----|--------|
| → | next slide |
| ← | previous slide |
| Esc | back to editing |
---
## Options
---
## Generation options
- The chevron on the **Generate** heading unfolds the extra settings
- **Auto** keeps the document's language; you can force Polish or English
- **Additional AI instructions** is where you describe tone, audience, or scope
- Your instructions extend the built-in doc2slide rules, they do not replace them
---
## Style and font
- Four styles recolour the whole deck with one click
- The chevron on the **Style** heading unfolds the font picker
- Choose one of four faces, or type the name of any Google font
- The chosen style and font carry into the PowerPoint export
---
## AI illustrations
- Pick the image model in the AI model dialog; illustrations need an OpenAI key
- Open a content slide and click **Illustrate this slide** below the preview
- Each illustration is generated on its own and can be removed or repeated
- Image generation adds API cost and takes longer

That is everything – drop your own document in the panel on the left.`,
};
