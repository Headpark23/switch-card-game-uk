# Switch rules experience review

## Overall verdict

The original app contains the complete rule set and a useful five-step flow, but splits the teaching experience across static rule cards, a separate flow diagram and a separate simulation. The redesigned app previously led with brand imagery and placed most rule detail behind search or card-reference screens. The updated experience combines the strongest material into one rules-first, interactive narrative and carries players directly into the guided computer game.

## Steps reviewed

1. **Original rule categories — Content healthy; presentation passive.**
   - Evidence: `rules-audit/01-original-rules.png`
   - The setup, turn, chain-reaction, Last Card and finishing rules are complete and clearly grouped.
   - Long desktop cards require scanning and do not form a continuous teaching story on a phone.

2. **Original game flow — Narrative healthy; interaction limited.**
   - Evidence: `rules-audit/02-original-game-flow.png`
   - The five-step sequence gives beginners a useful mental model from dealing to winning.
   - The flow is vertically long and primarily illustrative, with no immediate practice or explanation of mistakes.

3. **Original simulation — Useful example; disconnected from the rules.**
   - Evidence: `rules-audit/03-original-simulation.png`
   - Previous and next controls help explain a sample turn.
   - It is separate from the core rules and does not let the learner choose a card or receive contextual guidance.

4. **Previous redesigned home — Visually strong; rules lacked prominence.**
   - Evidence: `rules-audit/04-current-home.png`
   - The cream, green and gold direction and card imagery are polished.
   - The first viewport emphasised brand, the game button and three power-card shortcuts. The complete game narrative remained several interactions away.

5. **Updated rules-first home — Healthy.**
   - Evidence: `rules-first-home.png`
   - Rules are now the first navigation destination and the opening headline explicitly frames them as the product’s main purpose.
   - Five interactive chapters teach Deal, Play, Power, Call and Win with real card assets, concise explanations, checklist rules and contextual tips.
   - Players can search for a specific answer or move directly into the rules-enforcing computer game.

## Accessibility checks and limits

- Chapter controls are real buttons with a visible selected state and an `aria-current` indicator.
- Headings provide a clear content hierarchy, rule points use readable text, and controls retain visible focus styling.
- The full rules flow was checked at iPhone and Pixel 10 sizes, but screenshots alone cannot prove compatibility with every screen reader or dynamic text-size setting.

## Highest-impact changes completed

- Made Rules the primary bottom-navigation destination.
- Reframed the opening screen around learning the rules.
- Combined the original rules, flow and simulation concepts into five interactive chapters.
- Added clear examples for setup, matching, multi-card play, aces, twos, eights, kings, sevens, jacks, Last Card and legal finishing.
- Connected the narrative directly to rule search and the guided computer game.
