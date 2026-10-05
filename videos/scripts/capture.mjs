// Captures FamBank screens from STAGING for the demo videos.
// Usage: BANK_EMAIL=… BANK_PASS=… JACINTA_EMAIL=… JACINTA_PASS=… node scripts/capture.mjs <phase>
//   static  read-only screens (home, dashboard, report)
//   client  creates a USD deposit request and an expense request as Jacinta (writes to staging!)
//   bank    reviews and confirms Jacinta's pending expense as the bank (writes to staging!)
//   intro   login, fingerprint lock and withdraw sheet for the new-version intro (read-only; the
//           lock lives in this browser's localStorage, with Chrome's virtual authenticator)
import fs from 'node:fs';
import {open, login, prepare, creds, CLIENT_URL, BANK_URL, MOBILE, DESKTOP} from './lib.mjs';

const SHOTS = new URL('../public/shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, {recursive: true});

const shot = async (page, name, opts = {}) => {
	await page.waitForTimeout(600);
	await page.screenshot({path: `${SHOTS}${name}.png`, ...opts});
	console.log('shot', name);
};

const EXPENSE = {amount: '30000', reason: 'Útiles del colegio'};
const DEPOSIT = {usd: '50', comment: 'Ahorro de octubre'};

async function staticPhase() {
	{
		const {browser, page} = await open(MOBILE);
		await login(page, CLIENT_URL, creds('JACINTA'));
		await shot(page, 'client-home');
		// Top of the page down to the latest movements (pending requests show first).
		await shot(page, 'client-movements', {fullPage: true, clip: {x: 0, y: 0, width: MOBILE.width, height: 1600}});
		await browser.close();
	}
	{
		const {browser, page} = await open(DESKTOP);
		await login(page, BANK_URL, creds('BANK'));
		await shot(page, 'bank-desktop-dashboard');
		await page.getByRole('button', {name: 'Reporte', exact: true}).click();
		await page.getByRole('button', {name: 'Mes anterior'}).click();
		await page.waitForLoadState('networkidle');
		await shot(page, 'bank-desktop-report', {fullPage: true});
		await page.getByRole('button', {name: 'Ver movimientos del mes'}).click();
		await page.waitForLoadState('networkidle');
		await shot(page, 'bank-desktop-month');
		await browser.close();
	}
	{
		const {browser, page} = await open(MOBILE);
		await login(page, BANK_URL, creds('BANK'));
		await shot(page, 'bank-home');
		await page.getByRole('button', {name: 'Reporte', exact: true}).click();
		await page.getByRole('button', {name: 'Mes anterior'}).click();
		await page.waitForLoadState('networkidle');
		await shot(page, 'bank-report');
		await page.getByRole('button', {name: 'Ver movimientos del mes'}).click();
		await page.waitForLoadState('networkidle');
		await shot(page, 'bank-month');
		await page.getByLabel('Cliente').selectOption({label: 'Jacinta Luis'});
		await page.waitForLoadState('networkidle');
		// Tall viewport so the whole sheet (saldo inicial → saldo final) fits; keep only the sheet.
		await page.setViewportSize({width: MOBILE.width, height: 3000});
		await shot(page, 'bank-month-jacinta', {clip: {x: 0, y: 1230, width: MOBILE.width, height: 1770}});
		await browser.close();
	}
}

async function clientPhase() {
	const {browser, page} = await open(MOBILE);
	await login(page, CLIENT_URL, creds('JACINTA'));
	await shot(page, 'client-home');

	await page.getByRole('button', {name: 'Depositar', exact: true}).click();
	await page.getByText('Se usa esta cotización').waitFor();
	await shot(page, 'client-deposit-empty');
	await page.getByRole('button', {name: 'En dólares'}).click();
	await page.getByLabel('Monto en dólares').fill(DEPOSIT.usd);
	await page.getByLabel('Comentario').fill(DEPOSIT.comment);
	await page.getByText('Equivale a').waitFor();
	await shot(page, 'client-deposit-usd');
	await page.getByRole('button', {name: 'Pedir depósito'}).click();
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1500);

	await page.getByRole('button', {name: 'Pedir dinero para un gasto'}).click();
	await page.getByLabel('Monto en pesos').waitFor();
	await shot(page, 'client-expense-empty');
	await page.getByLabel('Monto en pesos').fill(EXPENSE.amount);
	await page.getByLabel('¿Para qué es? (obligatorio)').fill(EXPENSE.reason);
	await shot(page, 'client-expense-filled');
	await page.getByRole('button', {name: 'Pedir dinero', exact: true}).click();
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1500);
	await browser.close();
}

async function bankPhase() {
	{
		const {browser, page} = await open(MOBILE);
		await login(page, BANK_URL, creds('BANK'));
		await shot(page, 'bank-pending');
		await shot(page, 'bank-pending-full', {fullPage: true});
		const card = page.locator('div.border-amber-200', {hasText: EXPENSE.reason}).first();
		await card.getByRole('button', {name: 'Revisar'}).click();
		await page.getByText('Pedido · Jacinta Luis').waitFor();
		await shot(page, 'bank-review');
		await page.getByRole('dialog').getByRole('button', {name: 'Confirmar', exact: true}).click()
			.catch(() => page.getByRole('button', {name: 'Confirmar', exact: true}).last().click());
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1500);
		await shot(page, 'bank-after-confirm');
		await browser.close();
	}
	{
		const {browser, page} = await open(DESKTOP);
		await login(page, BANK_URL, creds('BANK'));
		await shot(page, 'bank-desktop-dashboard');
		await browser.close();
	}
}

async function introPhase() {
	const {browser, context, page} = await open(MOBILE);
	// A platform authenticator that always verifies, so "Desbloqueo con huella o cara" is offered.
	const cdp = await context.newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true},
	});
	const {email, password} = creds('JACINTA');
	await prepare(page, CLIENT_URL);
	await page.goto(`${CLIENT_URL}/ingresar`, {waitUntil: 'networkidle'});
	await shot(page, 'intro-login-empty');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña').fill(password);
	await shot(page, 'intro-login-filled');
	await page.getByRole('button', {name: 'Ingresar'}).click();
	await page.getByRole('button', {name: 'Mi cuenta'}).click({timeout: 20000});
	const lockSetting = page.getByText('Desbloqueo con huella o cara');
	await lockSetting.waitFor();
	await lockSetting.scrollIntoViewIfNeeded();
	await shot(page, 'intro-account');
	await page.getByRole('button', {name: 'Activar', exact: true}).click();
	await page.getByText('Activo en este dispositivo').waitFor();
	await shot(page, 'intro-account-on');

	await page.reload({waitUntil: 'networkidle'});
	await page.getByRole('button', {name: 'Desbloquear'}).waitFor();
	await shot(page, 'intro-lock');
	await page.getByRole('button', {name: 'Desbloquear'}).click();
	await page.getByRole('button', {name: 'Depositar', exact: true}).waitFor();
	await shot(page, 'intro-home');

	await page.getByRole('button', {name: 'Retirar', exact: true}).click();
	await page.getByText('Se usa esta cotización').waitFor();
	await shot(page, 'intro-withdraw');
	await page.getByRole('button', {name: 'Cancelar'}).click();

	await shot(page, 'intro-movements', {fullPage: true, clip: {x: 0, y: 0, width: MOBILE.width, height: 1600}});
	await browser.close();
}

const phases = {static: staticPhase, client: clientPhase, bank: bankPhase, intro: introPhase};
const phase = phases[process.argv[2]];
if (!phase) throw new Error(`Phase must be one of: ${Object.keys(phases).join(', ')}`);
await phase();
