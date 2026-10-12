export * from '../features/ending/compile-ending-payoff.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/ending/compile-ending-payoff.mjs',import.meta.url));
