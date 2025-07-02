# Grafik Display System

System automatycznego wyświetlania grafiku na e-papierze z monitorowaniem zmian w czasie rzeczywistym.

## 🔧 Funkcjonalności

### Web Server (`web.js`)
- Pobiera dane z bazy danych MSSQL
- Generuje HTML z grafikiem w formie tabeli
- Grupuje pracowników według linii produkcyjnych
- Responsywny design z automatycznym łamaniem stron

### Monitor (`monitor_start.js`)
- Monitoruje zmiany na stronie web
- Automatyczne robienie screenshotów
- Konwersja PNG → BMP z ditheringiem
- Watchdog - automatyczny restart przy awarii
- Obsługa błędów i timeoutów

### IT8951 Driver
- Sterownik dla e-papieru IT8951
- Obsługa różnych rozmiarów ekranów
- Różne tryby wyświetlania (rotacja, lustrzane odbicie)
- Optymalizacja dla Raspberry Pi 5

## 🛠️ Rozwiązywanie problemów

### Problem: E-papier nie aktualizuje się
1. Sprawdź czy sterownik jest skompilowany: `ls -la IT8951/epd`
2. Sprawdź uprawnienia: `sudo chmod +x IT8951/epd`
3. Sprawdź wartość VCOM na FPC e-papieru
4. Sprawdź logi monitora

### Problem: Screenshot nie jest tworzony
1. Sprawdź czy ImageMagick jest zainstalowany: `convert --version`
2. Sprawdź uprawnienia do katalogu `IT8951/pic/`
3. Sprawdź czy Chromium jest dostępny

### Problem: Błąd połączenia z bazą danych
1. Sprawdź konfigurację w `web.js`
2. Sprawdź czy serwer MSSQL jest dostępny
3. Sprawdź uprawnienia użytkownika bazy danych

## 🎨 Tryby wyświetlania e-papieru

| Tryb | Opis | Przykład użycia |
|------|------|-----------------|
| 0 | Bez rotacji, bez lustrzanego odbicia | `sudo ./epd -2.33 0` |
| 1 | Bez rotacji, lustrzane odbicie X | `sudo ./epd -1.52 1` |
| 2 | Bez rotacji, lustrzane odbicie X | `sudo ./epd -2.54 2` |
| 3 | Bez rotacji, kolorowy | `sudo ./epd -2.33 3` |

## 🔒 Bezpieczeństwo

- Hasła do bazy danych powinny być przechowywane w zmiennych środowiskowych
- Uruchamiaj monitor z odpowiednimi uprawnieniami
- Regularnie aktualizuj zależności

## 📝 Licencja

ISC License

## 🤝 Wsparcie

W przypadku problemów:
1. Sprawdź logi aplikacji
2. Sprawdź dokumentację IT8951 w katalogu `IT8951/`
3. Sprawdź czy wszystkie zależności są zainstalowane

## 🔄 Aktualizacje

Aby zaktualizować system:
```bash
git pull
npm install
cd IT8951 && make clean && make -j4 LIB=GPIOD
```

---

**Uwaga**: Projekt wymaga uprawnień sudo do uruchamiania sterownika e-papieru. Upewnij się, że masz odpowiednie uprawnienia na systemie.
