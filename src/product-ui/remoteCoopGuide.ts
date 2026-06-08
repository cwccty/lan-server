import type { GameSummary } from '../types/game';

export type RemoteCoopMode = 'steam_remote_play' | 'sunshine_moonlight';
export type RemoteCoopQualityPreset = 'low_latency' | 'balanced' | 'quality';

export interface RemoteCoopChecklist {
  gameLaunched: boolean;
  localCoopMode: boolean;
  friendInvited: boolean;
  inputEnabled: boolean;
}

export interface RemoteCoopStep {
  id: string;
  title: string;
  detail: string;
}

export const remoteCoopQualityPresets: Record<RemoteCoopQualityPreset, {
  label: string;
  bitrate: string;
  resolution: string;
  fps: string;
  note: string;
}> = {
  low_latency: {
    label: '低延迟',
    bitrate: '8-15 Mbps',
    resolution: '720p / 900p',
    fps: '60 FPS 优先',
    note: '适合动作游戏、格斗/平台跳跃，优先降低输入延迟。'
  },
  balanced: {
    label: '均衡',
    bitrate: '15-30 Mbps',
    resolution: '1080p',
    fps: '60 FPS',
    note: '适合大多数合作游戏，画质和延迟比较平衡。'
  },
  quality: {
    label: '画质优先',
    bitrate: '30-50 Mbps',
    resolution: '1080p / 1440p',
    fps: '60 FPS 或更高',
    note: '适合网络稳定、距离较近或对画面要求更高的场景。'
  }
};

export function remoteCoopModeLabel(mode: RemoteCoopMode) {
  return mode === 'steam_remote_play' ? 'Steam Remote Play Together' : 'Sunshine + Moonlight';
}

export function buildRemoteCoopSteps(mode: RemoteCoopMode): RemoteCoopStep[] {
  if (mode === 'steam_remote_play') {
    return [
      {
        id: 'launch',
        title: '房主启动游戏',
        detail: '房主先进入游戏，并进入本地双人/本地合作/同屏模式。'
      },
      {
        id: 'invite',
        title: '从 Steam 邀请好友',
        detail: '打开 Steam 好友列表，右键好友，选择 Remote Play Together。'
      },
      {
        id: 'input',
        title: '打开好友输入权限',
        detail: '在 Remote Play 面板中允许好友使用手柄、键盘或鼠标输入。'
      },
      {
        id: 'quality',
        title: '根据延迟调画质',
        detail: '如果好友操作延迟明显，优先降低分辨率、码率，并关闭不必要后台下载。'
      }
    ];
  }
  return [
    {
      id: 'sunshine',
      title: '房主配置 Sunshine',
      detail: '房主安装 Sunshine，添加游戏或桌面应用，并确认串流服务正常运行。'
    },
    {
      id: 'moonlight',
      title: '好友连接 Moonlight',
      detail: '好友打开 Moonlight，配对房主设备，选择游戏或桌面开始串流。'
    },
    {
      id: 'input',
      title: '确认输入回传',
      detail: '确认好友手柄/键鼠输入能被房主电脑识别，必要时切换控制器映射。'
    },
    {
      id: 'quality',
      title: '调整码率与延迟',
      detail: '动作游戏优先 720p/900p + 60FPS；网络稳定后再提高码率和分辨率。'
    }
  ];
}

export function buildRemoteCoopLatencyTips(preset: RemoteCoopQualityPreset) {
  const quality = remoteCoopQualityPresets[preset];
  return [
    `推荐预设：${quality.label}`,
    `分辨率：${quality.resolution}`,
    `帧率：${quality.fps}`,
    `码率：${quality.bitrate}`,
    quality.note,
    '如果延迟高：降低分辨率/码率，关闭下载、直播录制和不必要的后台程序。',
    '如果画面卡顿：优先检查上行带宽和丢包，而不是增加码率。'
  ];
}

export function checklistProgress(checklist: RemoteCoopChecklist) {
  const values = Object.values(checklist);
  const done = values.filter(Boolean).length;
  return {
    done,
    total: values.length,
    ready: done === values.length
  };
}

export function buildRemoteCoopFriendGuide(options: {
  game: GameSummary | null;
  mode: RemoteCoopMode;
  preset: RemoteCoopQualityPreset;
  checklist: RemoteCoopChecklist;
}) {
  const quality = remoteCoopQualityPresets[options.preset];
  const progress = checklistProgress(options.checklist);
  const steps = buildRemoteCoopSteps(options.mode);
  const checks = [
    `房主已启动游戏：${options.checklist.gameLaunched ? '是' : '否'}`,
    `已进入本地同屏/合作模式：${options.checklist.localCoopMode ? '是' : '否'}`,
    `已发送/准备发送邀请：${options.checklist.friendInvited ? '是' : '否'}`,
    `已允许好友输入：${options.checklist.inputEnabled ? '是' : '否'}`
  ];

  return [
    '[联机助手远程同屏联机说明]',
    `游戏：${options.game?.display_name || '未选择'}`,
    `游戏 ID：${options.game?.game_id || '未选择'}`,
    `推荐方式：${remoteCoopModeLabel(options.mode)}`,
    `准备进度：${progress.done}/${progress.total}${progress.ready ? '，可以邀请好友。' : '，请先完成未勾选项。'}`,
    '',
    '房主操作：',
    ...steps.map((step, index) => `${index + 1}. ${step.title}：${step.detail}`),
    '',
    '好友操作：',
    options.mode === 'steam_remote_play'
      ? '1. 接受 Steam Remote Play Together 邀请。'
      : '1. 打开 Moonlight，连接房主 Sunshine 设备。',
    '2. 确认手柄/键盘/鼠标输入可以控制游戏。',
    '3. 如果延迟明显，先要求房主切换到低延迟预设。',
    '',
    '画质/延迟建议：',
    `预设：${quality.label}`,
    `分辨率：${quality.resolution}`,
    `帧率：${quality.fps}`,
    `码率：${quality.bitrate}`,
    quality.note,
    '',
    '房主检查项：',
    ...checks.map((item) => `- ${item}`),
    '',
    '提示：这类本地同屏游戏不需要通用组网，也不需要连接房主联机地址或端口。'
  ].join('\n');
}
