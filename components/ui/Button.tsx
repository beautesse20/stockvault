type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
  loading?: boolean;
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  fullWidth = false,
  type = "button",
  loading = false,
}: ButtonProps) {
  const base = "flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:   "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
    secondary: "bg-white/10 text-white border border-white/10",
    danger:    "bg-red-500/10 text-red-400 border border-red-500/20",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
}