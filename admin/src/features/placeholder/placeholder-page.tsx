import { copy } from '@/content/copy';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">{title}</h1>
      <span className="text-[15px] text-muted">{copy.placeholder}</span>
    </div>
  );
}
