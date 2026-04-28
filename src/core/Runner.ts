import fs from 'node:fs'
import { Worker } from 'node:worker_threads'
import { ClientOptions, Context, PushJobResult, saveScriptFile, ScriptJob } from 'src/common';
import { ScriptWorker } from './ScriptWorker';
import { sleep } from 'src/utils';
import { Client } from 'src/Client';

type RunnerOptions = {
    capacity: number
    minInterval: number
    timeout: number
}

export class Runner {
    private queue: ScriptJob[] = [];
    // 上次结束时间
    private last_finished_at?: number;

    private jobIdSeq = 0;

    private worker?: ScriptWorker

    constructor(
        private readonly client: Client,
        private readonly options: RunnerOptions,
    ) {
        this.queue = [];
    }

    get ctx() {
        return this.client.deps;
    }

    private nextJobId() {
        return `job-${Date.now()}-${this.jobIdSeq++}`
    }

    /** 队列长度（含排队中的任务） */
    public getQueueLength() {
        return this.queue.length;
    }

    /** 中断脚本：排队中则移除，执行中则 terminate Worker */
    public interruptJob(jobId: string): { ok: boolean; reason?: string } {
        const idx = this.queue.findIndex((j) => j.id === jobId);
        if (idx >= 0) {
            this.queue.splice(idx, 1);
            return { ok: true };
        }
        if (this.worker) {
            const job = (this.worker as any).options?.job;
            if (job?.id === jobId) {
                this.worker.terminate();
                return { ok: true };
            }
        }
        return { ok: false, reason: `job not found: ${jobId}` };
    }

    /** 脚本队列快照，供 script_queue 事件使用 */
    public getScriptQueueSnapshot() {
        const running = this.worker ? (this.worker as any).options?.job : null;
        return {
            running,
            pending: [...this.queue],
            capacity: this.options.capacity,
        };
    }

    public async execJob(job: ScriptJob) {
        if (this.queue.length >= this.options.capacity) {
            // 需处理队列满的情况
            return PushJobResult.QUEUE_FULL;
        }

        // 如果 job.type = 'local' 且 job.filename 不存在，则需要先保存到 local_scripts 目录
        if (job.type === 'local' && !job.filename) {
            job.filename = this.nextJobId();
            try {
                await saveScriptFile(job.filename, job.script!);
            } catch (error) {
                return PushJobResult.FILE_SAVE_FAILED;
            }
        }

        this.queue.push(job);

        if (!this.worker) {
            // 开始执行：从队列取出第一个
            const jobToRun = this.queue.shift()!;

            // 如果上次结束时间小于最小间隔时间，则需要等待
            if (this.last_finished_at && Date.now() - this.last_finished_at < this.options.minInterval) {
                console.log('冷却时间');
                await sleep(this.options.minInterval - (Date.now() - this.last_finished_at));
            }

            console.log('看顺序 3',this.ctx);

            this.worker = new ScriptWorker({
                job: jobToRun,
                timeout: this.options.timeout,
                sockets: this.ctx.ws.sockets
            });

            try {
                const res = await this.worker.run()
                console.log('res 执行完了', res);
                // 执行成功
                return PushJobResult.SUCCESS;
            } catch (e) {
                // 执行失败
                console.log('res 执行失败', e);
                return PushJobResult.FAILED;
            } finally {
                // 清理 runner，若有排队任务则继续执行下一个
                this.worker = undefined;
                this.last_finished_at = Date.now();

                console.log('next', this.queue);

                const next = this.queue.shift();
                if (next) {
                    console.log('next!', next);
                    return this.execJob(next);
                }
            }

        } else {
            return PushJobResult.SUCCESS_IN_QUEUE;
        }
    }

}