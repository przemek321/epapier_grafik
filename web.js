const express = require('express');
const sql = require('mssql');
const dbConfig = require('./dbconfig');
const app = express();
const port = 3003;

// Strona główna z tabelką danych
app.get('/', async (req, res) => {
    try {
        // Połączenie z bazą danych
        const pool = await sql.connect(dbConfig);
        
        // Pobieramy dane z tabeli grafik_now
        const result = await pool.request().query(`
            SELECT numer_linii, nazwisko
            FROM grafik_now
            WHERE zmiana = 'Zmiana_1'
            ORDER BY numer_linii, nazwisko
        `);
        
        await pool.close();
        
        // Grupujemy nazwiska według numer_linii
        const linie = {};
        result.recordset.forEach(row => {
            const linia = row.numer_linii;
            if (!linie[linia]) linie[linia] = [];
            linie[linia].push(row.nazwisko);
        });
        
        // Lista wszystkich linii (nagłówki kolumn)
        const allLinie = Object.keys(linie).sort();
        
        // Ile kolumn w jednym wierszu
        const kolumnNaRzad = 5;
        
        // Dzielimy linie na bloki po 5 (każdy blok to jeden wiersz nagłówków)
        function chunkArray(array, size) {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        }
        const blokiLinii = chunkArray(allLinie, kolumnNaRzad);
        
        // Generujemy HTML
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { margin: 0; padding: 0; }
                    table { border-collapse: collapse; width: 100%; font-size: 30px; }
                    th, td { border: 1px solid #aaa; padding: 4px 6px; text-align: left; }
                    th { background:rgba(190, 189, 189, 0.86);font-size: 38px; }
                    tr { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <table>
        `;
        
        // Dla każdego bloku linii generujemy tabelę
        blokiLinii.forEach(linieBloku => {
            // Nagłówek z numerami linii
            html += `<tr>`;
            linieBloku.forEach(linia => {
                html += `<th>${linia}</th>`;
            });
            html += `</tr>`;
            
            // Znajdź maksymalną liczbę nazwisk w tym bloku
            const maxNazwiskWBloku = Math.max(...linieBloku.map(linia => linie[linia].length));
            
            // Wiersze z nazwiskami - tylko tyle ile jest rzeczywistych danych
            for (let i = 0; i < maxNazwiskWBloku; i++) {
                // Sprawdź czy w tym wierszu są jakieś dane
                const wierszMaDane = linieBloku.some(linia => linie[linia][i]);
                
                // Jeśli wiersz ma dane, generuj go
                if (wierszMaDane) {
                    html += `<tr>`;
                    linieBloku.forEach(linia => {
                        html += `<td>${linie[linia][i] || ''}</td>`;
                    });
                    html += `</tr>`;
                }
            }
        });
        
        html += `
                </table>
            </body>
            </html>
        `;
        
        res.send(html);
        
    } catch (err) {
        console.error('Błąd podczas pobierania danych:', err);
        res.status(500).send('Wystąpił błąd podczas pobierania danych');
    }
});

// Uruchamiamy serwer
app.listen(port, () => {
    console.log(`Serwer uruchomiony na http://156.4.10.182:${port}`);
}); 