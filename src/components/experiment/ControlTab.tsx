import React, { useState } from 'react';

export const ControlTab = React.memo(() => {
  const [activeTab, setActiveTab] = useState<'control' | 'monitor'>('control');

  return (
    <div className="flex flex-col gap-4">
      {/* Tab按钮 */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'control'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Control
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'monitor'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Monitor
        </button>
      </div>

      {/* Tab内容 */}
      {activeTab === 'control' ? <ControlContent /> : <MonitorContent />}
    </div>
  );
});

function ControlContent() {
  return <div>Control Panel Content</div>;
}

function MonitorContent() {
  return <div>Monitor Panel Content</div>;
}
