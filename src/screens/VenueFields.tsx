import { KeyboardInput } from '../mobile';
import { COUNTRIES } from '../switch/places';

/** Where the night was played. Optional: a blank venue just means the night gets no passport stamp. */
export default function VenueFields({ name, country, onName, onCountry }: { name: string; country: string; onName: (value: string) => void; onCountry: (value: string) => void }) {
  return <div className="venue-fields">
    <label><span>Where are you playing? (optional)</span><KeyboardInput aria-label="Venue" value={name} placeholder="Kitchen table, The Crown, Gran's..." onChange={(event) => onName(event.target.value)} /></label>
    <label><span>Country (for your passport)</span><select aria-label="Country" value={country} onChange={(event) => onCountry(event.target.value)}>{COUNTRIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</select></label>
  </div>;
}
