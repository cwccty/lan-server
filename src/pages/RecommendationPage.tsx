import { useEffect, useMemo, useState } from 'react';
import { analyzeGame, launchProfile, recommendPlans } from '../api/tauri';
import { RecommendationCard } from '../components/RecommendationCard';
import type { GameAnalysis, LaunchProfile } from '../types/game';
import type { LaunchConfig, LaunchResult, Recommendation } from '../types/recommendation';

type ProfileConfigState = Record<string, LaunchConfig>;

function defaultConfig(profile?: LaunchProfile): LaunchConfig {
  const config: LaunchConfig = {};
  for (const field of profile?.config_fields ?? []) {
    config[field.id] = field.default_value ?? '';
  }
  return config;
}

const capabilityLabels: Record<string, string> = {
  native_lan_ip: '原生 LAN/IP 直连',
  hidden_dedicated_server: '隐藏/独立服务端',
  lan_discovery_broadcast: '局域网广播发现',
  tcp_udp_proxy_possible: '可尝试端口代理',
  community_mod: '社区 Mod 联机',
  official_only: '仅官方/平台联机',
  unsupported: '暂不支持转换',
  unknown: '未知，需人工适配'
};

const methodLabels: Record<string, string> = {
  virtual_lan: '虚拟局域网',
  dedicated_server_launcher: '服务端启动器',
  broadcast_bridge: '广播桥',
  port_proxy: '端口代理',
  mod_installer: 'Mod 安装器',
  steam_relay_plugin: 'Steam Relay 插件',
  manual_guide: '手动说明',
  not_supported: '不支持'
};

function ConversionProfileView({ analysis }: { analysis: GameAnalysis }) {
  const profile = analysis.multiplayer_conversion;
  if (!profile) {
    return (
      <article className="card error-card">
        <h3>联机能力转换判断</h3>
        <p>该游戏还没有转换画像，暂时不能判断能否转换成本地联机。</p>
      </article>
    );
  }

  return (
    <article className={profile.can_convert_to_lan ? 'card conversion-card' : 'card error-card'}>
      <div className="feature-card-title">
        <h3>联机能力转换判断</h3>
        <span className={profile.can_convert_to_lan ? 'badge good' : 'badge bad'}>
          {profile.can_convert_to_lan ? '可转换' : '暂不承诺'}
        </span>
      </div>
      <p>能力类型：<strong>{capabilityLabels[profile.capability] ?? profile.capability}</strong></p>
      <p>风险等级：<strong>{profile.risk_level}</strong></p>
      <p>转换方式：</p>
      <div className="badge-row">
        {profile.methods.map((method) => (
          <span className="badge" key={method}>{methodLabels[method] ?? method}</span>
        ))}
      </div>
      <p>需要组件：</p>
      <ul>
        {profile.required_components.map((component) => <li key={component}>{component}</li>)}
      </ul>
      <p>判断说明：</p>
      <ul>
        {profile.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
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
    for (const profile of analysis?.launch_profiles ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [analysis]);

  useEffect(() => {
    setLaunchResult(null);
    setLaunchError(null);
    setAnalysis(null);
    setProfileConfigs({});

    if (!gameId) {
      setItems([]);
      return;
    }

    Promise.all([recommendPlans(gameId), analyzeGame(gameId)])
      .then(([recommendations, nextAnalysis]) => {
        setItems(recommendations);
        setAnalysis(nextAnalysis);

        const nextConfigs: ProfileConfigState = {};
        for (const profile of nextAnalysis.launch_profiles) {
          nextConfigs[profile.id] = defaultConfig(profile);
        }
        setProfileConfigs(nextConfigs);
      })
      .catch((error) => {
        setItems([]);
        setLaunchError(String(error));
      });
  }, [gameId]);

  const updateConfigValue = (profileId: string, fieldId: string, value: string | boolean) => {
    setProfileConfigs((current) => ({
      ...current,
      [profileId]: {
        ...(current[profileId] ?? {}),
        [fieldId]: value
      }
    }));
  };

  const runLaunchProfile = (profileId: string) => {
    if (!gameId) {
      setLaunchError('请先选择游戏。');
      return;
    }

    setIsLaunching(true);
    setLaunchError(null);
    setLaunchResult({
      ok: true,
      message: `正在执行启动项：${profileId} ...`
    });

    launchProfile(gameId, profileId, profileConfigs[profileId] ?? {})
      .then(setLaunchResult)
      .catch((error) => {
        setLaunchResult(null);
        setLaunchError(String(error));
      })
      .finally(() => setIsLaunching(false));
  };

  return (
    <section>
      <h2>推荐方案</h2>
      <p className="muted">
        开服设置使用统一表单渲染：不同游戏只需要在适配器里声明参数，不需要为每个游戏单独写一个前端页面。
      </p>

      <article className="card pending-feature">
        <h3>这里不是“一键已经联机”</h3>
        <p>
          推荐页的作用是把扫描到的游戏匹配到合适流程：虚拟局域网、启动客户端、启动本地服务端或查看说明。
          真正能不能本地联机，还要看下面几个真实条件是否成立。
        </p>
        <ol>
          <li>双方已经在同一个 n2n / Radmin / 现有局域网里，并且虚拟 IP 不冲突。</li>
          <li>房主已经启动游戏房间或 Dedicated Server，并且端口正在监听。</li>
          <li>加入方在游戏内选择 LAN / IP 直连，连接房主虚拟 IP 和游戏端口。</li>
          <li>如果这个游戏本身没有 LAN/IP/服务端能力，需要后续适配广播桥、端口代理、Mod 或平台网络插件，不能只靠“启动客户端”。</li>
        </ol>
      </article>

      {analysis && <ConversionProfileView analysis={analysis} />}

      {items.length === 0 ? (
        <p>暂无推荐，请先选择游戏。</p>
      ) : (
        items.map((item) => {
          const profile = item.launch_profile_id ? profilesById.get(item.launch_profile_id) : undefined;
          return (
            <article className="card" key={item.id}>
              <RecommendationCard
                item={item}
                launchProfileType={profile?.type}
                onLaunch={
                  gameId && item.launch_profile_id
                    ? () => runLaunchProfile(item.launch_profile_id as string)
                    : undefined
                }
                disabled={isLaunching}
              />
              {profile?.config_fields && profile.config_fields.length > 0 && (
                <div className="config-panel">
                  <h4>启动参数</h4>
                  {profile.config_fields.map((field) => (
                    <label key={field.id}>
                      <span>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </span>
                      {field.type === 'select' ? (
                        <select
                          value={String(profileConfigs[profile.id]?.[field.id] ?? field.default_value ?? '')}
                          onChange={(event) => updateConfigValue(profile.id, field.id, event.target.value)}
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(profileConfigs[profile.id]?.[field.id])}
                          onChange={(event) => updateConfigValue(profile.id, field.id, event.target.checked)}
                        />
                      ) : (
                        <input
                          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                          value={String(profileConfigs[profile.id]?.[field.id] ?? field.default_value ?? '')}
                          onChange={(event) => updateConfigValue(profile.id, field.id, event.target.value)}
                        />
                      )}
                      {field.help && <small className="muted">{field.help}</small>}
                    </label>
                  ))}
                </div>
              )}
            </article>
          );
        })
      )}

      {launchError && (
        <article className="card error-card">
          <h3>操作异常</h3>
          <p>{launchError}</p>
        </article>
      )}
      {launchResult && (
        <article className="card">
          <h3>{launchResult.ok ? '操作结果' : '操作失败'}</h3>
          <p>{launchResult.message}</p>
        </article>
      )}
    </section>
  );
}
