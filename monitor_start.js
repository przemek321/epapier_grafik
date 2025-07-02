const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const sharp = require('sharp');
const { execSync } = require('child_process');
const path = require('path');

const URL = 'http://156.4.10.182:3003/';
const TEMP_SCREENSHOT = './temp_screenshot.png';
const SCREENSHOT_PATH = '/home/n1copl/IT8951/pic/screenshot.bmp';
const EPD_COMMAND = '/home/n1copl/IT8951/start.sh';
const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 1200;

let previousHash = '';
let isCommandRunning = false;
let browser = null;
let page = null;
let monitorInterval = null;
let watchdogInterval = null;
let lastActivity = Date.now();

// Watchdog - sprawdza czy aplikacja działa
function startWatchdog() {
    watchdogInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivity;
        
        console.log(`Watchdog: Ostatnia aktywność ${Math.round(timeSinceLastActivity / 1000)}s temu`);
        
        // Jeśli nie było aktywności przez 5 minut, restartuj aplikację
        if (timeSinceLastActivity > 5 * 60 * 1000) {
            console.log('⚠️ Watchdog: Brak aktywności przez 5 minut, restartuję aplikację...');
            restartApplication();
        }
        
        // Sprawdź czy pliki istnieją
        if (!fs.existsSync(EPD_COMMAND)) {
            console.log('⚠️ Watchdog: Brak pliku EPD_COMMAND, restartuję aplikację...');
            restartApplication();
        }
    }, 30000); // Sprawdzaj co 30 sekund
}

// Restart aplikacji
async function restartApplication() {
    console.log('🔄 Restartuję aplikację...');
    
    try {
        // Zatrzymaj wszystkie interwały
        if (monitorInterval) clearInterval(monitorInterval);
        if (watchdogInterval) clearInterval(watchdogInterval);
        
        // Zamknij przeglądarkę
        if (browser) {
            await browser.close();
            browser = null;
            page = null;
        }
        
        // Poczekaj chwilę
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Uruchom ponownie
        await monitorPage();
    } catch (error) {
        console.error('Błąd podczas restartu:', error);
        // Jeśli restart się nie udał, spróbuj ponownie za 30 sekund
        setTimeout(restartApplication, 30000);
    }
}

async function getPageHash(page) {
    const content = await page.content();
    return crypto.createHash('md5').update(content).digest('hex');
}

// Funkcja czekająca na utworzenie pliku BMP
async function waitForBMPFile(filePath, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (fs.existsSync(filePath)) {
            // Sprawdź czy plik nie jest pusty i czy ma odpowiedni rozmiar
            const stats = fs.statSync(filePath);
            if (stats.size > 1000) { // Minimalny rozmiar dla pliku BMP
                console.log(`✅ Plik BMP utworzony: ${filePath} (${stats.size} bajtów)`);
                return true;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Czekaj 100ms
    }
    
    throw new Error(`Timeout: Plik BMP nie został utworzony w ciągu ${timeout}ms`);
}

async function takeScreenshot(page) {
    console.log('📸 Rozpoczynam tworzenie screenshot...');
    
    // Ustaw viewport na pełny ekran
    const viewport = await page.viewport();
    await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
    });

    // Zrób screenshot całej strony
    await page.screenshot({
        path: TEMP_SCREENSHOT,
        type: 'png',
        fullPage: true
    });
    
    console.log('📸 Screenshot PNG utworzony, konwertuję na BMP...');

    // Usuń stary plik BMP jeśli istnieje
    if (fs.existsSync(SCREENSHOT_PATH)) {
        fs.unlinkSync(SCREENSHOT_PATH);
    }

    // Konwertuj na BMP
    const convertCmd = `convert ${TEMP_SCREENSHOT} -resize ${TARGET_WIDTH}x${TARGET_HEIGHT} -colorspace Gray -dither FloydSteinberg -define bmp:format=bmp3 ${SCREENSHOT_PATH}`;
    
    console.log('🔄 Wykonuję komendę konwersji:', convertCmd);
    execSync(convertCmd);
    
    // Czekaj na utworzenie pliku BMP
    await waitForBMPFile(SCREENSHOT_PATH);
    
    await page.setViewport(viewport);
    console.log('✅ Konwersja na BMP zakończona pomyślnie');
}

async function runEPDCommand() {
    return new Promise((resolve, reject) => {
        const fullCommand = `cd /home/n1copl/IT8951 && sudo ./epd -2.33 0`;
        console.log('🚀 Uruchamiam komendę EPD:', fullCommand);
        
        const child = exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Błąd wykonania komendy EPD: ${error}`);
                console.error(`STDERR: ${stderr}`);
                reject(error);
                return;
            }
            console.log('✅ Komenda EPD wykonana pomyślnie');
            console.log(`STDOUT: ${stdout}`);
            resolve(stdout);
        });
        
        // Ustaw timeout na 60 sekund
        setTimeout(() => {
            if (child.exitCode === null) {
                console.log('⚠️ Timeout komendy EPD, zabijam proces...');
                child.kill('SIGKILL');
                reject(new Error('Timeout komendy EPD'));
            }
        }, 60000);
    });
}

async function monitorPage() {
    console.log('🚀 Uruchamiam monitorowanie strony...');
    
    browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: true,
        args: ['--no-sandbox', '--start-maximized', '--disable-dev-shm-usage']
    });

    try {
        page = await browser.newPage();
        
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });

        // Załaduj stronę
        console.log('📄 Ładowanie strony:', URL);
        await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Poczekaj żeby strona się w pełni załadowała
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Pobierz początkowy hash
        previousHash = await getPageHash(page);
        console.log('🔍 Początkowy hash strony:', previousHash);
        
        // Ustaw ostatnią aktywność
        lastActivity = Date.now();

        // Uruchom watchdog
        startWatchdog();

        monitorInterval = setInterval(async () => {
            try {
                // Aktualizuj czas ostatniej aktywności
                lastActivity = Date.now();
                
                // Jeśli komenda jest w trakcie wykonywania, pomijamy tę iterację
                if (isCommandRunning) {
                    console.log('⏳ Pomijam sprawdzenie - poprzednia komenda w trakcie wykonywania');
                    return;
                }

                // Przeładuj stronę
                await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
                const currentHash = await getPageHash(page);
                
                console.log('🔍 Sprawdzam zmiany...');
                console.log('📊 Poprzedni hash:', previousHash);
                console.log('📊 Aktualny hash:', currentHash);

                if (currentHash !== previousHash) {
                    console.log('🎉 Wykryto zmiany na stronie!');
                    
                    try {
                        isCommandRunning = true;
                        
                        // Zrób screenshot i przekonwertuj na BMP
                        await takeScreenshot(page);
                        console.log('📸 Screenshot zapisany jako BMP');

                        // Uruchom komendę EPD
                        await runEPDCommand();
                        console.log('✅ Komenda EPD zakończona pomyślnie');

                        // Zaktualizuj poprzedni hash
                        previousHash = currentHash;
                        console.log('✅ Zmiany przetworzone pomyślnie');
                    } catch (error) {
                        console.error('❌ Błąd podczas przetwarzania zmiany:', error);
                    } finally {
                        isCommandRunning = false;
                    }
                } else {
                    console.log('✓ Brak zmian na stronie');
                }
            } catch (error) {
                console.error('❌ Wystąpił błąd podczas monitorowania:', error);
                isCommandRunning = false;
            }
        }, 5000);

    } catch (error) {
        console.error('❌ Wystąpił błąd podczas inicjalizacji:', error);
        await browser.close();
        throw error;
    }
}

// Obsługa sygnałów systemowych
process.on('SIGINT', async () => {
    console.log('\n🛑 Otrzymano sygnał SIGINT, zamykam aplikację...');
    if (monitorInterval) clearInterval(monitorInterval);
    if (watchdogInterval) clearInterval(watchdogInterval);
    if (browser) await browser.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Otrzymano sygnał SIGTERM, zamykam aplikację...');
    if (monitorInterval) clearInterval(monitorInterval);
    if (watchdogInterval) clearInterval(watchdogInterval);
    if (browser) await browser.close();
    process.exit(0);
});

// Uruchom monitorowanie
monitorPage().catch(error => {
    console.error('❌ Błąd krytyczny:', error);
    process.exit(1);
});