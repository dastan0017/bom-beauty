import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationTestResult } from '@bom/shared';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { leadMessage, orderMessage } from './messages';

type Entity = { entity: 'order' | 'lead'; id: string };

/** New orders (and leads, if enabled) to Telegram; email when Telegram is off or keeps failing (§7.8). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Called after an order or lead is stored. Never throws into the request. */
  async enqueue(target: Entity): Promise<void> {
    const n = await this.settings.get('notifications');
    if (target.entity === 'lead' && !n.notifyLeads) return;
    if (n.telegramEnabled && n.telegramChatId && this.env.TELEGRAM_BOT_TOKEN) {
      await this.jobs.addSafely('notify.telegram', target);
    } else if (n.emailEnabled && n.email && this.env.SMTP_URL) {
      await this.jobs.addSafely('notify.email', target);
    }
  }

  async telegram(target: Entity): Promise<void> {
    const n = await this.settings.get('notifications');
    if (!n.telegramEnabled || !n.telegramChatId || !this.env.TELEGRAM_BOT_TOKEN) return;
    const message = await this.message(target);
    if (message) await this.sendTelegram(n.telegramChatId, message.html);
  }

  async email(target: Entity): Promise<void> {
    const n = await this.settings.get('notifications');
    if (!n.emailEnabled || !n.email || !this.env.SMTP_URL) return;
    const message = await this.message(target);
    if (message) await this.sendEmail(n.email, message.subject, message.text);
  }

  /** Telegram gave up after its retries: try email instead. */
  async telegramFailed(target: Entity): Promise<void> {
    const n = await this.settings.get('notifications');
    if (n.emailEnabled && n.email && this.env.SMTP_URL) await this.jobs.addSafely('notify.email', target);
  }

  /** "Отправить тест" in Настройки → Уведомления: both channels, right now. */
  async test(): Promise<NotificationTestResult> {
    const n = await this.settings.get('notifications');
    const text = 'Проверка уведомлений Bom Beauty. Если вы это видите, новые заказы будут приходить сюда.';
    const result: NotificationTestResult = { telegram: 'off', email: 'off', error: null };
    if (n.telegramEnabled) {
      if (!n.telegramChatId || !this.env.TELEGRAM_BOT_TOKEN) result.telegram = 'not_configured';
      else
        try {
          await this.sendTelegram(n.telegramChatId, text);
          result.telegram = 'sent';
        } catch (error) {
          result.telegram = 'failed';
          result.error = String(error);
        }
    }
    if (n.emailEnabled) {
      if (!n.email || !this.env.SMTP_URL) result.email = 'not_configured';
      else
        try {
          await this.sendEmail(n.email, 'Проверка уведомлений', text);
          result.email = 'sent';
        } catch (error) {
          result.email = 'failed';
          result.error ??= String(error);
        }
    }
    return result;
  }

  private async message(target: Entity) {
    if (target.entity === 'order') {
      const order = await this.prisma.order.findUnique({
        where: { id: target.id },
        select: {
          id: true,
          number: true,
          itemTitle: true,
          itemType: true,
          qty: true,
          totalKgs: true,
          name: true,
          phone: true,
          address: true,
          comment: true,
          fromQuiz: true,
        },
      });
      return order ? orderMessage(order, this.env.ADMIN_ORIGIN) : null;
    }
    const lead = await this.prisma.lead.findUnique({
      where: { id: target.id },
      select: { kind: true, answers: true, recommended: true, choose: true },
    });
    if (!lead) return null;
    const programs = lead.recommended.length
      ? await this.prisma.program.findMany({
          where: { slug: { in: lead.recommended } },
          select: { slug: true, title: true },
        })
      : [];
    return leadMessage(
      {
        kind: lead.kind,
        answers: (lead.answers ?? {}) as Record<string, unknown>,
        recommendedTitles: lead.recommended.map(
          (slug) => programs.find((p) => p.slug === slug)?.title ?? slug,
        ),
        choose: lead.choose,
      },
      this.env.ADMIN_ORIGIN,
    );
  }

  private async sendTelegram(chatId: string, html: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // The body explains the problem (wrong chat id, bot blocked); the token never appears in it.
      throw new Error(`Telegram ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
  }

  private async sendEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.env.SMTP_URL) return;
    this.transporter ??= createTransport(this.env.SMTP_URL);
    await this.transporter.sendMail({
      from: this.env.MAIL_FROM ?? 'Bom Beauty <no-reply@bom-beauty.com>',
      to,
      subject,
      text,
    });
  }
}
