export * from '../core/state/validate-pipeline-state.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/state/validate-pipeline-state.mjs',import.meta.url));
