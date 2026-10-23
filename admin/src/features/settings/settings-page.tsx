import {
  DEFAULT_WHATSAPP_TEMPLATES,
  normalizePhone,
  relativeDateTime,
  USER_ROLE_LABELS,
  USER_ROLES,
  type AdminMedia,
  type AdminUser,
  type FinikStatus,
  type NotificationTestResult,
  type PaymentCheck,
  type SettingKey,
  type SettingValue,
  type UserRole,
} from '@bom/shared';
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { NavLink, Navigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMedia } from '@/api/media';
import { useFinikStatus, usePaymentCheck, useStartFinikCheck } from '@/api/payments';
import { useNotificationTest, useSaveSetting, useSettings, type AdminSettings } from '@/api/settings';
import { useAudit, useUserActions, useUsers } from '@/api/users';
import { Button, Card, inputClass, Spinner, TableHead, TableMessage, TableRow } from '@/components/ui';
import {
  EditorHeader,
  Panel,
  selectClass,
  textareaClass,
  Toggle,
  useUnsavedGuard,
} from '@/components/ui/editor';
import { ImageSlot } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { useUser } from '@/features/auth/auth';
import { Text } from '@/features/products/product-editor';
import { errorText, fieldErrors } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS = ['shop', 'seo', 'notifications', 'payments', 'users', 'security', 'audit'] as const;
type Tab = (typeof TABS)[number];

/** Настройки (gap: the design has no settings screen; same visual language). Owner only. */
export function SettingsPage() {
  const { tab } = useParams();
  const settings = useSettings();
  if (!TABS.includes(tab as Tab)) return <Navigate to="/settings/shop" replace />;
  const current = tab as Tab;
  const needsSettings =
    current === 'shop' || current === 'seo' || current === 'notifications' || current === 'payments';

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">{copy.settings.title}</h1>
        <span className="text-[15px] text-muted">{copy.settings.lead}</span>
      </div>
      <nav
        aria-label={copy.settings.title}
        className="mt-6 mb-6 flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1"
      >
        {TABS.map((key) => (
          <NavLink
            key={key}
            to={`/settings/${key}`}
            className={({ isActive }) =>
              cn(
                'flex h-9 flex-none items-center rounded-[9px] px-3.5 text-sm font-semibold',
                isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink',
              )
            }
          >
            {copy.settings.tabs[key]}
          </NavLink>
        ))}
      </nav>
      {needsSettings && !settings.data ? (
        <div className="flex items-center gap-2 text-[15px] text-muted">
          {settings.isError ? copy.errors.load : <Spinner />}
        </div>
      ) : (
        <>
          {current === 'shop' && settings.data && <ShopForm settings={settings.data} />}
          {current === 'seo' && settings.data && <SeoForm settings={settings.data} />}
          {current === 'notifications' && settings.data && <NotificationsForm settings={settings.data} />}
          {current === 'payments' && settings.data && <PaymentsForm settings={settings.data} />}
          {current === 'users' && <UsersTab />}
          {current === 'security' && <SecurityTab />}
          {current === 'audit' && <AuditTab />}
        </>
      )}
    </>
  );
}

/** Form state for one or more settings saved together. */
function useSettingsForm<K extends SettingKey>(keysToSave: readonly K[], settings: AdminSettings) {
  const savers = {
    shop: useSaveSetting('shop'),
    appearance: useSaveSetting('appearance'),
    currencies: useSaveSetting('currencies'),
    notifications: useSaveSetting('notifications'),
    seo: useSaveSetting('seo'),
    analytics: useSaveSetting('analytics'),
    antispam: useSaveSetting('antispam'),
    payments: useSaveSetting('payments'),
  };
  const initial = Object.fromEntries(keysToSave.map((key) => [key, settings[key]])) as {
    [P in K]: SettingValue<P>;
  };
  const [baseline, setBaseline] = useState(initial);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const saving = keysToSave.some((key) => savers[key].isPending);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  useUnsavedGuard(dirty && !saving);

  const set = <P extends K>(key: P, patch: Partial<SettingValue<P>>) => {
    setForm((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setSaved(false);
  };

  const submit = async (prepare?: (value: typeof form) => typeof form) => {
    const value = prepare ? prepare(form) : form;
    let failedKey = '';
    try {
      const results = await Promise.all(
        keysToSave.map(async (key) => {
          const saver = savers[key] as unknown as {
            mutateAsync: (v: SettingValue<K>) => Promise<SettingValue<K>>;
          };
          try {
            return [key, await saver.mutateAsync(value[key])] as const;
          } catch (error) {
            failedKey ||= key;
            throw error;
          }
        }),
      );
      const next = Object.fromEntries(results) as typeof form;
      setBaseline(next);
      setForm(next);
      setErrors({});
      setSaved(true);
      toast.success(copy.saved);
    } catch (error) {
      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors(error)).map(([f, t]) => [
            `${failedKey}.${f.replace(/^value\./, '')}`,
            t,
          ]),
        ),
      );
      toast.error(errorText(error));
    }
  };

  return { form, set, submit, errors, saved, dirty, saving };
}

function ShopForm({ settings }: { settings: AdminSettings }) {
  const { form, set, submit, errors, saved, dirty, saving } = useSettingsForm(['shop'], settings);
  const shop = form.shop;
  const save = () =>
    void submit((value) => ({
      shop: { ...value.shop, whatsapp: normalizePhone(value.shop.whatsapp) ?? value.shop.whatsapp },
    }));
  return (
    <>
      <EditorHeader
        level={2}
        title={copy.settings.tabs.shop}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={save}
      />
      <div className="mt-[26px] flex max-w-[760px] flex-col gap-4">
        <Panel>
          <Text label={copy.settings.shop.name} error={errors['shop.name']}>
            <input
              value={shop.name}
              onChange={(e) => set('shop', { name: e.target.value })}
              className={inputClass}
            />
          </Text>
          <Text
            label={copy.settings.shop.whatsapp}
            hint={copy.settings.shop.whatsappHint}
            error={errors['shop.whatsapp']}
          >
            <input
              value={shop.whatsapp}
              onChange={(e) => set('shop', { whatsapp: e.target.value })}
              inputMode="tel"
              className={inputClass}
            />
          </Text>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Text
              label={copy.settings.shop.instagramShop}
              hint={copy.settings.shop.instagramHint}
              error={errors['shop.instagramShop']}
            >
              <input
                value={shop.instagramShop}
                onChange={(e) => set('shop', { instagramShop: e.target.value.replace(/^@/, '') })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.settings.shop.instagramOwner} error={errors['shop.instagramOwner']}>
              <input
                value={shop.instagramOwner}
                onChange={(e) => set('shop', { instagramOwner: e.target.value.replace(/^@/, '') })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.settings.shop.ownerName} error={errors['shop.ownerName']}>
              <input
                value={shop.ownerName}
                onChange={(e) => set('shop', { ownerName: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.settings.shop.legalLine} error={errors['shop.legalLine']}>
              <input
                value={shop.legalLine}
                onChange={(e) => set('shop', { legalLine: e.target.value })}
                className={inputClass}
              />
            </Text>
          </div>
          <Text label={copy.settings.shop.footerNote} error={errors['shop.footerNote']}>
            <input
              value={shop.footerNote}
              onChange={(e) => set('shop', { footerNote: e.target.value })}
              className={inputClass}
            />
          </Text>
        </Panel>
      </div>
    </>
  );
}

function SeoForm({ settings }: { settings: AdminSettings }) {
  const { form, set, submit, errors, saved, dirty, saving } = useSettingsForm(
    ['seo', 'analytics', 'antispam'],
    settings,
  );
  const nullable = (value: string) => (value.trim() ? value.trim() : null);
  return (
    <>
      <EditorHeader
        level={2}
        title={copy.settings.tabs.seo}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={() => void submit()}
      />
      <div className="mt-[26px] flex max-w-[760px] flex-col gap-4">
        <Panel>
          <Text label={copy.settings.seo.defaultTitle} error={errors['seo.defaultTitle']}>
            <input
              value={form.seo.defaultTitle}
              onChange={(e) => set('seo', { defaultTitle: e.target.value })}
              className={inputClass}
            />
          </Text>
          <Text label={copy.settings.seo.defaultDescription} error={errors['seo.defaultDescription']}>
            <textarea
              value={form.seo.defaultDescription}
              onChange={(e) => set('seo', { defaultDescription: e.target.value })}
              rows={3}
              className={textareaClass}
            />
          </Text>
          <Text
            label={copy.settings.seo.googleVerification}
            hint={copy.settings.seo.verificationHint}
            error={errors['seo.googleVerification']}
          >
            <input
              value={form.seo.googleVerification ?? ''}
              onChange={(e) => set('seo', { googleVerification: nullable(e.target.value) })}
              className={inputClass}
              spellCheck={false}
            />
          </Text>
          <Text label={copy.settings.seo.yandexVerification} error={errors['seo.yandexVerification']}>
            <input
              value={form.seo.yandexVerification ?? ''}
              onChange={(e) => set('seo', { yandexVerification: nullable(e.target.value) })}
              className={inputClass}
              spellCheck={false}
            />
          </Text>
          <OgImage id={form.seo.ogMediaId} onChange={(ogMediaId) => set('seo', { ogMediaId })} />
        </Panel>
        <Panel>
          <Text
            label={copy.settings.seo.umami}
            hint={copy.settings.seo.umamiHint}
            error={errors['analytics.umamiWebsiteId']}
          >
            <input
              value={form.analytics.umamiWebsiteId ?? ''}
              onChange={(e) => set('analytics', { umamiWebsiteId: nullable(e.target.value) })}
              className={inputClass}
              spellCheck={false}
            />
          </Text>
          <Text label={copy.settings.seo.pixel} error={errors['analytics.metaPixelId']}>
            <input
              value={form.analytics.metaPixelId ?? ''}
              onChange={(e) => set('analytics', { metaPixelId: nullable(e.target.value) })}
              inputMode="numeric"
              className={inputClass}
            />
          </Text>
          <SwitchLine
            label={copy.settings.seo.pixelOn}
            hint={copy.settings.seo.pixelHint}
            checked={form.analytics.metaPixelEnabled}
            onChange={(metaPixelEnabled) => set('analytics', { metaPixelEnabled })}
          />
        </Panel>
        <Panel>
          <SwitchLine
            label={copy.settings.seo.turnstile}
            hint={copy.settings.seo.turnstileHint}
            checked={form.antispam.turnstileEnabled}
            onChange={(turnstileEnabled) => set('antispam', { turnstileEnabled })}
          />
        </Panel>
      </div>
    </>
  );
}

/** Share image (1200 × 630): stored as an id in the `seo` setting, shown from the media record. */
function OgImage({ id, onChange }: { id: string | null; onChange: (id: string | null) => void }) {
  const stored = useMedia(id);
  const [uploaded, setUploaded] = useState<AdminMedia | null>(null);
  const media = id ? (uploaded?.id === id ? uploaded : (stored.data ?? null)) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{copy.settings.seo.ogImage}</span>
      <ImageSlot
        media={media}
        label="1200 × 630"
        purpose="seo"
        onChange={(next) => {
          setUploaded(next);
          onChange(next.id);
        }}
        {...(id ? { onRemove: () => onChange(null) } : {})}
        className="aspect-[1200/630] w-full max-w-[420px] rounded-xl"
      />
      <span className="text-[13px] leading-normal text-muted">{copy.settings.seo.ogImageHint}</span>
    </div>
  );
}

function testSummary(result: NotificationTestResult): string {
  const t = copy.settings.notifications;
  return (['telegram', 'email'] as const)
    .filter((channel) => result[channel] !== 'off')
    .map((channel) => `${t.channel[channel]}: ${t.result[result[channel]]}`)
    .join('. ');
}

function NotificationsForm({ settings }: { settings: AdminSettings }) {
  const { form, set, submit, errors, saved, dirty, saving } = useSettingsForm(['notifications'], settings);
  const n = form.notifications;
  const test = useNotificationTest();
  const anyChannel = n.telegramEnabled || n.emailEnabled;
  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (result) => {
        const ok =
          result.telegram !== 'failed' &&
          result.email !== 'failed' &&
          (result.telegram === 'sent' || result.email === 'sent');
        if (ok) toast.success(testSummary(result));
        else toast.error(testSummary(result));
      },
      onError: (error) => toast.error(errorText(error)),
    });
  return (
    <>
      <EditorHeader
        level={2}
        title={copy.settings.tabs.notifications}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={() => void submit()}
      />
      <div className="mt-[26px] flex max-w-[760px] flex-col gap-4">
        <Panel>
          <SwitchLine
            label={copy.settings.notifications.telegram}
            checked={n.telegramEnabled}
            onChange={(telegramEnabled) => set('notifications', { telegramEnabled })}
          />
          <Text
            label={copy.settings.notifications.telegramChat}
            hint={copy.settings.notifications.telegramHint}
            error={errors['notifications.telegramChatId']}
          >
            <input
              value={n.telegramChatId ?? ''}
              onChange={(e) => set('notifications', { telegramChatId: e.target.value.trim() || null })}
              className={inputClass}
              spellCheck={false}
            />
          </Text>
        </Panel>
        <Panel>
          <SwitchLine
            label={copy.settings.notifications.email}
            checked={n.emailEnabled}
            onChange={(emailEnabled) => set('notifications', { emailEnabled })}
          />
          <Text
            label={copy.settings.notifications.emailAddress}
            hint={copy.settings.notifications.emailHint}
            error={errors['notifications.email']}
          >
            <input
              type="email"
              value={n.email ?? ''}
              onChange={(e) => set('notifications', { email: e.target.value.trim() || null })}
              className={inputClass}
            />
          </Text>
        </Panel>
        <Panel>
          <SwitchLine
            label={copy.settings.notifications.leads}
            checked={n.notifyLeads}
            onChange={(notifyLeads) => set('notifications', { notifyLeads })}
          />
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] leading-normal text-muted">
              {dirty
                ? copy.settings.notifications.testSaveFirst
                : anyChannel
                  ? copy.settings.notifications.testHint
                  : copy.settings.notifications.testNothing}
            </span>
            <Button variant="outline" onClick={runTest} disabled={dirty || !anyChannel || test.isPending}>
              {test.isPending && <Spinner />}
              {copy.settings.notifications.test}
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function SwitchLine({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold">{label}</span>
        {hint && <span className="text-[13px] leading-normal text-muted">{hint}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

const TEMPLATE_KEYS = ['link', 'paidLocal', 'paidAbroad'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** «Оплата» (docs/finik/SPEC.md §7.2): connection, the switch for the site, link lifetime and the WhatsApp texts. */
function PaymentsForm({ settings }: { settings: AdminSettings }) {
  const { form, set, submit, errors, saved, dirty, saving } = useSettingsForm(['payments'], settings);
  const payments = form.payments;
  const status = useFinikStatus();
  const configured = status.data?.configured ?? false;
  const t = copy.settings.payments;
  return (
    <>
      <EditorHeader
        level={2}
        title={copy.settings.tabs.payments}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={() => void submit()}
      />
      <div className="mt-[26px] flex max-w-[760px] flex-col gap-4">
        <ConnectionPanel status={status.data} failed={status.isError} />
        <Panel>
          <SwitchLine
            label={t.enabled}
            hint={configured || status.isPending ? t.enabledHint : t.enabledOff}
            checked={payments.finikEnabled}
            // Switching off always works; switching on needs Finik's keys on the server.
            disabled={!payments.finikEnabled && !configured}
            onChange={(finikEnabled) => set('payments', { finikEnabled })}
          />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Text label={t.defaultMethod}>
              <select
                value={payments.defaultMethod}
                onChange={(e) =>
                  set('payments', { defaultMethod: e.target.value === 'finik' ? 'finik' : 'whatsapp' })
                }
                className={selectClass}
              >
                <option value="finik">{t.methods.finik}</option>
                <option value="whatsapp">{t.methods.whatsapp}</option>
              </select>
            </Text>
            <Text label={t.ttl} hint={t.ttlHint} error={errors['payments.linkTtlMinutes']}>
              <input
                type="number"
                min={10}
                max={1440}
                step={1}
                value={Number.isNaN(payments.linkTtlMinutes) ? '' : payments.linkTtlMinutes}
                onChange={(e) => set('payments', { linkTtlMinutes: e.target.valueAsNumber })}
                className={inputClass}
              />
            </Text>
          </div>
          <SwitchLine
            label={t.visa}
            hint={t.visaHint}
            checked={payments.visa}
            onChange={(visa) => set('payments', { visa })}
          />
          <SwitchLine
            label={t.notifyUnpaid}
            hint={t.notifyUnpaidHint}
            checked={payments.notifyUnpaid}
            onChange={(notifyUnpaid) => set('payments', { notifyUnpaid })}
          />
        </Panel>
        <Panel title={t.templates} hint={t.templatesHint}>
          {TEMPLATE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <Text label={t.template[key]} error={errors[`payments.templates.${key}`]}>
                <textarea
                  value={payments.templates[key]}
                  rows={3}
                  maxLength={1000}
                  onChange={(e) =>
                    set('payments', { templates: { ...payments.templates, [key]: e.target.value } })
                  }
                  className={textareaClass}
                />
              </Text>
              {payments.templates[key] !== DEFAULT_WHATSAPP_TEMPLATES[key] && (
                <button
                  type="button"
                  onClick={() =>
                    set('payments', {
                      templates: { ...payments.templates, [key]: DEFAULT_WHATSAPP_TEMPLATES[key] },
                    })
                  }
                  className="h-9 self-start text-[13px] font-semibold text-muted underline underline-offset-2 hover:text-ink"
                >
                  {t.reset}
                </button>
              )}
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

/** What the server is connected to, and the 1 сом check: create → pay on Finik → the webhook confirms it. */
function ConnectionPanel({ status, failed }: { status: FinikStatus | undefined; failed: boolean }) {
  const t = copy.settings.payments;
  const [params] = useSearchParams();
  const returned = params.get('check');
  // Back from the check payment page (`?check=<id>`): keep watching that check.
  const [checkId, setCheckId] = useState<string | null>(returned && UUID.test(returned) ? returned : null);
  const start = useStartFinikCheck();
  const check = usePaymentCheck(checkId);

  const run = () =>
    start.mutate(undefined, {
      onSuccess: (result) => setCheckId(result.id),
      onError: (error) => toast.error(errorText(error)),
    });

  const mode = status?.environment ? t.environment[status.environment] : t.notConfigured;
  return (
    <Panel title={t.connection}>
      {failed ? (
        <span className="text-[15px] text-muted">{copy.errors.load}</span>
      ) : !status ? (
        <Spinner />
      ) : (
        <dl className="grid gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-[200px_1fr]">
          <dt className="text-muted">{t.mode}</dt>
          <dd className={cn('font-semibold', status.environment === 'prod' && 'text-green')}>{mode}</dd>
          {status.accountId && (
            <>
              <dt className="text-muted">{t.account}</dt>
              <dd>{status.accountId}</dd>
            </>
          )}
          {status.webhookUrl && (
            <>
              <dt className="text-muted">{t.webhook}</dt>
              <dd className="break-all">{status.webhookUrl}</dd>
            </>
          )}
        </dl>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 pt-3.5">
        <span className="max-w-[440px] text-[13px] leading-normal text-muted">{t.checkHint}</span>
        <Button
          variant="outline"
          onClick={run}
          disabled={!status?.configured || start.isPending || check.data?.status === 'pending'}
        >
          {start.isPending && <Spinner />}
          {t.check}
        </Button>
      </div>
      {check.data && <CheckResult check={check.data} mock={status?.environment === 'mock'} />}
    </Panel>
  );
}

/** In mock mode the check runs against the local stand-in, which proves nothing about Finik: the texts say so. */
function CheckResult({ check, mock }: { check: PaymentCheck; mock: boolean }) {
  const t = copy.settings.payments;
  if (check.status === 'succeeded') {
    if (mock) {
      return (
        <p className="text-[15px] font-semibold" role="status">
          {t.checkPaidMock}
        </p>
      );
    }
    return (
      <p className="text-[15px] font-semibold text-green" role="status">
        {t.checkPaid}
      </p>
    );
  }
  if (check.status === 'failed') {
    return (
      <p className="text-[15px] break-words text-red" role="status">
        {t.checkFailed(check.error ?? '')}
      </p>
    );
  }
  if (check.status === 'expired') {
    return (
      <p className="text-[15px] text-muted" role="status">
        {t.checkExpired}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="status">
      <p className="text-[15px] leading-normal">{mock ? t.checkPendingMock : t.checkPending}</p>
      <div className="flex flex-wrap items-center gap-4">
        {check.url && (
          <a
            href={check.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-hover"
          >
            {t.checkOpen}
          </a>
        )}
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Spinner />
          {t.checkWaiting}
        </span>
      </div>
    </div>
  );
}

const USER_COLUMNS = '1.6fr 1fr 1fr 1fr 220px';

function UsersTab() {
  const me = useUser();
  const users = useUsers();
  const actions = useUserActions();
  const [draft, setDraft] = useState({ email: '', name: '', role: 'manager' as UserRole, password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);

  const create = (event: FormEvent) => {
    event.preventDefault();
    actions.create.mutate(draft, {
      onSuccess: () => {
        toast.success(copy.settings.users.created);
        setDraft({ email: '', name: '', role: 'manager', password: '' });
        setErrors({});
      },
      onError: (error) => {
        setErrors(fieldErrors(error));
        toast.error(errorText(error));
      },
    });
  };
  const update = (user: AdminUser, change: { role?: UserRole; isActive?: boolean }) =>
    actions.update.mutate(
      { id: user.id, change },
      { onSuccess: () => toast.success(copy.saved), onError: (error) => toast.error(errorText(error)) },
    );

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-x-auto">
        <div role="table" style={{ '--table-min': '760px' } as CSSProperties}>
          <TableHead columns={USER_COLUMNS}>
            <span>{copy.settings.users.name}</span>
            <span>{copy.settings.users.role}</span>
            <span>{copy.settings.users.lastLogin}</span>
            <span>{copy.settings.users.active}</span>
            <span />
          </TableHead>
          {users.data?.map((user) => {
            const self = user.id === me.id;
            return (
              <TableRow
                key={user.id}
                style={{ gridTemplateColumns: USER_COLUMNS }}
                className="grid min-h-16 min-w-[760px] items-center gap-3 border-b border-line-2 px-[22px] py-2 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">
                    {user.name}{' '}
                    {self && <span className="font-normal text-muted">({copy.settings.users.you})</span>}
                  </span>
                  <span className="truncate text-[13px] text-muted">{user.email}</span>
                </span>
                <select
                  value={user.role}
                  disabled={self}
                  onChange={(e) => update(user, { role: e.target.value as UserRole })}
                  aria-label={`${copy.settings.users.role}: ${user.name}`}
                  className={cn(selectClass, 'h-10')}
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {USER_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted">
                  {user.lastLoginAt
                    ? relativeDateTime(new Date(user.lastLoginAt))
                    : copy.settings.users.never}
                </span>
                <Toggle
                  checked={user.isActive}
                  disabled={self}
                  onChange={(isActive) => update(user, { isActive })}
                  label={`${copy.settings.users.active}: ${user.name}`}
                />
                <Button variant="outline" className="h-10 text-sm" onClick={() => setPasswordFor(user)}>
                  {copy.settings.users.setPassword}
                </Button>
              </TableRow>
            );
          })}
          {users.isPending && <TableMessage>{copy.loading}</TableMessage>}
        </div>
      </Card>

      {passwordFor && <PasswordForm user={passwordFor} onDone={() => setPasswordFor(null)} />}

      <Panel title={copy.settings.users.add} hint={copy.settings.users.roleHint}>
        <form onSubmit={create} className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Text label={copy.settings.users.name} error={errors.name}>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
                required
              />
            </Text>
            <Text label={copy.settings.users.email} error={errors.email}>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className={inputClass}
                autoComplete="off"
                required
              />
            </Text>
            <Text label={copy.settings.users.role}>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
                className={selectClass}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </Text>
            <Text
              label={copy.settings.users.password}
              hint={copy.settings.users.passwordHint}
              error={errors.password}
            >
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className={inputClass}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </Text>
          </div>
          <Button type="submit" disabled={actions.create.isPending} className="self-start">
            {copy.settings.users.add}
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function PasswordForm({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const actions = useUserActions();
  const [password, setPassword] = useState('');
  return (
    <Panel title={`${copy.settings.users.setPassword}: ${user.name}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          actions.password.mutate(
            { id: user.id, password },
            {
              onSuccess: () => {
                toast.success(copy.settings.users.passwordChanged);
                onDone();
              },
              onError: (error) => toast.error(errorText(error)),
            },
          );
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold">{copy.settings.users.newPassword}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <Button type="submit" disabled={actions.password.isPending || password.length < 10}>
          {copy.editor.save}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {copy.editor.cancel}
        </Button>
      </form>
    </Panel>
  );
}

function SecurityTab() {
  const actions = useUserActions();
  return (
    <Panel title={copy.settings.security.title} className="max-w-[760px]">
      <p className="text-[15px] leading-normal text-muted">{copy.settings.security.text}</p>
      <Button
        variant="danger"
        className="self-start"
        disabled={actions.revokeOthers.isPending}
        onClick={() =>
          actions.revokeOthers.mutate(undefined, {
            onSuccess: (result) => toast.success(copy.settings.security.done(result.revoked)),
            onError: (error) => toast.error(errorText(error)),
          })
        }
      >
        {copy.settings.security.action}
      </Button>
    </Panel>
  );
}

const AUDIT_COLUMNS = '170px 160px 1fr';

function AuditTab() {
  const audit = useAudit('');
  const rows = audit.data?.pages.flatMap((page) => page.items) ?? [];
  const describe = (entity: string, action: string, diff: Record<string, unknown>): ReactNode => {
    const what = copy.settings.audit.entities[entity] ?? entity;
    const how = copy.settings.audit.actions[action] ?? action;
    const detail =
      typeof diff.slug === 'string'
        ? ` · ${diff.slug}`
        : typeof diff.number === 'number'
          ? ` · №${diff.number}`
          : '';
    return `${what}: ${how}${detail}`;
  };
  return (
    <div className="flex flex-col gap-4">
      <span className="text-[15px] text-muted">{copy.settings.audit.lead}</span>
      <Card className="overflow-x-auto">
        <div role="table" style={{ '--table-min': '620px' } as CSSProperties}>
          <TableHead columns={AUDIT_COLUMNS}>
            <span>{copy.settings.audit.when}</span>
            <span>{copy.settings.audit.who}</span>
            <span>{copy.settings.audit.what}</span>
          </TableHead>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              style={{ gridTemplateColumns: AUDIT_COLUMNS }}
              className="grid min-h-12 min-w-[620px] items-center gap-3 border-b border-line-2 px-[22px] text-sm last:border-b-0"
            >
              <span className="text-muted">{relativeDateTime(new Date(row.at))}</span>
              <span>{row.userName ?? copy.settings.audit.system}</span>
              <span>{describe(row.entity, row.action, row.diff)}</span>
            </TableRow>
          ))}
          {audit.isPending && <TableMessage>{copy.loading}</TableMessage>}
          {audit.data && rows.length === 0 && <TableMessage>{copy.settings.audit.empty}</TableMessage>}
        </div>
      </Card>
      {audit.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => void audit.fetchNextPage()}
          disabled={audit.isFetchingNextPage}
        >
          {copy.loadMore}
        </Button>
      )}
    </div>
  );
}
