const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const Jimp = require('jimp');

const URL = 'http://156.4.10.182:3003/';
const TEMP_SCREENSHOT = './temp_screenshot.png';
const SCREENSHOT_PATH = './screenshot.bmp';
const EPD_COMMAND = '/home/IT8951/epd';

let previousHash = '';

async function getPageHash(page) {
    const content = await page.content();
    return crypto.createHash('md5').update(content).digest('hex');
}

async function takeScreenshot(page) {
    // Najpierw zapisz jako PNG
    await page.screenshot({
        path: TEMP_SCREENSHOT,
        type: 'png'
    });

    // Konwertuj PNG na BMP używając Jimp
    const image = await Jimp.read(TEMP_SCREENSHOT);
    await image.writeAsync(SCREENSHOT_PATH);

    // Usuń tymczasowy plik PNG
    fs.unlinkSync(TEMP_SCREENSHOT);
}

async function runEPDCommand() {
    return new Promise((resolve, reject) => {
        exec(EPD_COMMAND, (error, stdout, stderr) => {
            if (error) {
                console.error(`Błąd wykonania komendy: ${error}`);
                reject(error);
                return;
            }
            console.log('Komenda EPD wykonana pomyślnie');
            resolve(stdout);
        });
    });
}

async function monitorPage() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto(URL);

        // Pobierz początkowy hash
        previousHash = await getPageHash(page);

        // Monitoruj zmiany co 5 sekund
        setInterval(async () => {
            try {
                await page.reload();
                const currentHash = await getPageHash(page);

                if (currentHash !== previousHash) {
                    console.log('Wykryto zmiany na stronie!');
                    
                    // Zrób screenshot i przekonwertuj na BMP
                    await takeScreenshot(page);
                    console.log('Zapisano screenshot jako BMP');

                    // Uruchom komendę EPD
                    await runEPDCommand();

                    // Zaktualizuj poprzedni hash
                    previousHash = currentHash;
                }
            } catch (error) {
                console.error('Wystąpił błąd podczas monitorowania:', error);
            }
        }, 5000);

    } catch (error) {
        console.error('Wystąpił błąd:', error);
        await browser.close();
    }
}

// Uruchom monitorowanie
monitorPage().catch(console.error); 