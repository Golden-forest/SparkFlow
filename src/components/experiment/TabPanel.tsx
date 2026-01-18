import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TabPanelProps {
  children: React.ReactNode;
}

export function TabPanel({ children }: TabPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={`absolute right-0 top-20 bottom-8 w-80 flex flex-col gap-4 pointer-events-none z-50 transition-all duration-300 ${isExpanded ? 'translate-x-0' : 'translate-x-[calc(100%-40px)]'}`}>
      {/* 切换按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-[-40px] top-1/2 -translate-y-1/2 w-10 h-20 bg-slate-900/90 backdrop-blur-md rounded-l-lg border border-white/10 flex items-center justify-center pointer-events-auto hover:bg-slate-800 transition-colors"
      >
        {isExpanded ? <ChevronRight size={20} className="text-white" /> : <ChevronLeft size={20} className="text-white" />}
      </button>

      {/* 面板内容 */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-2xl flex flex-col gap-6 pointer-events-auto h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
