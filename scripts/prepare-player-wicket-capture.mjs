import fs from 'node:fs';
import path from 'node:path';

// Creates a separate QA-only save that surfaces the existing five-wicket
// visual fixture in Player Hub's recent-clippings list. This is not a match
// simulation and must not be described as an engine-generated result.
const root = process.cwd();
const input = path.join(root, 'marketing/capture-2026-09/scenario-saves/career-capture-only.json');
const output = path.join(root, 'marketing/capture-2026-09/scenario-saves/player-wicket-latest-qa-only.json');
const save = JSON.parse(fs.readFileSync(input, 'utf8'));

if (save.mode !== 'career' || save.qaCaptureOnly !== true) {
  throw new Error('Expected the isolated Player QA capture save.');
}

const clippings = save.experience?.mediaScrapbook;
const index = clippings?.findIndex((story) => /five wickets, one spell/i.test(story.headline ?? '')) ?? -1;
if (index < 0) throw new Error('No five-wicket clipping exists in the source QA save.');

const [wicketStory] = clippings.splice(index, 1);
clippings.push(wicketStory);
fs.writeFileSync(output, `${JSON.stringify(save)}\n`);
console.log(`Wrote QA-only Player save with “${wicketStory.headline}” in the recent six: ${output}`);
