export default function NotFound() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6">
      <img
        src="/tesla-logo.png"
        alt="TeslaTrack"
        className="logo-spin w-20 h-20 object-contain mb-8 drop-shadow-[0_0_20px_rgba(220,38,38,0.4)]"
      />
      <p className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-6">
        Tesla<span className="text-red-500">Track</span>
      </p>
      <div className="text-7xl font-bold text-white/8 mb-4 select-none">404</div>
      <h1 className="text-xl font-semibold text-white/80 mb-2">Page Not Found</h1>
      <p className="text-sm text-white/30 text-center max-w-xs mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        href="/"
        className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-all"
      >
        Back to Tracker
      </a>
    </div>
  );
}
