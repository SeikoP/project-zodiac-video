export * from '../phases/phase01/commit-phase01-step.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase01/commit-phase01-step.mjs',import.meta.url));
