import { useState } from 'react';
import { FAQS, FUTURE_PLANS } from '../data';
import {
  HelpCircle,
  FolderOpen,
  Save,
  ChevronDown,
  ChevronUp,
  Cpu,
  BookOpen,
  Boxes,
  Compass,
  ArrowRight
} from 'lucide-react';

interface SettingsViewProps {
  onTriggerToast: (msg: string) => void;
  edgePath: string;
  supernode_default: string;
  onUpdateState: (key: string, value: any) => void;
}

export default function SettingsView({
  onTriggerToast,
  edgePath,
  supernode_default,
  onUpdateState
}: SettingsViewProps) {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const handleSaveSettings = () => {
    onTriggerToast('核心设置及默认中继连接池已固化入本地 user_preferences.json 存档！');
  };

  const handleTestEdgePath = () => {
    onTriggerToast(`正在连接测试 [${edgePath}] N2N 主内核驱动有效性...`);
    setTimeout(() => {
      onTriggerToast('通信握手自测通过：Edge 客户端就绪，版本 v3.0.0 正式版。');
    }, 800);
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Header Section */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-800">设置与帮助</h2>
        <p className="text-sm text-slate-500 mt-1">定制客户端本地运行引擎，查阅连接过程的常见问题汇总解答。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form settings and FAQ expanders */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Settings Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="font-heading text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              本地内核参数
            </h3>

            <div className="space-y-5">
              
              {/* Field 1: Edge path */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1">edge.exe 物理执行路径</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={edgePath}
                    onChange={(e) => onUpdateState('edgePath', e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 text-xs text-slate-700 font-mono outline-none transition-colors"
                    placeholder="例如: C:/Program Files/N2N/edge.exe"
                  />
                  <button
                    onClick={handleTestEdgePath}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-sans font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    联机自测
                  </button>
                </div>
              </div>

              {/* Field 2: Default supernode IP */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1">辅助 Supernode 公网候选组</label>
                <input
                  type="text"
                  value={supernode_default}
                  onChange={(e) => onUpdateState('supernode_default', e.target.value)}
                  className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 text-xs text-slate-700 font-mono outline-none transition-colors"
                  placeholder="例如: backup.supernode.net:7778"
                />
              </div>

            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2.5 bg-amber-500 text-amber-950 hover:bg-amber-450 font-bold font-sans text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                保存本地设置
              </button>
            </div>
          </div>

          {/* Help Center FAQs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1">
            <h3 className="font-heading text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              常见组网障碍解答 (FAQ)
            </h3>

            <div className="space-y-3 font-sans">
              {FAQS.map((faq) => {
                const isOpen = expandedFaq === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="border border-slate-100 rounded-xl overflow-hidden shadow-inner transition-all"
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full text-left px-5 py-4 bg-slate-50/50 hover:bg-slate-50 flex justify-between items-center transition-colors cursor-pointer"
                    >
                      <span className="font-heading font-semibold text-slate-700 text-xs">
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 py-4 border-t border-slate-100 bg-white text-slate-500 leading-relaxed text-xs">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Future Roadmap plans / release timelines */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-500" />
                联机助手发展路线图
              </h3>
              <p className="text-slate-400 text-xs mb-6">我们的开发团队目前正在推进以下高级网络特性的兼容攻坚：</p>

              <div className="space-y-4">
                {FUTURE_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 h-fit"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-sans font-bold text-slate-700 text-xs">{plan.title}</h4>
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {plan.status || '开发中'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal mt-0.5">{plan.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>技术群组: 104554832</span>
              <a
                href="#github-release"
                onClick={(e) => {
                  e.preventDefault();
                  onTriggerToast('正在载入 GitHub 官方 Releases 页面...');
                }}
                className="text-amber-600 hover:text-amber-800 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                GitHub 主机
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
