export const PageLoader = () => (
  <div className="flex flex-col items-center justify-center py-32 gap-8">
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl border border-cyan-500/20 absolute inset-0 animate-ping opacity-20" />
      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/20">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="5" y="8" width="22" height="16" rx="3" stroke="white" strokeWidth="2"/>
          <path d="M6 11L16 18.5L26 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21.7 3.5L22.5 5.3L24.3 6.1L22.5 6.9L21.7 8.7L20.9 6.9L19.1 6.1L20.9 5.3L21.7 3.5Z" fill="#BAE6FD"/>
        </svg>
      </div>
    </div>
    <div className="w-36 h-0.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-[pageload_1.4s_ease-in-out_infinite]"
        style={{ width: '40%' }}
      />
    </div>
    <style>{`@keyframes pageload { 0% { transform: translateX(-200%); } 100% { transform: translateX(400%); } }`}</style>
  </div>
);
