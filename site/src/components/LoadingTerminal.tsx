import { useTokenStore } from '../stores/tokenStore';

export default function LoadingTerminal() {
  const progress = useTokenStore((s) => s.progress);
  const progressLabel = useTokenStore((s) => s.progressLabel);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center">
        {/* ASCII brand — large */}
        <pre
          className="font-mono text-[14px] sm:text-[18px] leading-[1.15] text-center select-none"
          style={{
            color: '#ff4444',
            textShadow: '0 0 14px rgba(255,68,68,0.5), 0 0 40px rgba(255,50,50,0.15)',
            animation: 'loading-brand-pulse 3s ease-in-out infinite',
          }}
        >
{`┏┳┓┓ ╺┳╸┓
┃┃┃┃  ┃ ┃
╹ ╹┗━╸╹ ┗━╸`}
        </pre>

        {/* Waveform spinner — wide */}
        <div className="flex items-center justify-center gap-[3px] mt-8 h-[28px]">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="loading-bar"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-[200px] mt-6">
          <div className="h-[2px] bg-[#1e0606] overflow-hidden">
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #dc2626, #ff4444)',
                boxShadow: '0 0 8px rgba(255,68,68,0.5)',
              }}
            />
          </div>
          <div className="mt-2 text-[8px] text-crt-dim font-mono opacity-40 text-center tracking-[0.15em]">
            {progressLabel}
          </div>
        </div>
      </div>

      <style>{`
        .loading-bar {
          width: 4px;
          height: 4px;
          background: #ff4444;
          animation: loading-wave 1.4s ease-in-out infinite;
        }

        @keyframes loading-wave {
          0%, 100% { height: 4px; opacity: 0.12; }
          50% { height: 28px; opacity: 0.6; box-shadow: 0 0 8px rgba(255,68,68,0.4); }
        }

        @keyframes loading-brand-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
