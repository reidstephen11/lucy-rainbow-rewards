// Tweaks UI for Lucy's Rainbow v2
// Wires controls to window.LucyApp setters defined in app-v2.js.

const LUCY_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "morning",
  "accent": "#ff7aa2",
  "motion": "normal",
  "showStats": true,
  "showFootnote": true
}/*EDITMODE-END*/;

function LucyTweaks() {
  const [t, setTweak] = useTweaks(LUCY_TWEAK_DEFAULTS);

  // Apply current values on mount + whenever they change.
  React.useEffect(() => { window.LucyApp?.setTheme(t.theme); }, [t.theme]);
  React.useEffect(() => { window.LucyApp?.setAccent(t.accent); }, [t.accent]);
  React.useEffect(() => { window.LucyApp?.setMotion(t.motion); }, [t.motion]);
  React.useEffect(() => { window.LucyApp?.setShowStats(t.showStats); }, [t.showStats]);
  React.useEffect(() => { window.LucyApp?.setShowFootnote(t.showFootnote); }, [t.showFootnote]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme" />
      <TweakRadio
        label="Mood"
        value={t.theme}
        options={['morning', 'twilight', 'meadow']}
        onChange={(v) => setTweak('theme', v)}
      />
      <TweakColor
        label="Accent"
        value={t.accent}
        options={['#ff7aa2', '#f6a96b', '#7d9bff', '#6ec39c', '#c77dff']}
        onChange={(v) => setTweak('accent', v)}
      />

      <TweakSection label="Motion" />
      <TweakRadio
        label="Pace"
        value={t.motion}
        options={['calm', 'normal', 'lively']}
        onChange={(v) => setTweak('motion', v)}
      />

      <TweakSection label="Layout" />
      <TweakToggle
        label="Show stats trio"
        value={t.showStats}
        onChange={(v) => setTweak('showStats', v)}
      />
      <TweakToggle
        label="Show footnote"
        value={t.showFootnote}
        onChange={(v) => setTweak('showFootnote', v)}
      />
    </TweaksPanel>
  );
}

const lucyTweaksRoot = document.createElement('div');
document.body.appendChild(lucyTweaksRoot);
ReactDOM.createRoot(lucyTweaksRoot).render(<LucyTweaks />);
