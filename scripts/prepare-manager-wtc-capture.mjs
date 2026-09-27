import fs from 'node:fs';
import path from 'node:path';

// Creates a separate QA-only save that surfaces the already-authored WTC
// newspaper clipping in Manager Hub's six-item recent-clippings list.
// This does not create or claim a canonical match result.
const root = process.cwd();
const input = path.join(root, 'marketing/capture-2026-09/scenario-saves/manager-capture-only.json');
const output = path.join(root, 'marketing/capture-2026-09/scenario-saves/manager-wtc-latest-qa-only.json');
const save = JSON.parse(fs.readFileSync(input, 'utf8'));

if (save.mode !== 'manager' || save.qaCaptureOnly !== true) {
  throw new Error('Expected the isolated Manager QA capture save.');
}

const clippings = save.experience?.mediaScrapbook;
const index = clippings?.findIndex((story) => /world test championship/i.test(story.headline ?? '')) ?? -1;
if (index < 0) throw new Error('No WTC clipping exists in the source QA save.');

const [wtcStory] = clippings.splice(index, 1);
clippings.push(wtcStory);
fs.writeFileSync(output, `${JSON.stringify(save)}\n`);
console.log(`Wrote QA-only Manager save with “${wtcStory.headline}” in the recent six: ${output}`);
