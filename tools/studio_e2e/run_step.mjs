// Click a pipeline step's "Chạy" button and wait until its row text matches `until`.
const rowOf = (title) => `return [...document.querySelectorAll('.step-row')].find(r=>r.innerText.startsWith(${JSON.stringify(title)}))`;

export async function runStep(page, title, {timeoutSec = 120, pollMs = 3000, until = /Xong|Lỗi/, click = true} = {}) {
  const started = Date.now();
  if (click) await page.click(`${rowOf(title)}?.querySelector('.step-run')`);
  let text = '';
  while ((Date.now() - started) / 1000 < timeoutSec) {
    text = await page.eval(`${rowOf(title)}?.innerText.replace(/\n/g,' / ')`) ?? '';
    if (until.test(text)) return {seconds: (Date.now() - started) / 1000, text};
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`timeout after ${timeoutSec}s waiting for "${title}" (last: ${text})`);
}
