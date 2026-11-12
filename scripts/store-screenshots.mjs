// Usage: node scripts/store-screenshots.mjs http://127.0.0.1:4173   (the app must be running)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const out = 'docs/store';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 520, height: 1000 }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const tap = (name, exact = false) => page.getByRole('button', { name, exact }).first().click();

await page.goto(base);
await page.evaluate(() => localStorage.setItem('switchWelcome', 'done'));
await page.reload(); await page.waitForTimeout(600);
await shot('01-home');
await tap('Quick night', true); await page.waitForTimeout(300); await shot('02-quick-night');
await page.goto(base); await page.waitForTimeout(400);
await tap('Puzzles', true); await page.waitForTimeout(300); await shot('03-puzzles');
await page.goto(`${base}/?testDeck=1&guide=1`); await page.waitForTimeout(400);
await tap('Play against the computer'); await page.waitForTimeout(1500); await shot('04-guided-game');
await page.goto(base); await page.waitForTimeout(400);
await tap('Cards', true); await page.waitForTimeout(300); await shot('05-cards');
await tap('Questions', true); await page.waitForTimeout(300); await shot('06-referee');
await browser.close();
console.log('Screenshots written to', out);
