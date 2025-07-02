const sql = require('mssql');
const chokidar = require('chokidar');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');

// Konfiguracja bazy danych
const dbConfig = {
    user: 'reporting.admin',
    password: '/vCY}6!ej1VCMOk',
    server: '156.4.10.242',
    database: 'REPORTING-BYD',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Katalog do monitorowania
const watchDir = './files';

// Funkcja pomocnicza do logowania
function logInfo(message) {
    const timestamp = moment().format('HH:mm:ss');
    console.log(`[${timestamp}] INFO: ${message}`);
}

function logError(message, error) {
    const timestamp = moment().format('HH:mm:ss');
    console.error(`[${timestamp}] ERROR: ${message}`);
    if (error) {
        console.error(`[${timestamp}] ERROR DETAILS: ${error.message}`);
        if (error.stack) {
            console.error(`[${timestamp}] STACK: ${error.stack}`);
        }
    }
}

// Przetwarzanie pliku grafik_now.txt
async function processFile(filePath) {
    let pool = null;
    try {
        logInfo(`Przetwarzanie pliku: ${filePath}`);
        
        // Tworzymy połączenie do bazy danych
        pool = await sql.connect(dbConfig);
        logInfo('Utworzono połączenie do bazy danych');
        
        // Czyszczenie tabeli grafik_now
        logInfo('Czyszczenie tabeli grafik_now');
        await pool.request().query('TRUNCATE TABLE grafik_now');
        logInfo('Tabela grafik_now została wyczyszczona');
        
        // Wczytanie zawartości pliku
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
        logInfo(`Liczba linii w pliku: ${lines.length}`);
        
        let isHeader = false;
        let headers = [];
        let recordCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        // Przetwarzanie wszystkich linii
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Sprawdź czy to linia nagłówkowa
            if (line.startsWith('Lp')) {
                headers = line.split(',');
                isHeader = true;
                logInfo(`Znaleziono nagłówki (${headers.length}): ${headers.join(', ')}`);
                continue;
            }
            
            // Pomijamy linie bez nagłówków
            if (!isHeader || headers.length === 0) {
                logInfo(`Pomijam linię ${i + 1} - brak nagłówków`);
                continue;
            }
            
            // Przetwarzanie danych
            const values = line.split(',');
            
            // Przetwarzamy każdą wartość w linii
            for (let j = 1; j < values.length && j < headers.length; j++) {
                const wartoscKomorki = values[j] ? values[j].trim() : '';
                
                // Sprawdzamy czy wartość jest pusta lub specjalna
                if (!wartoscKomorki) {
                    skippedCount++;
                    continue;
                }
                
                // Sprawdź czy wartość komórki jest oznaczeniem linii
                if (wartoscKomorki.match(/^L\d+$/)) {
                    logInfo(`Znaleziono oznaczenie linii ${wartoscKomorki} w kolumnie ${headers[j]}`);
                    skippedCount++;
                    continue;
                }
                
                // Lista standardowych wartości do pominięcia
                const specialValues = ['TRANSP', 'BO', 'QL', 'WEEK', 'L_TABL'];
                if (specialValues.includes(wartoscKomorki)) {
                    logInfo(`Pomijam wartość specjalną: ${wartoscKomorki}`);
                    skippedCount++;
                    continue;
                }
                
                // Pobieramy nagłówek kolumny jako numer linii
                const zmiana = headers[j] ? headers[j].trim() : '';
                
                try {
                    logInfo(`Zapisuję: Linia=${zmiana}, Nazwisko=${wartoscKomorki}`);
                    
                    // Wstawiamy do grafik_now
                    await pool.request()
                        .input('numer_linii', sql.VarChar, zmiana)
                        .input('nazwisko', sql.VarChar, wartoscKomorki)
                        .input('zmiana', sql.VarChar, 'I')
                        .input('data_zmiany', sql.Date, moment().format('YYYY-MM-DD'))
                        .input('data_pliku', sql.Date, moment().format('YYYY-MM-DD'))
                        .query(`
                            INSERT INTO grafik_now (numer_linii, nazwisko, zmiana, data_zmiany, data_pliku)
                            VALUES (@numer_linii, @nazwisko, @zmiana, @data_zmiany, @data_pliku)
                        `);
                    
                    recordCount++;
                } catch (err) {
                    errorCount++;
                    logError(`Błąd wstawiania do bazy: ${err.message}`, err);
                }
            }
        }
        
        logInfo(`Przetworzono rekordów: ${recordCount}, Pominiętych: ${skippedCount}, Błędów: ${errorCount}`);
        return recordCount;
        
    } catch (err) {
        logError(`Błąd przetwarzania pliku ${filePath}:`, err);
        return 0;
    } finally {
        if (pool) {
            try {
                logInfo("Zamykanie połączenia z bazą danych");
                await pool.close();
                logInfo("Połączenie z bazą danych zostało zamknięte");
            } catch (closeErr) {
                logError("Błąd podczas zamykania połączenia:", closeErr);
            }
        }
    }
}

// Inicjalizacja aplikacji
async function init() {
    try {
        logInfo('=== INICJALIZACJA APLIKACJI ===');
        
        // Monitorowanie zmian w katalogu
        const watcher = chokidar.watch(watchDir, {
            ignored: /(^|[\/\\])\../,
            persistent: true
        });

        watcher
            .on('add', filePath => {
                const fileName = path.basename(filePath);
                if (fileName === 'grafik_show.txt') {
                    logInfo(`\n=== NOWY PLIK GRAFIK_show ===`);
                    logInfo(`Dodano nowy plik: ${fileName}`);
                    processFile(filePath);
                }
            })
            .on('change', filePath => {
                const fileName = path.basename(filePath);
                if (fileName === 'grafik_show.txt') {
                    logInfo(`\n=== ZMIANA PLIKU GRAFIK_NOW ===`);
                    logInfo(`Zmieniono plik: ${fileName}`);
                    processFile(filePath);
                }
            })
            .on('error', error => {
                logError(`\n=== BŁĄD MONITOROWANIA ===`, error);
            });

        logInfo(`Monitorowanie pliku grafik_now.txt w katalogu: ${watchDir}`);
        logInfo('=== INICJALIZACJA ZAKOŃCZONA ===\n');
    } catch (err) {
        logError('\n=== BŁĄD INICJALIZACJI ===', err);
    }
}

// Uruchomienie aplikacji
init(); 