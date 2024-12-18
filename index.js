import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";

import { config } from "dotenv";
import { getFormattedDate, sleep } from "./utils.js";
import mailService from "./mailService.js";

config();

async function main() {
    try {
        // const executablePath = process.env.OS === "macos" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "";
        const browser = await puppeteer.launch({
            headless: process.env.SHOW_BROWSER === "1" ? false : true, // true - to hide browser / false
            defaultViewport: false,
            timeout: 0,
            protocolTimeout: 0,
            // userDataDir: "./tmp",
            // executablePath,
        });
        const page = await browser.newPage();

        await page.goto(process.env.TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.setViewport({ width: 1820, height: 1080 });

        const baseFirstPageSelector = "#main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-captcha>app-captcha";
        const nextBtnFirstPageSelector = baseFirstPageSelector + ">div>div:nth-child(2)>app-button-control>button";
        const captchaImgSelector = baseFirstPageSelector + ">app-ultimate-captcha>div>div:nth-child(2)>img";

        const baseSecondPageSelector = "#main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-data>app-poles-card-reservation-appointment-form>form>div>div";
        const textAccessDeniedSelector = baseSecondPageSelector + ">div";
        const nextBtnSecondPageSelector = baseSecondPageSelector + ">div:last-child>app-button-control";

        const firstAppSelectSelector = baseSecondPageSelector + ">app-select-control:nth-child(1)>mat-form-field>div>div";
        const secondAppSelectSelector = baseSecondPageSelector + ">app-select-control:nth-child(2)>mat-form-field>div>div";
        const thirdAppSelectSelector = baseSecondPageSelector + ">app-select-control:nth-child(3)>mat-form-field>div>div";
        const fourthAppSelectSelector = baseSecondPageSelector + ">app-select-control:nth-child(4)>mat-form-field>div>div";
        const fifthAppSelectSelector = baseSecondPageSelector + ">app-select-control:nth-child(5)>mat-form-field>div>div";

        const firstAppOption = `#mat-option-${process.env.TYPE_NUM || "3"} > span`;
        const secondAppOption = `#mat-option-13 > span`;
        const thirdAppOption = `#mat-option-5 > span`;
        const fourthAppOption = `#mat-option-14>span`;

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

        async function solveCaptcha() {
            await sleep(1.2);
            await page.waitForSelector(baseFirstPageSelector);
            await page.screenshot(screenshotOptions);

            let attempts = 0;
            const maxAttempts = 15;

            while (attempts < maxAttempts) {
                const captcha = await Tesseract.recognize(
                    "./screenshots/default-screenshot.png",
                    "eng",
                    {
                        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&@+=-",
                    }
                ).then(({ data: { text } }) => {
                    return text;
                }).catch(err => {
                    console.error(err.message);
                    return null;
                });

                await page.locator(".mat-input-element").fill(captcha || "TEST");
                await page.locator(nextBtnFirstPageSelector).click();
                await sleep(1.2);

                const isCaptchaIncorrect = await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    return element && element.textContent.includes("Weryfikacja obrazkowa");
                }, baseFirstPageSelector + ">app-ultimate-captcha>div>div");

                if (!isCaptchaIncorrect) return console.log(`Captcha Solved :)`);

                console.log(`Incorrect captcha :( Trying again...`);
                attempts++;
                await page.screenshot(screenshotOptions);
                await sleep(.5);
            }

            console.log(`Failed to solve captcha after ${maxAttempts} attempts. Restarting process...`);
            await browser.close();
            await sleep(1);
            return main();
        }

        async function selectFifthAppOption() {
            const options = [
                `#mat-option-14>span`,
                `#mat-option-15>span`,
                `#mat-option-16>span`,
                `#mat-option-17>span`,
                `#mat-option-18>span`
            ];

            await page.locator(fifthAppSelectSelector).click()
                .catch(err => console.error(err.message));

            for (const option of options) {
                const element = await page.$(option);
                if (element) {
                    await page.locator(option).click().catch(err => console.error(err.message));
                    return;
                }
            }

            console.log(`No available options found for fifthAppOption.`);
        }

        await solveCaptcha();
        await sleep(1);

        await page.locator(firstAppSelectSelector).click()
            .then(() => page.locator(firstAppOption).click())
            .catch(err => console.error(err.message));

        await page.locator(secondAppSelectSelector).click()
            .then(() => page.locator(secondAppOption).click())
            .catch(err => console.error(err.message));

        await page.locator(thirdAppSelectSelector).click()
            .then(() => page.locator(thirdAppOption).click())
            .catch(err => console.error(err.message));

        await sleep(2);

        try {
            await page.waitForFunction(
                (selector) => !!document.querySelector(selector).textContent.includes("Aktualnie wszystkie wizyty zostały zarezerwowane"),
                { timeout: 2200 },
                textAccessDeniedSelector
            );

            console.log(`No vacant time for this type. Restarting proccess...`);
            await browser.close();
            await sleep(1);
            return main();
        } catch (err) {
            console.log(`STATUS : OK\n${err.message}`);
        }

        await page.screenshot({ path: `./screenshots/alert-screenshot.png`, fullPage: true });

        try {
            await mailService.sendAlertMail(`alert-screenshot.png`);
        } catch (err) {
            console.error("An error occurred while sending email\n", err.message);
        }

        await page.locator(fourthAppSelectSelector).click()
            .then(() => page.locator(fourthAppOption).click())
            .catch(err => console.error(err.message));

        await sleep(.8);

        await selectFifthAppOption().catch(err => console.error(err.message));

        await page.locator(nextBtnSecondPageSelector).click().catch(err => console.error(err.message));
        await sleep(1.9);

        const baseThirdPageSelector = "#main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-page>div>app-poles-card-form>form";
        const thirdPageFormSelector = baseThirdPageSelector + ">app-poles-card-personal-data>fieldset";

        const thirdPageSurnameInputSelector = thirdPageFormSelector + ">div:nth-child(2)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageNameInputSelector = thirdPageFormSelector + ">div:nth-child(3)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageDOBInputSelector = thirdPageFormSelector + ">div:nth-child(4)>div>app-date-control>mat-form-field>div>div>div:nth-child(3)>input";
        const thirdPageCitizenshipInputSelector = thirdPageFormSelector + ">div:nth-child(5)>div>app-select-control>mat-form-field>div>div>div:last-child>mat-select";
        const thirdPageCitizenshipDropdownInputSelector = `#mat-option-414>span`;
        const thirdPageGenderInputSelector = thirdPageFormSelector + `>div:nth-child(6)>div>app-radio-control>div>mat-radio-group>div:nth-child(${process.env.GENDER === "male" ? "1" : "2"})>mat-radio-button>label>span`;
        const thirdPagePassportNumberInputSelector = thirdPageFormSelector + ">div:nth-child(7)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageStreetInputSelector = thirdPageFormSelector + ">div:nth-child(9)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageHouseNumberInputSelector = thirdPageFormSelector + ">div:nth-child(10)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageApartNumberInputSelector = thirdPageFormSelector + ">div:nth-child(11)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPagePostcodeInputSelector = thirdPageFormSelector + ">div:nth-child(12)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageCityInputSelector = thirdPageFormSelector + ">div:nth-child(13)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPagePhoneNumberPrefixInputSelector = thirdPageFormSelector + ">div:nth-child(14)>div:nth-child(1)>app-autocomplete-control>mat-form-field>div>div>div:nth-child(3)>input";
        const thirdPagePhoneNumberInputSelector = thirdPageFormSelector + ">div:nth-child(14)>div:nth-child(2)>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageEmailInputSelector = thirdPageFormSelector + ">div:nth-child(17)>div>app-text-control>mat-form-field>div>div>div:last-child>input";
        const thirdPageDescriptionInputSelector = thirdPageFormSelector + ">div:nth-child(18)>div>app-textarea-control>mat-form-field>div>div>div:last-child>textarea";

        const pN = process.env.PHONE_NUMBER || "";
        const phoneNumberPrefix = pN.slice(0, 2);
        const phoneNumber = pN.slice(2);

        const checkBoxSelector = baseThirdPageSelector + ">div:nth-child(2)>app-checkbox-control>mat-checkbox>label>span";
        const nextBtnThirdPageSelector = baseThirdPageSelector + ">div:nth-child(4)>div>button:nth-child(2)";
        const nextFinBtnThirdPageSelector = baseThirdPageSelector + ">div:nth-child(4)>div:last-child>button";

        async function selectCitizenship() {
            await page.locator(thirdPageCitizenshipInputSelector).click().catch(err => console.error(err.message));

            for (let i = 410; i <= 440; i++) {
                const optionSelector = `#mat-option-${i}>span`;

                const isMatch = await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.includes("ROSJA") : false;
                }, optionSelector);

                if (isMatch) {
                    await page.locator(optionSelector).click().catch(err => console.error(err.message));
                    console.log(`Selected citizenship option: ${optionSelector}`);
                    return;
                }
            }

            console.log(`No matching citizenship option found.`);
        }

        await sleep(.5);

        await page.locator(thirdPageSurnameInputSelector).fill(process.env.SURNAME).catch(err => console.error(err.message));
        await sleep(.5);
        await page.locator(thirdPageNameInputSelector).fill(process.env.NAME).catch(err => console.error(err.message));
        await page.locator(thirdPageDOBInputSelector).fill(process.env.DATE_OF_BIRTH).catch(err => console.error(err.message));
        await page.locator(thirdPageGenderInputSelector).click().catch(err => console.error(err.message));
        await page.locator(thirdPagePassportNumberInputSelector).fill(process.env.PASSPORT_NUMBER).catch(err => console.error(err.message));
        await page.locator(thirdPageStreetInputSelector).fill(process.env.STREET).catch(err => console.error(err.message));
        await page.locator(thirdPageHouseNumberInputSelector).fill(process.env.HOUSE_NUMBER).catch(err => console.error(err.message));
        await sleep(.4);
        await page.locator(thirdPageApartNumberInputSelector).fill(process.env.APART_NUMBER).catch(err => console.error(err.message));
        await page.locator(thirdPagePostcodeInputSelector).fill(process.env.POSTCODE).catch(err => console.error(err.message));
        await page.locator(thirdPageCityInputSelector).fill(process.env.CITY).catch(err => console.error(err.message));
        await page.locator(thirdPagePhoneNumberPrefixInputSelector).fill(phoneNumberPrefix).catch(err => console.error(err.message));
        await page.locator(thirdPagePhoneNumberInputSelector).fill(phoneNumber).catch(err => console.error(err.message));
        await page.locator(thirdPageEmailInputSelector).fill(process.env.EMAIL).catch(err => console.error(err.message));
        await page.locator(thirdPageDescriptionInputSelector).fill(process.env.DESCRIPTION).catch(err => console.error(err.message));
        await sleep(.8);
        await selectCitizenship();

        await sleep(1.5);

        await page.locator(checkBoxSelector).click().catch(err => console.error(err.message));
        await sleep(1.5);
        await page.locator(nextBtnThirdPageSelector).click().catch(err => console.error(err.message));
        await sleep(2);
        await page.locator(nextFinBtnThirdPageSelector).click().catch(err => console.error(err.message));
        await sleep(4.5);
        const formattedDate = getFormattedDate();
        const finalScreenshotName = `final-page-screenshot-${formattedDate}.png`;
        await page.screenshot({ path: `./screenshots/${finalScreenshotName}` });

        try {
            await mailService.sendAlertMail(finalScreenshotName, "Запись в посольство | Статус : Успешно", "Запись в посольство польши успешно создана, скриншот прикреплен к письму!");
        } catch (err) {
            console.error("An error occurred while sending email\n", err.message);
        }

        await sleep(5);
        await browser.close();
    } catch (err) {
        console.error(err.message);
        await sleep(2);
        return main();
    }
}

main();

// .mat-input-element.mat-form-field-autofill-control.ng-tns-c81-1.ng-untouched.ng-pristine.ng-invalid.cdk-text-field-autofill-monitored
// .mat-focus-indicator.mat-button.mat-button-base
// #main-content > app-dashboard > app-institutions > app-institutions > app-poles-card > div > app-poles-card-reservation-appointment-page > div > div > app-poles-card-reservation-appointment-captcha > app-captcha > div > div.d-flex>app-button-control>button

// 1 page - #main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-captcha>app-captcha
// 2 page - #main-content>app-dashboard>app-institutions>app-institutions>app-poles-card>div>app-poles-card-reservation-appointment-page>div>div>app-poles-card-reservation-appointment-data>app-poles-card-reservation-appointment-form>form>div>div
// #cdk-overlay-3>div>div>mat-option:nth-child(2)