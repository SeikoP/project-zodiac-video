export * from '../phases/phase01/execution-preflight.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase01/execution-preflight.mjs',import.meta.url));
