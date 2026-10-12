export * from '../phases/phase03/run-phase03-production.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase03/run-phase03-production.mjs',import.meta.url));
