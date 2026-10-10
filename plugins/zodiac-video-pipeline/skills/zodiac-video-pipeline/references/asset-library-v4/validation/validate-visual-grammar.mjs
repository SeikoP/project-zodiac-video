#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileVisualGrammar} from '../compile-visual-grammar.mjs';
const productionPath=process.argv[2],planPath=process.argv[3];
if(!productionPath||!planPath){console.error('Usage: node validate-visual-grammar.mjs <production.json> <visual-grammar-plan.json>');process.exit(2);}
const production=JSON.parse(await readFile(productionPath,'utf8')),plan=JSON.parse(await readFile(planPath,'utf8'));
const compiled=compileVisualGrammar(production,plan);
for(const spec of plan.scenes){const scene=compiled.scenes.find(s=>s.id===spec.scene_id);if(!scene?.scene_direction||!scene?.visual_grammar)throw new Error('VISUAL_GRAMMAR_INVALID: '+spec.scene_id+' did not materialize compile-time grammar');}
console.log(`VISUAL_GRAMMAR_PASS: scenes=${plan.scenes.length}`);
