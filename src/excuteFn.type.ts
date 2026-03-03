import { Client } from "./Client";

/** ctx 包含 browser、logger、greeting，以及 server 下发的 params */
export type excuteFn = (ctx: Client['ctx'] & { params?: any }) => Promise<void>