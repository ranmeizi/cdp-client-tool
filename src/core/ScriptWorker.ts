import { Worker } from 'node:worker_threads'
import { Socket } from 'socket.io-client';
import { EVENTS, ScriptJob } from 'src/common';
import { logger } from 'src/logger';


type ScriptWorkerOptions = {
    job: ScriptJob
    timeout: number,
    sockets: Map<string, Socket>
}

export class ScriptWorker {

    public worker: Worker
    private timeoutTimer?: NodeJS.Timeout

    constructor(
        private readonly options: ScriptWorkerOptions,
    ) {
    }

    /** 主进程侧上报，与脚本内 reportResult → postMessage 最终事件形态一致 */
    private emitReportToGateway(jobId: string, result: unknown): void {
        const name = this.options.job.gatewayName;
        const socket = name ? this.options.sockets.get(name) : undefined;
        if (!socket) {
            logger.warn('[ScriptWorker] report_result skipped: no socket', { jobId, gatewayName: name });
            return;
        }
        socket.emit(EVENTS.REPORT_RESULT, {
            payload: { jobId, result },
        });
    }

    /** 中断 Worker 执行，会取消超时定时器并 terminate */
    public terminate(): void {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = undefined;
        }
        this.worker?.terminate();
    }

    public run(): Promise<void> {
        if (this.options.job.type === 'local') {
            const { filename, params } = this.options.job;

            this.worker = new Worker(filename, {
                workerData: {
                    params,
                },
            });

        } else {
            const { script, params } = this.options.job;

            this.worker = new Worker(script, {
                eval: true,
                workerData: {
                    params,
                },
            });
        }

        const jobId = this.options.job.id;
        const jobType = this.options.job.type;
        console.log('[ScriptWorker] start', { jobId, jobType, timeout: this.options.timeout });

        return new Promise((resolve, reject) => {
            let settled = false;
            let failureReported = false;

            const reportFailureOnce = (result: Record<string, unknown>) => {
                if (failureReported) return;
                failureReported = true;
                this.emitReportToGateway(jobId, result);
                const summary =
                    result.message != null
                        ? String(result.message)
                        : JSON.stringify(result);
                console.log('[ScriptWorker] emit report_result (worker failure)', { jobId, summary });
            };

            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                fn();
            };

            this.timeoutTimer = setTimeout(() => {
                console.warn('[ScriptWorker] timeout', { jobId });
                this.timeoutTimer = undefined;
                reportFailureOnce({
                    ok: false,
                    source: 'worker_timeout',
                    message: 'Worker timeout',
                });
                this.worker.terminate();
                settle(() => reject(new Error('Worker timeout')));
            }, this.options.timeout);

            this.worker.on('error', (error) => {
                console.warn('[ScriptWorker] error', { jobId, message: error.message });
                if (this.timeoutTimer) {
                    clearTimeout(this.timeoutTimer);
                    this.timeoutTimer = undefined;
                }
                logger.error('Worker error', error);
                const err = error as Error;
                reportFailureOnce({
                    ok: false,
                    source: 'worker_error',
                    message: err?.message ?? String(error),
                    name: err?.name,
                });
                settle(() => reject(error));
            });

            this.worker.on('exit', (code) => {
                console.warn('[ScriptWorker] exit', { jobId });
                if (this.timeoutTimer) {
                    clearTimeout(this.timeoutTimer);
                    this.timeoutTimer = undefined;
                }
                if (code === 0) {
                    settle(() => resolve());
                } else {
                    logger.error('Worker exit', code);
                    reportFailureOnce({
                        ok: false,
                        source: 'worker_exit',
                        message: `Worker exited with code ${code}`,
                        exitCode: code,
                    });
                    settle(() => reject(new Error(`Worker exited with code ${code}`)));
                }
            });

            // 接受 worker 发送的消息
            this.worker.on('message', (message) => {
                const resultSummary =
                    message == null
                        ? 'null'
                        : Buffer.isBuffer(message)
                            ? `buffer(len=${message.length})`
                            : typeof message === 'string'
                                ? `string(len=${message.length})`
                                : Array.isArray(message)
                                    ? `array(len=${message.length})`
                                    : typeof message;

                this.emitReportToGateway(jobId, message);

                console.log('[ScriptWorker] emit report_result', { jobId, resultSummary });
            });
        });


    }
}