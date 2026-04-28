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

export type RunScriptActionOptions = {
  timeoutMs?: number;
};

@Injectable()
export class CctActionsService implements OnModuleInit, OnModuleDestroy {
  private readonly pending = new Map<string, PendingAction>();
  private unsubscribeReport?: () => void;

  constructor(
    @Inject(DEVICE_GATEWAY_TOKEN)
    private readonly gateway: DeviceGateway,
  ) {}

  onModuleInit() {
    if (typeof this.gateway.onReportResult === 'function') {
      console.log('[CctActionsService] subscribe report_result');
      this.unsubscribeReport = this.gateway.onReportResult((device, message) => {
        this.handleReport(device, message);
      });
    } else {
      console.warn('[CctActionsService] onReportResult is not implemented by gateway');
    }
  }

  onModuleDestroy() {
    this.unsubscribeReport?.();
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('action_service_destroyed'));
    }
    this.pending.clear();
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
    console.log('[CctActionsService] dispatch action', { device, timeoutMs });
    const ack = await dispatch();
    console.log('[CctActionsService] dispatch ack', { device, ack });
    if (ack.status === 'overflow') {
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

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        console.warn('[CctActionsService] action timeout', { key, timeoutMs });
        reject(new Error('action_timeout'));
      }, timeoutMs);
      this.pending.set(key, { resolve, reject, timer });
      console.log('[CctActionsService] pending action registered', {
        key,
        pendingSize: this.pending.size,
      });
    });
  }

  private handleReport(device: string, message: ReportResultMessage) {
    const jobId = message?.payload?.jobId;
    console.log('[CctActionsService] report_result received', { device, jobId, message });
    if (!jobId) return;
    const key = this.actionKey(device, jobId);
    const pending = this.pending.get(key);
    if (!pending) {
      console.warn('[CctActionsService] no pending action matched report', { key });
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(key);
    console.log('[CctActionsService] action resolved', { key, pendingSize: this.pending.size });
    pending.resolve(message.payload?.result);
  }

  private actionKey(device: string, jobId: string) {
    return `${device}:${jobId}`;
  }
}
