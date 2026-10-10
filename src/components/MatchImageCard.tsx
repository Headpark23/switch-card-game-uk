import React, { useRef, useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Camera, Download, ShareNetwork, Check, WhatsappLogo, Crown } from '@phosphor-icons/react';
import type { Player } from '../data/initialLeagues';
import type { CardGame } from '../data/cardGames';

interface MatchImageCardProps {
  game: CardGame;
  leagueName: string;
  winner: Player | undefined;
  standings: { playerId: string; totalScore: number }[];
  players: Player[];
  notes?: string;
}

export function MatchImageCard({
  game,
  leagueName,
  winner,
  standings,
  players,
  notes,
}: MatchImageCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#053527',
      });
      const link = document.createElement('a');
      link.download = `card-companion-${game.id}-match.png`;
      link.href = dataUrl;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareCard = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#053527',
      });

      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], `card-companion-${game.id}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${winner?.name || 'Winner'} won ${game.name}!`,
            text: `Match Results: ${winner?.name} took 1st place in ${game.name} on The Card Companion!`,
            files: [file],
          });
          setIsExporting(false);
          return;
        }
      }

      // Fallback: download the image
      await handleDownloadImage();
    } catch (err) {
      console.error('Failed to share', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppTextShare = () => {
    const lines = [
      `🏆 *${game.name} Match Results* (${leagueName})`,
      `🥇 1st: ${winner?.name} (${standings[0]?.totalScore ?? 0} pts)`,
    ];
    standings.slice(1).forEach((st, idx) => {
      const pl = players.find(p => p.id === st.playerId);
      const medal = idx === 0 ? '🥈 2nd' : idx === 1 ? '🥉 3rd' : `#${idx + 2}`;
      lines.push(`${medal}: ${pl?.name || 'Player'} (${st.totalScore} pts)`);
    });
    if (notes) {
      lines.push(`📝 "${notes}"`);
    }
    lines.push(`Scored with The Card Companion: https://headpark23.github.io/switch-card-game-uk/`);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="match-export-container">
      {/* Visual Scorecard Image Canvas */}
      <div ref={cardRef} className="match-export-card" id="match-export-card">
        <div className="mec-header">
          <div className="mec-brand">
            <span className="mec-suits">♠️ ♥️ ♦️ ♣️</span>
            <h4>THE CARD COMPANION</h4>
          </div>
          <span className="mec-tag">OFFICIAL MATCH SCORE</span>
        </div>

        <div className="mec-match-meta">
          <span className="mec-game-title">{game.name}</span>
          <span className="mec-league">{leagueName}</span>
        </div>

        <div className="mec-winner-badge">
          <Crown size={28} weight="fill" color="#ffd166" />
          <div className="mec-winner-info">
            <span className="mec-winner-sub">MATCH CHAMPION</span>
            <span className="mec-winner-name">
              {winner?.avatar} {winner?.name}
            </span>
          </div>
          <span className="mec-winner-score">{standings[0]?.totalScore ?? 0} pts</span>
        </div>

        <div className="mec-standings-table">
          <div className="mec-table-header">
            <span>Rank</span>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Score</span>
          </div>
          {standings.map((st, idx) => {
            const pl = players.find(p => p.id === st.playerId);
            const rankLabel = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `${idx + 1}th`;
            return (
              <div key={st.playerId} className={`mec-row ${idx === 0 ? 'highlight' : ''}`}>
                <span className="mec-rank">{rankLabel}</span>
                <span className="mec-player">
                  <span className="mec-avatar">{pl?.avatar}</span>
                  {pl?.name}
                </span>
                <span className="mec-score">{st.totalScore} pts</span>
              </div>
            );
          })}
        </div>

        {notes && (
          <div className="mec-notes">
            <em>"{notes}"</em>
          </div>
        )}

        <div className="mec-footer">
          <span>Logged live on The Card Companion</span>
          <span className="mec-url">headpark23.github.io/switch-card-game-uk</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mec-actions">
        <button
          className="mec-btn-primary"
          onClick={handleDownloadImage}
          disabled={isExporting}
        >
          {downloadSuccess ? (
            <>
              <Check size={18} weight="bold" color="#25D366" />
              <span>Scorecard Saved!</span>
            </>
          ) : (
            <>
              <Camera size={18} weight="bold" />
              <span>{isExporting ? 'Generating Image...' : 'Save Scorecard Image'}</span>
            </>
          )}
        </button>

        <button
          className="mec-btn-whatsapp"
          onClick={handleWhatsAppTextShare}
        >
          <WhatsappLogo size={18} weight="fill" />
          <span>Send to WhatsApp Group</span>
        </button>

        {typeof navigator !== 'undefined' && !!navigator.share && (
          <button
            className="mec-btn-secondary"
            onClick={handleShareCard}
            disabled={isExporting}
          >
            <ShareNetwork size={18} weight="bold" />
            <span>Share Image</span>
          </button>
        )}
      </div>
    </div>
  );
}
