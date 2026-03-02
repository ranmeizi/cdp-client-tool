import { Client } from "./Client";

export type excuteFn = (ctx:Client['ctx']) => Promise<void>