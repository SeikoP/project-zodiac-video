import test from "node:test";
import assert from "node:assert/strict";
import {segmentCaptionWords} from "../src/runtime-contract.mjs";
const words=(items)=>items.map((text,index)=>({text,startMs:index*100,endMs:index*100+90}));
const measure=(text)=>text.length*10;
test("complete sentence may exceed old seven-word limit",()=>{const input=words(["Đây","là","một","câu","đủ","dài","để","vượt","bảy","từ."]);const pages=segmentCaptionWords(input,{maxLines:2,maxWidth:700,measure});assert.equal(pages.length,1);assert.equal(pages[0].words.length,10);});
test("layout pressure splits semantically without losing words",()=>{const input=words(["Nếu","người","kia","thật","sự","lùi","lại,","thì","cách","phản","ứng","cũng","đổi","khác."]);const pages=segmentCaptionWords(input,{maxLines:2,maxWidth:190,measure});assert.ok(pages.length>1);assert.equal(pages.flatMap((page)=>page.words).length,input.length);});
test("balanced two-line split avoids a dangling one-word line",()=>{const input=words(["một","hai","ba","bốn","năm","sáu."]);const pages=segmentCaptionWords(input,{maxLines:2,maxWidth:95,measure});assert.equal(pages.length,1);assert.equal(pages[0].lines.length,2);assert.ok(pages[0].lines.every((line)=>line.split(" ").length>=2));});
