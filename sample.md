# Dokument → slajdy
Jak działa ta aplikacja - przewodnik w ośmiu slajdach.
---
## Co robi ta aplikacja?
- Zamienia dokument (.txt, .md, .pdf) w prezentację HTML
- Treść slajdów pisze **Gemini**, w formacie markdown
- Slajdy renderuje przeglądarka - bez serwera i instalacji
- Ten pokaz to tryb demo: wszystko działa bez klucza API
---
## Krok 1: klucz API
- Wygeneruj darmowy klucz na aistudio.google.com/apikey
- Wklej go w ustawieniach na ekranie startowym

> Klucz zostaje w Twojej przeglądarce (localStorage) i jest wysyłany wyłącznie do Google - na żaden inny serwer.
---
## Krok 2: dokument
- Upuść plik `.txt`, `.md` lub `.pdf` (do 19 MB) albo wklej tekst
- PDF trafia do Gemini w całości - z tabelami i układem stron
- Wybierz język slajdów (PL/EN) i orientacyjną liczbę slajdów
- Plik .md z gotowymi slajdami? Przycisk **Prezentuj bez Gemini**
---
## Krok 3: generowanie i edycja
- Slajdy pojawiają się na żywo, w trakcie generowania
- Po lewej edytor markdown, po prawej podgląd slajdów
- Podgląd odświeża się sam podczas pisania
- Klik w miniaturę otwiera prezentację od tego slajdu
---
## Format slajdów (markdown)

```markdown
# Tytuł prezentacji
Jedno zdanie wstępu.
---
## Nagłówek slajdu
- punkty, **pogrubienia**, `kod`, tabele, > cytaty
```
---
## Sterowanie prezentacją
| Klawisz | Działanie |
|---------|-----------|
| → / spacja | następny slajd |
| ← | poprzedni slajd |
| 1-9 | skok do slajdu |
| Esc | powrót do edycji |
---
## Eksport i podsumowanie
- **Pobierz .md** - wczytasz ponownie bez klucza API
- **Pobierz .pptx** - edytowalny PowerPoint w tym samym stylu
- Całość to statyczne pliki: GitHub Pages, e-mail, pendrive
- Miłego prezentowania
