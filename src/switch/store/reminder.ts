/** A calendar invite for a physical Switch night, with an alert an hour before and a reminder to bring the cards. */
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const stampUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

export const BRING_LIST = ["A pack of 52 cards (or two for a big table)", "Paper and a pen, or this app, for scores", "Snacks"];

export function buildNightInvite(start: Date, title = "Switch card night", hours = 2, now: Date = new Date()): string {
  const end = new Date(start.getTime() + hours * 3_600_000);
  const description = `Bring: ${BRING_LIST.join("; ")}.\nRules, scores and trophies: https://switchcardgame.co.uk`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Switch Card Night//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:switch-${start.getTime()}@switchcardgame.co.uk`, `DTSTAMP:${stampUtc(now)}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escape(title)}`, `DESCRIPTION:${escape(description)}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Switch night in an hour. Bring the cards!", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
