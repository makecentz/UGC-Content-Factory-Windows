export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-normal text-pilot-ink">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-pilot-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
