export function BaseButton({
  children,
  variant = "default",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" | "success" }) {
  const base =
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer select-none focus:outline-none";
  const variants: Record<string, string> = {
    default:
      "bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700",
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700 border border-slate-900",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 border border-slate-300 active:bg-slate-200",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-700",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-rose-700",
  };
  return (
    <button className={`${base} ${variants[variant]}`} {...rest}>
      {children}
    </button>
  );
}