use crate::core::capability_engine;
use crate::models::game::{
    ConversionMethod, GameCapability, GameNetworkType, MultiplayerCapability,
};
use crate::models::recommendation::Recommendation;

pub fn recommend_plans(game_id: &str) -> Result<Vec<Recommendation>, String> {
    let analysis = capability_engine::analyze_game(game_id)?;
    let mut plans = Vec::new();
    let conversion = analysis.multiplayer_conversion.as_ref();
    let methods = conversion
        .map(|profile| profile.methods.as_slice())
        .unwrap_or(&[]);
    let has_method = |target: ConversionMethod| methods.iter().any(|method| std::mem::discriminant(method) == std::mem::discriminant(&target));
    let network_type = analysis.network_type.as_ref();
    let conversion_capability = conversion.map(|item| &item.capability);
    let is_udp_broadcast = network_type
        .map(|kind| matches!(kind, GameNetworkType::UdpBroadcastNeeded))
        .unwrap_or(false);
    let is_tcp_port_proxy = network_type
        .map(|kind| matches!(kind, GameNetworkType::TcpPortProxyNeeded))
        .unwrap_or(false);
    let is_local_coop_remote = network_type
        .map(|kind| matches!(kind, GameNetworkType::LocalCoopRemotePlay))
        .unwrap_or(false)
        || conversion_capability
            .map(|cap| matches!(cap, MultiplayerCapability::LocalCoopRemotePlay))
            .unwrap_or(false);
    let is_steam_p2p_route = network_type
        .map(|kind| matches!(kind, GameNetworkType::SteamP2pOnly | GameNetworkType::SteamRelayPlugin | GameNetworkType::SteamLobbyDirectPossible))
        .unwrap_or(false)
        || conversion_capability
            .map(|cap| matches!(cap, MultiplayerCapability::SteamP2pLobby))
            .unwrap_or(false);
    let is_official_or_unsupported = network_type
        .map(|kind| matches!(kind, GameNetworkType::OfficialOnly | GameNetworkType::NotSupported))
        .unwrap_or(false)
        || conversion_capability
            .map(|cap| matches!(cap, MultiplayerCapability::OfficialOnly | MultiplayerCapability::Unsupported))
            .unwrap_or(false);

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
                "注意：启动 client 只是打开游戏客户端，不代表已经完成联机；仍需在游戏内连接房主虚拟 IP。"
                    .to_string(),
            ],
            launch_profile_id: Some("client".to_string()),
        });
    }

    if is_udp_broadcast
        || has_method(ConversionMethod::BroadcastBridge)
        || conversion_capability
            .map(|cap| matches!(cap, MultiplayerCapability::LanDiscoveryBroadcast))
            .unwrap_or(false)
    {
        plans.push(Recommendation {
            id: "virtual_lan_broadcast_bridge".to_string(),
            title: "n2n + UDP 广播桥发现局域网大厅".to_string(),
            level: "recommended".to_string(),
            backend_id: Some("n2n+udp_broadcast_bridge".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "双方先加入同一个 n2n 虚拟局域网".to_string(),
                "房主或加入方在高级连接工具中启动 UDP 广播桥".to_string(),
                "在游戏 LAN 房间列表中刷新；若支持 IP 直连，优先连接房主虚拟 IP".to_string(),
            ],
            launch_profile_id: Some("client".to_string()),
        });
    }

    if is_tcp_port_proxy || has_method(ConversionMethod::PortProxy)
    {
        plans.push(Recommendation {
            id: "virtual_lan_port_proxy".to_string(),
            title: "n2n + TCP/UDP 端口代理".to_string(),
            level: "tryable".to_string(),
            backend_id: Some("n2n+port_proxy".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "先确认游戏或服务端在房主本机端口监听".to_string(),
                "双方进入同一 n2n 虚拟局域网".to_string(),
                "按游戏协议在高级连接工具中启动 TCP 或 UDP 端口代理".to_string(),
            ],
            launch_profile_id: None,
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
                "注意：启动 server 只负责让房主侧开始监听端口，加入方仍需要先完成组网并在游戏内加入。"
                    .to_string(),
            ],
            launch_profile_id: Some("server".to_string()),
        });
    }

    if analysis
        .capabilities
        .iter()
        .any(|cap| matches!(cap, GameCapability::LocalCoop | GameCapability::RemotePlayTogether))
        || is_local_coop_remote
        || has_method(ConversionMethod::SteamRemotePlay)
        || has_method(ConversionMethod::SunshineMoonlight)
    {
        plans.push(Recommendation {
            id: "steam_remote_play_together".to_string(),
            title: "本地同屏游戏：Steam Remote Play Together".to_string(),
            level: "recommended".to_string(),
            backend_id: Some("steam_remote_play".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "房主启动游戏并进入本地双人/同屏模式".to_string(),
                "在 Steam 好友列表中邀请好友 Remote Play Together".to_string(),
                "确认手柄/键鼠输入权限；此路线不需要 n2n，也不承诺 LAN 转换".to_string(),
            ],
            launch_profile_id: Some("client".to_string()),
        });
        plans.push(Recommendation {
            id: "sunshine_moonlight_remote_coop".to_string(),
            title: "本地同屏游戏：Sunshine + Moonlight".to_string(),
            level: "tryable".to_string(),
            backend_id: Some("sunshine_moonlight".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "房主安装并配置 Sunshine，好友使用 Moonlight 连接".to_string(),
                "优先在同一虚拟局域网或可信网络内测试串流延迟".to_string(),
                "适合 Steam Remote Play 不稳定或非 Steam 版本的同屏游戏".to_string(),
            ],
            launch_profile_id: None,
        });
    }

    if analysis
        .capabilities
        .iter()
        .any(|cap| matches!(cap, GameCapability::SteamLobby | GameCapability::SteamP2p))
        || is_steam_p2p_route
        || has_method(ConversionMethod::SteamRelayPlugin)
    {
        plans.push(Recommendation {
            id: "steam_lobby_or_relay".to_string(),
            title: "Steam 大厅 / Steam P2P / Relay 插件路线".to_string(),
            level: "tryable".to_string(),
            backend_id: Some("steam_relay_plugin".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "优先使用游戏原生 Steam 好友邀请或大厅".to_string(),
                "如果项目有插件能力，再评估 Steam Relay / Steam P2P 插件；不要承诺强制转换为 LAN".to_string(),
                "涉及反作弊、平台账号和官方服务时保持原官方流程".to_string(),
            ],
            launch_profile_id: None,
        });
    }

    if has_method(ConversionMethod::WireguardGuide)
        || has_method(ConversionMethod::ZerotierGuide)
        || has_method(ConversionMethod::TailscaleGuide)
    {
        plans.push(Recommendation {
            id: "alternate_virtual_network_guides".to_string(),
            title: "备用虚拟网络：WireGuard / ZeroTier / Tailscale 引导".to_string(),
            level: "tryable".to_string(),
            backend_id: Some("alternate_virtual_network".to_string()),
            estimated_latency_ms: None,
            required_actions: vec![
                "n2n 仍是当前主线；如环境不适合 n2n，可按引导切换 WireGuard、ZeroTier 或 Tailscale".to_string(),
                "切换后仍使用同一游戏连接原则：房主虚拟 IP + 游戏端口".to_string(),
            ],
            launch_profile_id: None,
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
        if is_official_or_unsupported {
            plans.push(Recommendation {
                id: "official_only_explain".to_string(),
                title: "仅建议官方联机；不强行转换".to_string(),
                level: "unsupported".to_string(),
                backend_id: None,
                estimated_latency_ms: None,
                required_actions: vec![
                    "该游戏当前适配器认为只适合官方服、官方大厅或平台流程。".to_string(),
                    "联机助手只提供说明和诊断，不承诺绕过官方网络限制。".to_string(),
                ],
                launch_profile_id: None,
            });
            return Ok(plans);
        }
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

#[cfg(test)]
mod tests {
    use super::recommend_plans;

    #[test]
    fn cuphead_uses_remote_coop_route_not_virtual_lan_ip_join() {
        let plans = recommend_plans("cuphead").expect("cuphead adapter should be loadable");
        assert!(
            plans.iter().any(|plan| plan.id == "steam_remote_play_together"),
            "Cuphead should recommend Steam Remote Play Together"
        );
        assert!(
            plans.iter().any(|plan| plan.id == "sunshine_moonlight_remote_coop"),
            "Cuphead should expose Sunshine + Moonlight fallback"
        );
        assert!(
            !plans.iter().any(|plan| plan.id == "virtual_lan_ip_join"),
            "local co-op games must not be presented as LAN/IP conversion"
        );
    }
}
