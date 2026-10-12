#!/usr/bin/env node
import path from 'node:path';import {fileURLToPath} from 'node:url';import {episodeHandoffWorkspace} from './episode-handoff.mjs';
export const validateEpisodeHandoffWorkspace=episodeHandoffWorkspace;
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await episodeHandoffWorkspace(process.argv[2],{cover:process.argv.includes('--cover')})));}catch(e){console.error(e.message);process.exitCode=2;}}
