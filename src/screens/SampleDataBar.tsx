import { addSampleData, hasSampleData, removeSampleData } from '../switch/sampleData';

type Extensions = Record<string, unknown>;

/** Lets a new player see the stats, charts and leagues full of life, and clear it again in one tap. */
export default function SampleDataBar({ extensions, onChange, offer = false }: { extensions: Extensions; onChange: (next: Extensions) => void; offer?: boolean }) {
  const active = hasSampleData(extensions);
  if (offer && !active) {
    return <div className="sample-bar offer"><div><strong>Want to see it with some life in it?</strong><span>Load a sample club: five players and eighteen game nights. Remove it any time.</span></div><button className="primary" onClick={() => onChange(addSampleData(extensions))}>Load sample club</button></div>;
  }
  if (!active) return null;
  return <div className="sample-bar"><span>Showing sample data. It is not your real record.</span><button className="text-link" onClick={() => onChange(removeSampleData(extensions))}>Remove sample</button></div>;
}
