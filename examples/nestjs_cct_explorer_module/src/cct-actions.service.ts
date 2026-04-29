import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DEVICE_GATEWAY_TOKEN } from './tokens';
import type {
  DeviceGateway,
  ReportResultMessage,
  ScriptDispatchAck,
} from './device-gateway.interface';

type PendingAction = {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

type EarlyReport = {
  result: unknown;
};

type NormalizedReport = {
  jobId?: string;
  result?: unknown;
};

export type RunScriptActionOptions = {
  timeoutMs?: number;
};

@Injectable()
export class CctActionsService implements OnModuleInit, OnModuleDestroy {
  private readonly pending = new Map<string, PendingAction>();
  private readonly earlyReports = new Map<string, EarlyReport>();
  private unsubscribeReport?: () => void;

  constructor(
    @Inject(DEVICE_GATEWAY_TOKEN)
    private readonly gateway: DeviceGateway,
  ) {}

  onModuleInit() {
    if (typeof this.gateway.onReportResult === 'function') {
      this.unsubscribeReport = this.gateway.onReportResult((device, message) => {
        this.handleReport(device, message);
      });
    }
  }

  onModuleDestroy() {
    this.unsubscribeReport?.();
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('action_service_destroyed'));
    }
    this.pending.clear();
    this.earlyReports.clear();
  }

  async runLocalScriptAction(
    device: string,
    input: { filename: string; params?: any },
    options: RunScriptActionOptions = {},
  ): Promise<unknown> {
    if (typeof this.gateway.execLocalScript !== 'function') {
      throw new Error('gateway_exec_local_script_not_implemented');
    }
    return this.dispatchAndWait(
      device,
      () => this.gateway.execLocalScript!(device, input),
      options.timeoutMs,
    );
  }

  async runRemoteScriptAction(
    device: string,
    input: { raw: Buffer | string; params?: any },
    options: RunScriptActionOptions = {},
  ): Promise<unknown> {
    if (typeof this.gateway.execRemoteScript !== 'function') {
      throw new Error('gateway_exec_remote_script_not_implemented');
    }
    return this.dispatchAndWait(
      device,
      () => this.gateway.execRemoteScript!(device, input),
      options.timeoutMs,
    );
  }

  private async dispatchAndWait(
    device: string,
    dispatch: () => Promise<ScriptDispatchAck>,
    timeoutMs = 360000,
  ): Promise<unknown> {
    console.log('[CctActionsService] dispatch', { device, timeoutMs });
    const ack = await dispatch();
    console.log('[CctActionsService] ack', {
      device,
      status: ack.status,
      jobId: ack.jobId,
      position: ack.position,
      reason: ack.reason,
    });
    if (ack.status === 'overflow') {
      console.warn('[CctActionsService] overflow', { device, reason: ack.reason });
      throw new Error(ack.reason || 'queue_overflow');
    }
    if (!ack.jobId) {
      throw new Error('job_id_missing');
    }
    if (typeof this.gateway.onReportResult !== 'function') {
      throw new Error('gateway_report_result_subscription_not_implemented');
    }
    const key = this.actionKey(device, ack.jobId);
    if (this.pending.has(key)) {
      throw new Error(`duplicated_pending_action:${key}`);
    }
    const earlyReport = this.earlyReports.get(key);
    if (earlyReport) {
      this.earlyReports.delete(key);
      console.log('[CctActionsService] early report consumed', { key });
      return earlyReport.result;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        console.warn('[CctActionsService] timeout', { key, timeoutMs });
        reject(new Error('action_timeout'));
      }, timeoutMs);
      this.pending.set(key, { resolve, reject, timer });
      console.log('[CctActionsService] pending registered', { key });
    });
  }

  private handleReport(device: string, message: ReportResultMessage) {
    const normalized = this.normalizeReportMessage(message);
    const { jobId, result } = normalized;
    if (!jobId) return;
    const key = this.actionKey(device, jobId);
    const pending = this.pending.get(key);
    if (!pending) {
      this.earlyReports.set(key, { result });
      console.warn('[CctActionsService] early report cached (pending missing)', { key });
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(key);
    const resultSummary =
      result == null
        ? 'null'
        : Buffer.isBuffer(result)
          ? `buffer(len=${result.length})`
          : typeof result === 'string'
            ? `string(len=${result.length})`
            : Array.isArray(result)
              ? `array(len=${result.length})`
              : typeof result;
    console.log('[CctActionsService] resolved', { key, resultSummary });
    console.log('[CctActionsService] resolved value', { key, result });
    pending.resolve(result);
  }

  private actionKey(device: string, jobId: string) {
    return `${device}:${jobId}`;
  }

  private normalizeReportMessage(message: ReportResultMessage): NormalizedReport {
    const raw = message as any;
    const payload = raw?.payload ?? raw?.data ?? raw?.body;
    const jobId = payload?.jobId ?? raw?.jobId;
    const result = payload?.result ?? raw?.result;
    return { jobId, result };
  }
}
