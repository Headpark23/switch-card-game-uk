import { useEffect, useRef, useState } from 'react';
import { NavigationArrow } from '@phosphor-icons/react';
import { KeyboardInput } from '../mobile';
import { COUNTRIES, countryName } from '../switch/store/places';
import { detectGpsPlace, gpsAutoStampEnabled } from '../services/gpsStamp';

type Props = {
  name: string;
  country: string;
  town?: string;
  onName: (value: string) => void;
  onCountry: (value: string) => void;
  onTown?: (value: string, viaGps?: boolean) => void;
};

/** Where the night was played. Supports typing or one-tap phone GPS to stamp town and country accurately. */
export default function VenueFields({ name, country, town = '', onName, onCountry, onTown }: Props) {
  const [locating, setLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const triedAuto = useRef(false);

  async function locate(silent = false) {
    setLocating(true);
    if (!silent) setGpsStatus('Finding your town via GPS…');
    try {
      const found = await detectGpsPlace();
      onTown?.(found.town, true);
      onCountry(found.country);
      setGpsStatus(`GPS stamped: ${found.town}, ${countryName(found.country)}`);
    } catch (reason) {
      if (!silent) setGpsStatus(reason instanceof Error ? reason.message : 'Could not read GPS right now.');
    } finally {
      setLocating(false);
    }
  }

  // If the player enabled GPS auto-stamp and town is blank, fill town & country automatically.
  useEffect(() => {
    if (triedAuto.current || !onTown || town.trim() || !gpsAutoStampEnabled()) return;
    triedAuto.current = true;
    void locate(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="venue-fields">
      <label>
        <span>Where are you playing? (optional)</span>
        <KeyboardInput aria-label="Venue" value={name} placeholder="Kitchen table, The Crown, Gran's..." onChange={(event) => onName(event.target.value)} />
      </label>
      {onTown && (
        <div className="venue-town-row">
          <label>
            <span>Town or city (for your passport)</span>
            <KeyboardInput aria-label="Town or city" value={town} placeholder="York, Manchester, Palma..." onChange={(event) => onTown(event.target.value, false)} />
          </label>
          <button type="button" className="gps-fill-btn" disabled={locating} onClick={() => void locate(false)} aria-label="Use phone GPS to fill town and country">
            <NavigationArrow size={16} weight="fill" aria-hidden="true" />
            <span>{locating ? 'Locating…' : 'Use GPS'}</span>
          </button>
        </div>
      )}
      {gpsStatus && <p className="gps-note" role="status">{gpsStatus}</p>}
      <label>
        <span>Country (for your passport)</span>
        <select aria-label="Country" value={country} onChange={(event) => onCountry(event.target.value)}>
          {COUNTRIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
        </select>
      </label>
    </div>
  );
}
