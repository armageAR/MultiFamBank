import fs from 'node:fs';
import {open, login, creds, CLIENT_URL, BANK_URL, MOBILE, DESKTOP} from './lib.mjs';

const out = process.argv[2];
fs.mkdirSync(out, {recursive: true});

for (const [name, url, who, vp] of [
	['client-m', CLIENT_URL, 'JACINTA', MOBILE],
	['bank-m', BANK_URL, 'BANK', MOBILE],
	['bank-d', BANK_URL, 'BANK', DESKTOP],
]) {
	const {browser, page} = await open(vp);
	await login(page, url, creds(who));
	await page.screenshot({path: `${out}/${name}.png`, fullPage: true});
	fs.writeFileSync(`${out}/${name}.txt`, await page.innerText('body'));
	await browser.close();
	console.log('ok', name);
}
