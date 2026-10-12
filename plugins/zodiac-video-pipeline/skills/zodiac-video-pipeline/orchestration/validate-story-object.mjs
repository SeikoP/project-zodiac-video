export * from '../features/story-object/validate-story-object.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/story-object/validate-story-object.mjs',import.meta.url));
