import {
  ACCENT_SWATCHES,
  appearanceWarnings,
  buildThemeVars,
  convertFromKgs,
  CURRENCIES,
  FOREIGN_CURRENCY_CODES,
  formatKgs,
  formatMoney,
  HEADER_SWATCHES,
  THEME_KEYS,
  THEMES,
  type Appearance,
  type CurrenciesSetting,
} from '@bom/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSaveSetting, useSettings } from '@/api/settings';
import { Button, Card, Spinner } from '@/components/ui';
import { Toggle, useUnsavedGuard } from '@/components/ui/editor';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';

const EXAMPLE_KGS = 5900;

/** Оформление сайта (design: isDesign): theme, colours, currencies and a live preview. */
export function AppearancePage() {
  const settings = useSettings();
  if (!settings.data?.appearance || !settings.data.currencies) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted">
        {settings.isError ? copy.errors.load : <Spinner />}
      </div>
    );
  }
  return <AppearanceForm appearance={settings.data.appearance} currencies={settings.data.currencies} />;
}

function AppearanceForm({
  appearance,
  currencies,
}: {
  appearance: Appearance;
  currencies: CurrenciesSetting;
}) {
  const saveAppearance = useSaveSetting('appearance');
  const saveCurrencies = useSaveSetting('currencies');
  const [baseline, setBaseline] = useState({ appearance, currencies });
  const [form, setForm] = useState(appearance);
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(FOREIGN_CURRENCY_CODES.map((code) => [code, String(currencies[code].rate)])),
  );
  const [enabled, setEnabled] = useState(() =>
    Object.fromEntries(FOREIGN_CURRENCY_CODES.map((code) => [code, currencies[code].enabled])),
  );
  const currencyValue: CurrenciesSetting = Object.fromEntries(
    FOREIGN_CURRENCY_CODES.map((code) => [
      code,
      { enabled: Boolean(enabled[code]), rate: Number(rates[code]?.replace(',', '.')) || 0 },
    ]),
  ) as CurrenciesSetting;
  const dirty =
    JSON.stringify(form) !== JSON.stringify(baseline.appearance) ||
    JSON.stringify(currencyValue) !== JSON.stringify(baseline.currencies);
  const saving = saveAppearance.isPending || saveCurrencies.isPending;
  useUnsavedGuard(dirty && !saving);
  const warnings = appearanceWarnings(form);
  const invalidRate = FOREIGN_CURRENCY_CODES.find((code) => enabled[code] && !(currencyValue[code].rate > 0));

  const save = async () => {
    if (invalidRate) return toast.error(copy.validation['rate.positive'] ?? copy.editor.invalid);
    try {
      const [savedAppearance, savedCurrencies] = await Promise.all([
        saveAppearance.mutateAsync(form),
        saveCurrencies.mutateAsync(currencyValue),
      ]);
      setBaseline({ appearance: savedAppearance, currencies: savedCurrencies });
      toast.success(copy.appearance.saved);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const vars = buildThemeVars(form);
  const v = (name: string) => vars[`--${name}`] ?? '';
  const example = [
    formatKgs(EXAMPLE_KGS),
    ...FOREIGN_CURRENCY_CODES.filter((code) => enabled[code]).map((code) =>
      formatMoney(convertFromKgs(EXAMPLE_KGS, code, currencyValue[code].rate), code),
    ),
  ].join(' · ');

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">
            {copy.appearance.title}
          </h1>
          <span className="text-[15px] text-muted">{copy.appearance.lead}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={env.VITE_SITE_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex h-11 items-center rounded-xl border border-input bg-surface px-4 text-[15px] font-semibold"
          >
            {copy.openSite}
          </a>
          <Button
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="rounded-xl disabled:opacity-100"
          >
            {saving ? (
              <Spinner />
            ) : (
              !dirty && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )
            )}
            {dirty ? copy.appearance.save : copy.appearance.saved}
          </Button>
        </div>
      </div>

      <div className="mt-[26px] flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{copy.appearance.presets}</h2>
              <span className="text-sm text-muted">{copy.appearance.presetsHint}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
              {THEME_KEYS.map((key) => {
                const theme = THEMES[key];
                const on = form.theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setForm({ theme: key, headerColor: theme.headerColor, accentColor: theme.accentColor })
                    }
                    className={cn(
                      'flex flex-col gap-2.5 rounded-[14px] bg-surface p-3 text-left',
                      on ? 'border-2 border-ink' : 'border border-line',
                    )}
                  >
                    <span className="flex h-16 flex-col self-stretch overflow-hidden rounded-control shadow-[inset_0_0_0_1px_rgba(20,20,43,.08)]">
                      <span className="h-[18px]" style={{ background: theme.headerColor }} />
                      <span
                        className="flex flex-1 items-center justify-center"
                        style={{ background: theme.bg }}
                      >
                        <span
                          className="h-3 w-[56%] rounded-full"
                          style={{ background: theme.accentColor }}
                        />
                      </span>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">{theme.label}</span>
                      <span className="text-[13px] text-muted">{theme.note}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="flex flex-col gap-[22px] p-6">
            <h2 className="text-lg font-semibold">{copy.appearance.colours}</h2>
            <ColourRow
              title={copy.appearance.header}
              hint={copy.appearance.headerHint}
              swatches={HEADER_SWATCHES}
              value={form.headerColor}
              customLabel={copy.appearance.customHeader}
              onChange={(headerColor) => setForm({ ...form, headerColor })}
              warning={warnings.headerTooDark ? copy.appearance.headerWarn : null}
            />
            <div className="h-px bg-line-2" />
            <ColourRow
              title={copy.appearance.accent}
              hint={copy.appearance.accentHint}
              swatches={ACCENT_SWATCHES}
              value={form.accentColor}
              customLabel={copy.appearance.customAccent}
              onChange={(accentColor) => setForm({ ...form, accentColor })}
              warning={warnings.accentLowContrast ? copy.appearance.accentWarn : null}
            />
          </Card>

          <Card className="flex flex-col gap-1 p-6">
            <div className="mb-2.5 flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{copy.appearance.currencies}</h2>
              <span className="text-sm text-muted">{copy.appearance.currenciesHint}</span>
            </div>
            <div className="flex min-h-16 flex-wrap items-center gap-x-3.5 gap-y-3 border-t border-line-2 py-2.5">
              <span className="flex h-10 w-11 flex-none items-center justify-center rounded-xl bg-subtle text-[15px] font-semibold">
                {CURRENCIES.KGS.symbol}
              </span>
              <div className="flex min-w-[120px] flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{CURRENCIES.KGS.label}</span>
                <span className="text-[13px] text-muted">KGS</span>
              </div>
              <span className="rounded-full bg-subtle px-2.5 py-[5px] text-[13px] font-semibold text-muted">
                {copy.appearance.base}
              </span>
            </div>
            {FOREIGN_CURRENCY_CODES.map((code) => {
              const currency = CURRENCIES[code];
              const on = Boolean(enabled[code]);
              return (
                <div
                  key={code}
                  className="flex min-h-16 flex-wrap items-center gap-x-3.5 gap-y-3 border-t border-line-2 py-2.5"
                >
                  <span className="flex h-10 w-11 flex-none items-center justify-center rounded-xl bg-subtle text-[15px] font-semibold">
                    {currency.symbol}
                  </span>
                  <div className="flex min-w-[120px] flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{currency.label}</span>
                    <span className="text-[13px] text-muted">{code}</span>
                  </div>
                  <div className={cn('flex items-center gap-2', !on && 'opacity-45')}>
                    <span className="min-w-[52px] text-right text-sm whitespace-nowrap text-muted">
                      {currency.inverse ? `1 ${currency.symbol} =` : `1 ${CURRENCIES.KGS.symbol} =`}
                    </span>
                    <input
                      value={rates[code] ?? ''}
                      onChange={(e) => setRates({ ...rates, [code]: e.target.value.replace(/[^\d.,]/g, '') })}
                      inputMode="decimal"
                      aria-label={`${copy.appearance.rate} ${code}`}
                      className={cn(
                        'h-10 w-[88px] rounded-control border bg-surface px-3 text-right text-[15px]',
                        on && !(currencyValue[code].rate > 0) ? 'border-red' : 'border-input',
                      )}
                    />
                    <span className="w-[30px] text-[15px] font-semibold whitespace-nowrap">
                      {currency.inverse ? CURRENCIES.KGS.symbol : currency.symbol}
                    </span>
                  </div>
                  <Toggle
                    checked={on}
                    onChange={(value) => setEnabled({ ...enabled, [code]: value })}
                    label={`${copy.appearance.showOnSite}: ${currency.label}`}
                  />
                </div>
              );
            })}
            <span className="border-t border-line-2 pt-3 text-sm text-muted">
              {copy.appearance.example(example)}
            </span>
          </Card>
        </div>

        <Card className="sticky top-6 flex max-w-[440px] min-w-0 flex-[1_1_320px] flex-col gap-3.5 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{copy.appearance.preview}</h2>
            <span className="text-[13px] text-muted">{copy.appearance.previewHint}</span>
          </div>
          <div
            className="w-full max-w-[290px] self-center overflow-hidden rounded-[34px] border-8 border-ink"
            style={{ background: v('bg') }}
            aria-hidden="true"
          >
            <div
              className="flex flex-col gap-2 px-3 pt-3 pb-2.5"
              style={{ background: v('hdr'), borderBottom: `1px solid ${v('hdrl')}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <img src="/brand/bom-lockup-full.png" alt="" className="block h-[15px] w-auto" />
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-6 rounded-full px-2 text-[11px] leading-6 font-semibold text-[#13233F]"
                    style={{ background: v('tt') }}
                  >
                    {CURRENCIES.KGS.symbol}
                  </span>
                  <span className="size-6 rounded-full" style={{ background: v('tt') }} />
                </span>
              </div>
              <div className="flex gap-0.5 rounded-full p-0.5" style={{ background: v('tt') }}>
                {copy.appearance.tabs.map((tab, index) => (
                  <span
                    key={tab}
                    className={cn(
                      'h-[22px] flex-1 text-center text-[10px] leading-[22px]',
                      index === 0 ? 'rounded-full bg-white font-semibold text-[#13233F]' : 'text-[#1C3150]',
                    )}
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="flex flex-col items-center px-4 py-[18px] text-center"
              style={{ background: v('hbg') }}
            >
              <span className="size-[50px] rounded-[15px]" style={{ background: v('acs') }} />
              <span className="mt-3 text-[21px] leading-[1.1] font-semibold tracking-[-0.03em] text-[#13233F]">
                {copy.appearance.previewTitle[0]}
                <span style={{ color: v('hl') }}>{copy.appearance.previewTitle[1]}</span>
                {copy.appearance.previewTitle[2]}
              </span>
              <span className="mt-2 text-[11px] leading-[1.45] text-[#59647A]">
                {copy.appearance.previewText}
              </span>
              <span
                className="mt-3.5 flex h-[38px] items-center justify-center self-stretch rounded-xl text-xs font-semibold text-white"
                style={{ background: form.accentColor, boxShadow: `0 0 0 5px ${v('halo')}` }}
              >
                {copy.appearance.previewButton}
              </span>
            </div>
            <div className="flex flex-col px-2.5 pt-1 pb-3.5">
              <div className="flex items-center gap-2.5 rounded-[14px] border border-[#E3E8EF] bg-white p-2">
                <span className="size-10 flex-none rounded-control" style={{ background: v('acs') }} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  <span className="text-xs font-semibold text-[#13233F]">{copy.appearance.previewCard}</span>
                  <span className="truncate text-[11px] font-semibold" style={{ color: form.accentColor }}>
                    {example}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function ColourRow({
  title,
  hint,
  swatches,
  value,
  customLabel,
  onChange,
  warning,
}: {
  title: string;
  hint: string;
  swatches: readonly string[];
  value: string;
  customLabel: string;
  onChange: (hex: string) => void;
  warning: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-sm text-muted">{hint}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {swatches.map((hex) => {
          const on = hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              aria-pressed={on}
              title={hex}
              onClick={() => onChange(hex)}
              className="size-10 rounded-full"
              style={{
                background: hex,
                boxShadow: on ? '0 0 0 3px #FFFFFF, 0 0 0 5px #14142B' : 'inset 0 0 0 1px rgba(20,20,43,.16)',
              }}
            />
          );
        })}
        <label className="relative flex h-10 cursor-pointer items-center gap-2 rounded-full border border-dashed border-[#C9CDD6] pr-3.5 pl-1.5 text-sm font-semibold">
          <span
            className="size-7 rounded-full shadow-[inset_0_0_0_1px_rgba(20,20,43,.16)]"
            style={{ background: value }}
          />
          {copy.appearance.custom}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={customLabel}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <span className="font-mono text-[13px] text-muted">{value.toUpperCase()}</span>
      </div>
      {warning && <span className="text-sm text-[#B42318]">{warning}</span>}
    </div>
  );
}
