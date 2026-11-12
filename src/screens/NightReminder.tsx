import { useState } from 'react';
import { BottomSheet } from '../mobile';
import { BRING_LIST, buildNightInvite } from '../switch/reminder';

const TIMES: [string, number, number][] = [['6:30pm', 18, 30], ['7pm', 19, 0], ['7:30pm', 19, 30], ['8pm', 20, 0]];

export default function NightReminder({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [dayOffset, setDayOffset] = useState(1);
  const [time, setTime] = useState(2);
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() + index); return d; });
  function save() {
    const start = new Date(days[dayOffset]); start.setHours(TIMES[time][1], TIMES[time][2], 0, 0);
    const url = URL.createObjectURL(new Blob([buildNightInvite(start)], { type: 'text/calendar' }));
    const link = document.createElement('a'); link.href = url; link.download = 'switch-night.ics'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <BottomSheet open={open} onOpenChange={onOpenChange} title="Plan a Switch night" description="Add it to your calendar with an alert an hour before.">
    <div className="plan-night">
      <p className="plan-label">Which day?</p>
      <div className="plan-chips" role="group" aria-label="Day">{days.map((d, index) => <button key={index} aria-pressed={dayOffset === index} className={dayOffset === index ? 'active' : ''} onClick={() => setDayOffset(index)}>{index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</button>)}</div>
      <p className="plan-label">What time?</p>
      <div className="plan-chips" role="group" aria-label="Time">{TIMES.map(([label], index) => <button key={label} aria-pressed={time === index} className={time === index ? 'active' : ''} onClick={() => setTime(index)}>{label}</button>)}</div>
      <p className="plan-label">Don't forget</p>
      <ul className="plan-bring">{BRING_LIST.map((item) => <li key={item}>{item}</li>)}</ul>
      <button className="primary" onClick={save}>Add to calendar</button>
    </div>
  </BottomSheet>;
}
