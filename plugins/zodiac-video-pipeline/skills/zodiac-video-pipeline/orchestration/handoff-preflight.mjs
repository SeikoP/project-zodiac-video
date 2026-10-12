export * from '../phases/phase03/handoff-preflight.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase03/handoff-preflight.mjs',import.meta.url));
