import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  formatKgs,
  paidTemplateFor,
  renderWhatsappTemplate,
  type NotificationTestResult,
  type WhatsappTemplateKey,
} from '@bom/shared';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import type { Prisma } from '../generated/prisma/client';
import { JobsService } from '../jobs/jobs.service';
import type { NotifyTarget } from '../jobs/queues';
import { FINIK_CONFIG, isFinikConfigured, type FinikConfig } from '../payments/finik/finik.config';
import { payPageUrl } from '../payments/pay-url';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  checkPaidMessage,
  leadMessage,
  orderMessage,
  paidMessage,
  reviewMessage,
  unpaidMessage,
  whatsappOrderMessage,
  type CustomerText,
  type MessageButton,
  type OutgoingMessage,
  type PaymentOrderForMessage,
} from './messages';

const orderSelect = {
  id: true,
  number: true,
  lines: { orderBy: { position: 'asc' }, select: { type: true, title: true, qty: true } },
  totalKgs: true,
  adjustmentKgs: true,
  adjustmentNote: true,
  name: true,
  phone: true,
  address: true,
  comment: true,
  fromQuiz: true,
  payToken: true,
  paymentMethod: true,
} satisfies Prisma.OrderSelect;
type OrderForNotice = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

/**
 * Orders, payments (and leads, if enabled) to Telegram; email when Telegram is off or keeps failing (§7.8). Payment
 * messages carry the WhatsApp text the owner can send with one tap (docs/finik/SPEC.md §0).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
    @Inject(ENV) private readonly env: Env,
    @Inject(FINIK_CONFIG) private readonly finik: FinikConfig,
  ) {}

  /** Called after an order, lead or payment event is stored. Never throws into the request. */
  async enqueue(target: NotifyTarget): Promise<void> {
    const n = await this.settings.get('notifications');
    if (target.entity === 'lead' && !n.notifyLeads) return;
    if (n.telegramEnabled && n.telegramChatId && this.env.TELEGRAM_BOT_TOKEN) {
      await this.jobs.addSafely('notify.telegram', target);
    } else if (n.emailEnabled && n.email && this.env.SMTP_URL) {
      await this.jobs.addSafely('notify.email', target);
    }
  }

  async telegram(target: NotifyTarget): Promise<void> {
    const n = await this.settings.get('notifications');
    if (!n.telegramEnabled || !n.telegramChatId || !this.env.TELEGRAM_BOT_TOKEN) return;
    const message = await this.message(target);
    if (message) await this.sendTelegram(n.telegramChatId, message.html, message.buttons);
  }

  async email(target: NotifyTarget): Promise<void> {
    const n = await this.settings.get('notifications');
    if (!n.emailEnabled || !n.email || !this.env.SMTP_URL) return;
    const message = await this.message(target);
    if (message) await this.sendEmail(n.email, message.subject, message.text);
  }

  /** Telegram gave up after its retries: try email instead. */
  async telegramFailed(target: NotifyTarget): Promise<void> {
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
          await this.sendTelegram(n.telegramChatId, text, []);
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

  private async message(target: NotifyTarget): Promise<OutgoingMessage | null> {
    const admin = this.env.ADMIN_ORIGIN;
    if (target.entity === 'lead') return this.leadNotice(target.id);

    if (target.entity === 'order') {
      const order = await this.prisma.order.findUnique({ where: { id: target.id }, select: orderSelect });
      if (!order) return null;
      if (target.event === 'unpaid') {
        return unpaidMessage(toMessageOrder(order), await this.customerText(order, 'link', true), admin);
      }
      // A WhatsApp order gets its payment link while online payment is on; otherwise the message stays as before.
      if (order.paymentMethod === 'whatsapp' && (await this.paymentsOn())) {
        return whatsappOrderMessage(
          toMessageOrder(order),
          await this.customerText(order, 'link', false),
          admin,
        );
      }
      return { ...orderMessage(toMessageOrder(order), admin), buttons: [] };
    }

    if (target.event === 'check_paid') return checkPaidMessage(admin);
    const payment = await this.prisma.payment.findUnique({
      where: { id: target.id },
      select: {
        orderId: true,
        amountKgs: true,
        channel: true,
        paidAmountTyiyn: true,
        order: { select: orderSelect },
      },
    });
    if (!payment) return null;
    if (target.event === 'review') {
      return reviewMessage(
        {
          reason: target.reason ?? 'amount',
          number: payment.order?.number ?? null,
          orderId: payment.orderId,
          paidKgs: payment.paidAmountTyiyn === null ? null : payment.paidAmountTyiyn / 100,
          // What the order costs now (an adjustment may have changed it since the link was issued).
          expectedKgs: payment.order
            ? payment.order.totalKgs + payment.order.adjustmentKgs
            : payment.amountKgs,
        },
        admin,
      );
    }
    if (!payment.order) return null;
    const order = payment.order;
    return paidMessage(
      toMessageOrder(order),
      payment,
      await this.customerText(order, paidTemplateFor(order.phone), false),
      admin,
    );
  }

  /** The owner's WhatsApp template filled for this order (docs/finik/SPEC.md §0.4). */
  private async customerText(
    order: OrderForNotice,
    key: WhatsappTemplateKey,
    reminder: boolean,
  ): Promise<CustomerText> {
    const { templates } = await this.settings.get('payments');
    const whatsappText = renderWhatsappTemplate(templates[key], {
      name: order.name,
      number: order.number,
      total: formatKgs(order.totalKgs + order.adjustmentKgs),
      address: order.address,
      link: payPageUrl(this.env.WEB_ORIGIN, order.payToken),
    });
    const button =
      key === 'link'
        ? reminder
          ? '💬 Отправить ссылку'
          : '💬 Отправить ссылку на оплату'
        : '💬 Написать о доставке';
    return { whatsappText, button };
  }

  private async paymentsOn(): Promise<boolean> {
    return isFinikConfigured(this.finik) && (await this.settings.get('payments')).finikEnabled;
  }

  private async leadNotice(id: string): Promise<OutgoingMessage | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { kind: true, answers: true, recommended: true, choose: true },
    });
    if (!lead) return null;
    const programs = lead.recommended.length
      ? await this.prisma.program.findMany({
          where: { slug: { in: lead.recommended } },
          select: { slug: true, title: true },
        })
      : [];
    const message = leadMessage(
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
    return { ...message, buttons: [] };
  }

  private async sendTelegram(chatId: string, html: string, buttons: MessageButton[]): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(buttons.length ? { reply_markup: { inline_keyboard: buttons.map((button) => [button]) } } : {}),
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

function toMessageOrder(order: OrderForNotice): PaymentOrderForMessage {
  return {
    id: order.id,
    number: order.number,
    lines: order.lines,
    totalKgs: order.totalKgs,
    adjustmentKgs: order.adjustmentKgs,
    adjustmentNote: order.adjustmentNote,
    name: order.name,
    phone: order.phone,
    address: order.address,
    comment: order.comment,
    fromQuiz: order.fromQuiz,
  };
}
