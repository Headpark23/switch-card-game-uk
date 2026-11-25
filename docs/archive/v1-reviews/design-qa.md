# Switch design QA

**Source visual truth**

- `C:\Users\headp\Documents\Codex\2026-09-30\new-chat\outputs\switch-review\concept-1.png`
- Source pixels: 853 × 1844

**Rendered implementation**

- Local URL: `http://127.0.0.1:4173/`
- Screenshot: `C:\Users\headp\Documents\Codex\2026-09-30\new-chat\outputs\switch-app\implementation-home.png`
- Comparison image: `C:\Users\headp\Documents\Codex\2026-09-30\new-chat\outputs\switch-app\design-qa-comparison.png`
- Implementation pixels: 393 × 852
- CSS phone screen: 393 × 852 at device scale factor 1
- Browser viewport used for the one-to-one capture: 1400 × 1200
- Density normalization: the 853 × 1844 source was proportionally reduced to 393 pixels wide and centred on a 393 × 852 canvas. Both normalized views were enlarged equally for the combined comparison; no conclusions were based on the enlargement.

**State**

- iPhone preview, Learn home, initial scroll position, keyboard closed, no sheet or dialog open.
- Pixel 10 was checked separately for layout, navigation and keyboard dismissal.

**Full-view comparison evidence**

- The combined comparison confirms the same cream, forest-green and muted-gold art direction, editorial display type, photographic card-table hero, strong primary action and four-tab navigation.
- The implementation preserves the source hierarchy: brand, promise, explanatory copy, primary and secondary actions, power-card introduction and persistent navigation.
- The implementation intentionally uses a live device status area and shorter home-card summaries. Detailed rule copy is available through the card controls, keeping text readable and tap targets usable at 393 CSS pixels.
- No actionable P0, P1 or P2 difference remains. The slightly taller live-device hero and reduced above-the-fold rule detail are accepted product constraints for legibility and device chrome rather than accidental design drift.

**Focused-region comparison evidence**

- The comparison was rendered at twice the normalized dimensions so the hero typography, logo treatment, card art, dividers, buttons and navigation could be inspected together without a separate crop.
- The generated hero remains sharp at the phone viewport. Local playing-card assets have clean edges and correct suits. No visible asset has been replaced by an emoji, placeholder or CSS approximation.

**Required fidelity surfaces**

- Fonts and typography: DM Serif Display and DM Sans retain the editorial contrast and hierarchy of the source. Display wrapping, body line length, button labels and small navigation text remain readable without clipping.
- Spacing and layout rhythm: the 393 × 852 screen has consistent gutters, vertical section rhythm, dividers and tappable controls. Persistent navigation stays visible on iPhone and Pixel.
- Colors and visual tokens: cream backgrounds, dark forest text/actions and gold accents are consistent across the hero, dividers, active navigation and controls, with usable contrast.
- Image quality and asset fidelity: the hero crop matches the approved direction and the card assets remain sharp. The composition stays coherent across iPhone and Pixel crops.
- Copy and content: the instructional promise remains concise. Power-card labels are more explicit where useful (for example, “Black kings”), and detailed rules remain accessible by tap.

**Findings**

- No actionable P0, P1 or P2 findings.
- [P3] The approved concept shows more rule-detail copy and a demo advertisement in the first viewport. The implementation prioritises larger readable type and tap targets, so those details continue below the first viewport or behind card controls. Revisit only if future user testing shows people do not discover the card controls or advertisement.

**Comparison history**

- Final comparison: passed on the first source-versus-implementation visual pass; no visual fix was required.
- Pre-QA mobile validation found that focus could scroll the outer simulated device and expose the keyboard area. The app now clips outer device overflow and resets that container during view/state changes. Post-fix evidence showed zero outer scroll, a clean header, and keyboard dismissal when moving from Questions to Learn on both device previews.

**Primary interactions tested**

- All eight tutorial steps, including correct and incorrect responses.
- Rule search with “ace”, result filtering and keyboard dismissal.
- Power-card rule sheet for black kings.
- Game-mode expansion.
- Learn, Cards, Modes and Questions navigation.
- iPhone and Pixel 10 responsive previews.
- Download-rules control was present; no browser download was triggered during visual QA.

**Technical verification**

- Browser console warnings/errors: none.
- Protected mobile runtime integrity: passed (28 files).
- Production build: passed.
- Sites packaging tests: 4 passed.
- Mobile runtime Playwright tests: 8 passed.

**Implementation checklist**

- [x] Preserve the approved visual direction.
- [x] Prevent outer-device focus scrolling.
- [x] Verify keyboard dismissal and persistent navigation on iPhone and Pixel.
- [x] Confirm runtime integrity, production build and automated tests.
- [x] Keep live advertising as a clearly labelled demo placement until a compliant ad provider is integrated.

final result: passed
