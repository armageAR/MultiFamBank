// Shared Playwright helpers. Credentials come only from env vars, never from files.
import {chromium} from 'playwright';

export const CLIENT_URL = 'https://client.dev.fambank.armage.tech';
export const BANK_URL = 'https://bank.dev.fambank.armage.tech';
export const MOBILE = {width: 390, height: 844};
export const DESKTOP = {width: 1280, height: 800};

export function creds(prefix) {
	const email = process.env[`${prefix}_EMAIL`];
	const password = process.env[`${prefix}_PASS`];
	if (!email || !password) throw new Error(`Missing ${prefix}_EMAIL / ${prefix}_PASS env vars`);
	return {email, password};
}

export async function open(viewport) {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport,
		deviceScaleFactor: 2,
		locale: 'es-AR',
		serviceWorkers: 'block',
		timezoneId: 'America/Argentina/Buenos_Aires',
		isMobile: viewport.width < 600,
		hasTouch: viewport.width < 600,
	});
	return {browser, context, page: await context.newPage()};
}

export async function login(page, baseUrl, {email, password}) {
	await prepare(page, baseUrl);
	await page.goto(`${baseUrl}/ingresar`, {waitUntil: 'networkidle'});
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña').fill(password);
	await page.getByRole('button', {name: 'Ingresar'}).click();
	await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), {timeout: 20000});
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1500);
}

const ICONS = {
	[CLIENT_URL]: new URL('../public/brand/client-icon.svg', import.meta.url),
	[BANK_URL]: new URL('../public/brand/bank-icon.svg', import.meta.url),
};

/** Removes the staging-only markers so captures look like the real product. */
const cleanStaging = () => {
	const clean = () => {
		document.querySelectorAll('header').forEach((h) => (h.style.borderTop = 'none'));
		document.querySelectorAll('span, p, div').forEach((el) => {
			if (el.children.length) return;
			const t = el.textContent.trim();
			if (/^staging$/i.test(t) || t === 'notif. bloqueadas' || /Entorno de pruebas/.test(t)) el.style.display = 'none';
		});
	};
	new MutationObserver(clean).observe(document, {subtree: true, childList: true, characterData: true});
	document.addEventListener('DOMContentLoaded', clean);
};

export async function prepare(page, baseUrl) {
	const fs = await import('node:fs');
	const svg = fs.readFileSync(ICONS[baseUrl], 'utf8');
	await page.route('**/favicon.svg', (route) => route.fulfill({contentType: 'image/svg+xml', body: svg}));
	await page.addInitScript(cleanStaging);
}
