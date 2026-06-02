import { useEffect, useMemo, useState } from 'react';
import { analyzeGame, launchProfile, recommendPlans } from '../api/tauri';
import { RecommendationCard } from '../components/RecommendationCard';
import type { GameAnalysis, LaunchProfile } from '../types/game';
import type { LaunchConfig, LaunchResult, Recommendation } from '../types/recommendation';

type ProfileConfigState = Record<string, LaunchConfig>;

function defaultConfig(profile?: LaunchProfile): LaunchConfig {
  const config: LaunchConfig = {};
  for (const field of profile?.config_fields ?? []) config[field.id] = field.default_value ?? '';
  return config;
}

const capabilityLabels: Record<string, string> = {
  native_lan_ip: '?? LAN/IP ??',
  hidden_dedicated_server: '?? / ?????',
  lan_discovery_broadcast: '???????',
  tcp_udp_proxy_possible: '???????',
  community_mod: '?? Mod ??',
  official_only: '??? / ????',
  unsupported: '??????',
  unknown: '?????????'
};

const methodLabels: Record<string, string> = {
  virtual_lan: '?????',
  dedicated_server_launcher: '??????',
  broadcast_bridge: '???',
  port_proxy: '????',
  mod_installer: 'Mod ???',
  steam_relay_plugin: 'Steam Relay ??',
  manual_guide: '????',
  not_supported: '???'
};

const sourceLabels: Record<string, string> = {
  builtin: '?????',
  registry: '??????',
  custom: '????????',
  steam_scan: 'Steam ????'
};

const methodOrder = [
  'virtual_lan',
  'dedicated_server_launcher',
  'broadcast_bridge',
  'port_proxy',
  'mod_installer',
  'steam_relay_plugin',
  'manual_guide',
  'not_supported'
];

function ConversionProfileView({ analysis }: { analysis: GameAnalysis }) {
  const profile = analysis.multiplayer_conversion;
  if (!profile) {
    return (
      <article className="card error-card">
        <h3>????????</h3>
        <p>???????????????????????? / ??????</p>
      </article>
    );
  }

  return (
    <article className={profile.can_convert_to_lan ? 'card conversion-card' : 'card error-card'}>
      <div className="feature-card-title">
        <div>
          <h3>????????</h3>
          <p className="muted">???????????????????????</p>
        </div>
        <span className={profile.can_convert_to_lan ? 'badge good' : 'badge bad'}>
          {profile.can_convert_to_lan ? '???? LAN' : '??????'}
        </span>
      </div>
      <div className="status-grid compact">
        <div className="status-tile"><span>????</span><strong>{capabilityLabels[profile.capability] ?? profile.capability}</strong><small>{profile.capability}</small></div>
        <div className="status-tile"><span>????</span><strong>{profile.risk_level}</strong><small>??????</small></div>
        <div className="status-tile"><span>???</span><strong>{analysis.confidence}</strong><small>??????????</small></div>
        <div className="status-tile"><span>?????</span><strong>{sourceLabels[analysis.adapter_source ?? ''] ?? analysis.adapter_source ?? '??'}</strong><small>custom &gt; registry &gt; builtin</small></div>
      </div>

      <h4>??????</h4>
      <div className="badge-row">
        {methodOrder.map((method) => {
          const active = profile.methods.includes(method as never);
          const future = ['broadcast_bridge', 'port_proxy', 'mod_installer', 'steam_relay_plugin'].includes(method) && !active;
          return <span className={active ? 'badge good' : future ? 'badge warn' : 'badge'} key={method}>{methodLabels[method]} ? {active ? '??/??' : future ? '????' : '???'}</span>;
        })}
      </div>

      <div className="content-with-aside">
        <div>
          <h4>????</h4>
          <ul>{profile.required_components.map((component) => <li key={component}>{component}</li>)}</ul>
          <h4>????</h4>
          <ul>{profile.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
        <aside className="right-panel">
          <h3>????</h3>
          <p>??????????? / ?????Mod ???????????????????</p>
          <span className="badge warn">???????</span>
        </aside>
      </div>
    </article>
  );
}

export function RecommendationPage({ gameId }: { gameId?: string }) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [profileConfigs, setProfileConfigs] = useState<ProfileConfigState>({});
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const profilesById = useMemo(() => {
    const map = new Map<string, LaunchProfile>();
    for (const profile of analysis?.launch_profiles ?? []) map.set(profile.id, profile);
    return map;
  }, [analysis]);

  useEffect(() => {
    setLaunchResult(null);
    setLaunchError(null);
    setAnalysis(null);
    setProfileConfigs({});
    if (!gameId) { setItems([]); return; }

    Promise.all([recommendPlans(gameId), analyzeGame(gameId)])
      .then(([recommendations, nextAnalysis]) => {
        setItems(recommendations);
        setAnalysis(nextAnalysis);
        const nextConfigs: ProfileConfigState = {};
        for (const profile of nextAnalysis.launch_profiles) nextConfigs[profile.id] = defaultConfig(profile);
        setProfileConfigs(nextConfigs);
      })
      .catch((error) => { setItems([]); setLaunchError(String(error)); });
  }, [gameId]);

  const updateConfigValue = (profileId: string, fieldId: string, value: string | boolean) => {
    setProfileConfigs((current) => ({ ...current, [profileId]: { ...(current[profileId] ?? {}), [fieldId]: value } }));
  };

  const runLaunchProfile = (profileId: string) => {
    if (!gameId) { setLaunchError('???????'); return; }
    setIsLaunching(true);
    setLaunchError(null);
    setLaunchResult({ ok: true, message: `????????${profileId} ...` });
    launchProfile(gameId, profileId, profileConfigs[profileId] ?? {})
      .then(setLaunchResult)
      .catch((error) => { setLaunchResult(null); setLaunchError(String(error)); })
      .finally(() => setIsLaunching(false));
  };

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">RECOMMENDATION</span>
          <h2>????</h2>
          <p className="muted">???????????????? / ??????</p>
        </div>
        <span className="badge warn">??????</span>
      </div>

      <article className="card pending-feature">
        <h3>????????</h3>
        <p>??????????????????????????????????????????????????????????????????????????????</p>
        <ol>
          <li>?????? n2n / Radmin / ??????????? IP ????</li>
          <li>??????????? Dedicated Server???????? PID ???</li>
          <li>????????? LAN / IP ????????? IP ??????</li>
          <li>?????? LAN/IP/?????????????????????Mod ????????</li>
        </ol>
      </article>

      {analysis && (
        <article className="card">
          <h3>????</h3>
          <div className="status-grid">
            <div className="status-tile"><span>??</span><strong>{analysis.display_name}</strong><small>{analysis.game_id}</small></div>
            <div className="status-tile"><span>??</span><strong>{analysis.detected_path ?? '????'}</strong><small>????</small></div>
            <div className="status-tile"><span>???</span><strong>{sourceLabels[analysis.adapter_source ?? ''] ?? analysis.adapter_source ?? '??'}</strong><small>??</small></div>
            <div className="status-tile"><span>????</span><strong>{analysis.default_ports.join(', ') || '-'}</strong><small>??????</small></div>
          </div>
        </article>
      )}

      {analysis && <ConversionProfileView analysis={analysis} />}

      <article className="card">
        <h3>??????</h3>
        <div className="feature-grid">
          {['?????', '???????', '????', '?????'].map((title, index) => (
            <div className="status-tile" key={title}><span>?? {index + 1}</span><strong>{title}</strong><small>?????</small></div>
          ))}
        </div>
      </article>

      {items.length === 0 ? <article className="card empty-state"><h3>????</h3><p className="muted">???????????????</p></article> : items.map((item) => {
        const profile = item.launch_profile_id ? profilesById.get(item.launch_profile_id) : undefined;
        return (
          <article className="card" key={item.id}>
            <RecommendationCard item={item} launchProfileType={profile?.type} onLaunch={gameId && item.launch_profile_id ? () => runLaunchProfile(item.launch_profile_id as string) : undefined} disabled={isLaunching} />
            {profile?.config_fields && profile.config_fields.length > 0 && (
              <div className="config-panel">
                <h4>???????</h4>
                {profile.config_fields.map((field) => (
                  <label key={field.id}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    {field.type === 'select' ? (
                      <select value={String(profileConfigs[profile.id]?.[field.id] ?? field.default_value ?? '')} onChange={(event) => updateConfigValue(profile.id, field.id, event.target.value)}>
                        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <input type="checkbox" checked={Boolean(profileConfigs[profile.id]?.[field.id])} onChange={(event) => updateConfigValue(profile.id, field.id, event.target.checked)} />
                    ) : (
                      <input type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'} value={String(profileConfigs[profile.id]?.[field.id] ?? field.default_value ?? '')} onChange={(event) => updateConfigValue(profile.id, field.id, event.target.value)} />
                    )}
                    {field.help && <small className="muted">{field.help}</small>}
                  </label>
                ))}
                <p className="muted">????????????????????</p>
              </div>
            )}
          </article>
        );
      })}

      {launchError && <article className="card error-card"><h3>????</h3><p>{launchError}</p></article>}
      {launchResult && <article className="card"><h3>{launchResult.ok ? '????' : '????'}</h3><p>{launchResult.message}</p></article>}

      <article className="card">
        <h3>??????</h3>
        <div className="filter-list">
          <span className="future-chip">Steam Relay ??</span><span className="future-chip">???</span><span className="future-chip">????</span><span className="future-chip">Mod ???</span>
        </div>
      </article>
    </section>
  );
}
