export * from '../features/ending/validate-ending-payoff.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/ending/validate-ending-payoff.mjs',import.meta.url));
