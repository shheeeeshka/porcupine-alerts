import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";

import { config } from "dotenv";
import { sleep } from "./utils.js";

config();

async function main() {
    const executablePath = process.env.OS === "macos" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "";
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: false,
        timeout: 0,
        protocolTimeout: 0,
        userDataDir: "./tmp",
        executablePath,
    });
    const page = await browser.newPage();

    await page.goto(process.env.TARGET_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await page.setViewport({ width: 1820, height: 1080 });

    const baseMainContentSelector = "#main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-captcha>app-captcha";
    const nextBtnFirstPageSelector = baseMainContentSelector + ">div>div:nth-child(2)>app-button-control>button";
    const captchaImgSelector = baseMainContentSelector + ">app-ultimate-captcha>div>div:nth-child(2)>img";

    const screenshotOptions = {
        path: "./screenshots/default-screenshot.png",
        clip: {
            x: 776,
            y: 736,
            width: 170,
            height: 80,
        },
        fullPage: false,
    };

    await page.waitForSelector(baseMainContentSelector);
    await page.screenshot(screenshotOptions);

    const captcha = await Tesseract.recognize(
        "./screenshots/default-screenshot.png",
        "eng",
        {
            logger: m => console.log("Captcha : ", m),
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&",
        }
    ).then(({ data: { text } }) => {
        console.log({ text });
        return text;
    }).catch(err => console.error(err));

    console.log({ captcha });

    await page.locator(".mat-input-element").fill(captcha || "TEST");
    await page.locator(nextBtnFirstPageSelector).click();
    await sleep(2);

    await browser.close();
}

main();

// tesseract for captcha
// .mat-input-element.mat-form-field-autofill-control.ng-tns-c81-1.ng-untouched.ng-pristine.ng-invalid.cdk-text-field-autofill-monitored
// .mat-focus-indicator.mat-button.mat-button-base
// #main-content > app-dashboard > app-institutions > app-institutions > app-poles-card > div > app-poles-card-reservation-appointment-page > div > div > app-poles-card-reservation-appointment-captcha > app-captcha > div > div.d-flex>app-button-control>button


// #main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-captcha>app-captcha





// import puppeteer from "puppeteer";
// import Tesseract from "tesseract.js";
// import fs from "fs"; // Импортируем модуль fs для работы с файловой системой
// import { config } from "dotenv";
// import Jimp from "jimp"; // Импортируем Jimp для обработки изображений

// config();

// async function main() {
//     const executablePath = process.env.OS === "macos" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "";
//     const browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: false,
//         timeout: 0,
//         protocolTimeout: 0,
//         userDataDir: "./tmp",
//         executablePath,
//     });
//     const page = await browser.newPage();

//     await page.goto(process.env.TARGET_URL, { waitUntil: "networkidle0", timeout: 60000 });
//     await page.setViewport({ width: 1820, height: 1080 });

//     const baseMainContentSelector = "#main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-captcha>app-captcha";
//     const captchaImgSelector = baseMainContentSelector + ">app-ultimate-captcha>div>div:nth-child(2)>img";

//     const captchaSrc = await page.$eval(captchaImgSelector, img => img.src);
//     const base64Data = captchaSrc.split(',')[1]; // Извлекаем только часть с данными
//     const buffer = Buffer.from(base64Data, 'base64'); // Декодируем Base64 в буфер

//     // Сохраняем изображение в локальную папку
//     const imagePath = "./screenshots/captcha.png"; // Путь к файлу
//     fs.writeFileSync(imagePath, buffer); // Записываем буфер в файл

//     // Опционально: обрабатываем изображение с помощью Jimp (например, для увеличения контрастности)
//     const image = await Jimp.read(imagePath);
//     image
//         .greyscale() // Преобразование в черно-белое
//         .contrast(1) // Увеличение контрастности
//         .writeAsync(imagePath); // Сохраняем обработанное изображение

//     // Распознаем текст с сохраненного изображения
//     const captcha = await Tesseract.recognize(
//         imagePath, // Путь к локальному файлу
//         "eng",
//         { logger: m => console.log("Captcha : ", m) } // Логирование процесса
//     ).then(({ data: { text } }) => {
//         console.log({ text });
//         return text;
//     }).catch(err => console.error(err));

//     console.log({ captcha });

//     await page.locator(".mat-input-element").fill(captcha || "TEST");
//     // await page.locator(nextBtnFirstPageSelector).click();

//     // await browser.close(); // unnecessary
// }

// main();