import fs from 'node:fs'
import { Worker } from 'node:worker_threads'
import { ScriptJob } from 'src/common';
import { logger } from 'src/logger';


type ScriptWorkerOptions = {
    job: ScriptJob
    timeout: number
}

export class ScriptWorker {

    public worker: Worker
    private timeoutTimer?: NodeJS.Timeout

    constructor(
        private readonly options: ScriptWorkerOptions
    ) {
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

        return new Promise((resolve, reject) => {
            let settled = false;
            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                fn();
            };

            this.timeoutTimer = setTimeout(() => {
                this.timeoutTimer = undefined;
                this.worker.terminate();
                settle(() => reject(new Error('Worker timeout')));
            }, this.options.timeout);

            this.worker.on('error', (error) => {
                if (this.timeoutTimer) {
                    clearTimeout(this.timeoutTimer);
                    this.timeoutTimer = undefined;
                }
                logger.error('Worker error', error);
                settle(() => reject(error));
            });

            this.worker.on('exit', (code) => {
                if (this.timeoutTimer) {
                    clearTimeout(this.timeoutTimer);
                    this.timeoutTimer = undefined;
                }
                if (code === 0) {
                    logger.success('Worker exit', code);
                    settle(() => resolve());
                } else {
                    logger.error('Worker exit', code);
                    settle(() => reject(new Error(`Worker exited with code ${code}`)));
                }
            });
        });


    }
}