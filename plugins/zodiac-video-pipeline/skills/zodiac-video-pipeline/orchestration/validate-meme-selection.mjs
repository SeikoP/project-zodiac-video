export * from '../features/meme/validate-meme-selection.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/meme/validate-meme-selection.mjs',import.meta.url));
