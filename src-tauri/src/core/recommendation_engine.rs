use crate::core::capability_engine;
use crate::models::game::GameCapability;
use crate::models::recommendation::Recommendation;

pub fn recommend_plans(game_id: &str) -> Result<Vec<Recommendation>, String> {
    let analysis = capability_engine::analyze_game(game_id)?;
    let mut plans = Vec::new();

    if analysis
        .capabilities
        .iter()
        .any(|cap| matches!(cap, GameCapability::IpJoin | GameCapability::Lan))
    {
        plans.push(Recommendation {
            id: "virtual_lan_ip_join".to_string(),
            title: "使用虚拟局域网进行 IP 直连".to_string(),
            level: "recommended".to_string(),
            backend_id: Some("n2n".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "双方加入同一个 n2n/Radmin/Manual LAN 网络".to_string(),
                "房主启动游戏或服务端".to_string(),
                "其他玩家连接房主虚拟 IP".to_string(),
            ],
            launch_profile_id: Some("client".to_string()),
        });
    }

    if analysis
        .capabilities
        .iter()
        .any(|cap| matches!(cap, GameCapability::DedicatedServer))
    {
        plans.push(Recommendation {
            id: "dedicated_server".to_string(),
            title: "房主启动本地 Dedicated Server".to_string(),
            level: "recommended".to_string(),
            backend_id: Some("n2n".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "房主启动服务端配置".to_string(),
                "检查默认端口是否可达".to_string(),
                "其他玩家连接房主虚拟 IP 和端口".to_string(),
            ],
            launch_profile_id: Some("server".to_string()),
        });
    }

    if analysis.launch_profiles.iter().any(|profile| profile.id == "docs") {
        plans.push(Recommendation {
            id: "connection_docs".to_string(),
            title: "查看该游戏的连接说明".to_string(),
            level: "tryable".to_string(),
            backend_id: None,
            estimated_latency_ms: None,
            required_actions: vec!["打开专用说明，按步骤启动房主和加入方。".to_string()],
            launch_profile_id: Some("docs".to_string()),
        });
    }

    if plans.is_empty() {
        plans.push(Recommendation {
            id: "unsupported_first_version".to_string(),
            title: "第一版暂不支持该游戏的非 Steam 联机替代".to_string(),
            level: "unsupported".to_string(),
            backend_id: None,
            estimated_latency_ms: None,
            required_actions: vec!["等待后续适配或使用游戏原生联机方式".to_string()],
            launch_profile_id: None,
        });
    }

    Ok(plans)
}
