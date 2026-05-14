import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-pilot-line bg-white p-5 shadow-soft", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-pilot-purple text-white hover:bg-[#5d00d8]",
        variant === "secondary" && "border border-pilot-line bg-white text-pilot-ink hover:bg-pilot-soft",
        variant === "ghost" && "text-pilot-muted hover:bg-pilot-soft",
        variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-11 w-full rounded-xl border border-pilot-line bg-white px-3 text-sm outline-none focus:border-pilot-purple", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-28 w-full rounded-xl border border-pilot-line bg-white p-3 text-sm outline-none focus:border-pilot-purple", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-11 w-full rounded-xl border border-pilot-line bg-white px-3 text-sm outline-none focus:border-pilot-purple", className)} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ready" | "failed" | "generating" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "bg-pilot-soft text-pilot-muted",
        tone === "ready" && "bg-emerald-50 text-emerald-700",
        tone === "failed" && "bg-red-50 text-red-700",
        tone === "generating" && "bg-purple-50 text-pilot-purple"
      )}
    >
      {children}
    </span>
  );
}
