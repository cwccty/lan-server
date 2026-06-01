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

      {items.length === 0 ? (
        <p>暂无推荐，请先选择游戏。</p>
      ) : (
        items.map((item) => {
          const profile = item.launch_profile_id ? profilesById.get(item.launch_profile_id) : undefined;
          return (
            <article className="card" key={item.id}>
              <RecommendationCard
                item={item}
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
