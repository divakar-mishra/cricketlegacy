import type { MgrEvent, MgrEffect, MgrTrigger } from './managerEvents';

type PressLine = readonly [string, string, MgrTrigger, string, string, string, string, string];

// Authored questions only; no claims about a specific score, player or incident
// unless the trigger itself establishes that outcome.
const LINES: PressLine[] = [
  ['tight_finish', 'A Narrow Win', 'POST_WIN', 'The margin was close. Did your plan hold, or did the players rescue it?', 'Credit the players', 'You say the final decisions belonged to those on the field.', 'Stand by the plan', 'You explain why the original approach still mattered.'],
  ['rotation_reward', 'Faith in Rotation', 'POST_WIN', 'A rotated side got the result. Will you keep trusting the full squad?', 'Keep rotating', 'The fringe players hear that places remain open.', 'Choose on merit', 'You promise nothing except an honest next selection.'],
  ['youngster_trust', 'Trusting Youth', 'POST_WIN', 'A younger player helped the side today. Was this an early gamble?', 'Back the pathway', 'You tell the academy there is a route to the first team.', 'Protect the player', 'You refuse to make one game carry a young career.'],
  ['senior_leadership', 'The Senior Voices', 'POST_WIN', 'How much did your senior group shape the win?', 'Share authority', 'You credit the leaders for keeping the side organised.', 'Own selection', 'You say their voices matter inside a clear plan.'],
  ['bowling_change', 'The Bowling Change', 'POST_WIN', 'Your bowling change helped shift the contest. What did you see?', 'Explain the matchup', 'You describe the matchup without revealing every detail.', 'Credit execution', 'You say the bowler still had to deliver.'],
  ['field_setting', 'The Field Moved', 'POST_WIN', 'A field adjustment appeared to create pressure. Was it planned?', 'Discuss the read', 'You explain the batter’s scoring area and your response.', 'Protect the plan', 'You leave future opponents with less detail.'],
  ['batting_order', 'Order of Business', 'POST_WIN', 'The batting order changed and the innings held. Is that now your preferred order?', 'Stay flexible', 'You say conditions will decide the next call.', 'Reward the role', 'You give the player who adapted a chance to own it.'],
  ['powerplay_call', 'Powerplay Decisions', 'POST_WIN', 'Your side made the early overs count. Was that a special instruction?', 'Credit preparation', 'You explain the intent built during the week.', 'Credit initiative', 'You let the players own the read they made on the field.'],
  ['middle_overs_control', 'Holding the Middle', 'POST_WIN', 'The middle overs stayed under control. What kept the side patient?', 'Name the fielders', 'You praise the saved runs and quiet pressure.', 'Name the bowlers', 'You highlight discipline rather than one magic ball.'],
  ['death_overs', 'Closing the Door', 'POST_WIN', 'Your side stayed composed at the end. Can that calm be coached?', 'Practice the moment', 'You point to repeated scenarios in training.', 'Trust experience', 'You say the players learned from earlier finishes.'],
  ['away_win', 'A Win on the Road', 'POST_WIN', 'Does winning away tell you more about the squad than winning at home?', 'Praise adaptability', 'You say the group adjusted without needing familiar conditions.', 'Keep perspective', 'You resist turning one away result into a verdict.'],
  ['home_expectation', 'Home Expectations', 'POST_WIN', 'Supporters expect this ground to be difficult for visitors. Does that help or weigh on you?', 'Embrace the support', 'You thank the crowd and keep the players in the frame.', 'Set the boundary', 'You say home advantage is earned, not assumed.'],
  ['winning_streak', 'Handling a Run', 'POST_WIN', 'The wins are stacking up. How do you stop the group reading its own headlines?', 'Reset each week', 'You bring the room back to the next fixture.', 'Let them enjoy it', 'You allow a little pride before training resumes.'],
  ['bench_response', 'A Strong Bench', 'POST_WIN', 'Players outside the XI pushed the selected side all week. How do you reward that?', 'Open competition', 'You remind everyone that selection can change.', 'Protect continuity', 'You say a settled XI still needs a prepared bench.'],
  ['captain_call', 'Captain on the Grass', 'POST_WIN', 'The captain made a visible call in the field. Was that your instruction?', 'Give the captain credit', 'You let the on-field leader own the decision.', 'Explain the framework', 'You say the captain had room within a shared plan.'],
  ['support_staff', 'Work Behind the Result', 'POST_WIN', 'Which quiet piece of staff work helped most this week?', 'Praise analysts', 'You acknowledge the preparation that shaped the matchup.', 'Praise coaches', 'You credit the practice that made execution possible.'],
  ['fitness_depth', 'Fresh at the Finish', 'POST_WIN', 'The side looked fresh late in the game. Is conditioning becoming a strength?', 'Credit medical staff', 'You recognise the recovery plan behind the energy.', 'Credit players', 'You say the habits belong to the squad.'],
  ['pitch_read', 'Reading the Surface', 'POST_WIN', 'Your side seemed to judge the surface early. Who made that call?', 'Credit the players', 'You point to the talk between overs.', 'Credit preparation', 'You say the ground report gave a useful starting point.'],
  ['first_choice_keeper', 'Behind the Stumps', 'POST_WIN', 'The keeper kept the bowlers talking. How important is that voice?', 'Value communication', 'You make the keeper’s unseen work visible.', 'Value execution', 'You praise the actual takes and clean work.'],
  ['squad_identity', 'What Is Your Side?', 'POST_WIN', 'If a supporter missed this game, what would you tell them about the team?', 'Name resilience', 'You say they stayed connected when the contest tightened.', 'Name discipline', 'You say the small decisions added up.'],
  ['rivalry_win', 'Keeping the Rivalry Clean', 'POST_WIN', 'A win over a rival will travel quickly. How will you handle the noise?', 'Respect the opponent', 'You refuse a cheap line after the final ball.', 'Enjoy the moment', 'You let supporters celebrate without promising the next result.'],
  ['table_pressure', 'The Table Moves', 'POST_WIN', 'The result could alter the table. Do you let players study the standings?', 'Keep eyes on cricket', 'You say the next fixture is the only useful column.', 'Use the ambition', 'You believe a clear target can sharpen focus.'],
  ['selection_dilemma', 'A Pleasant Problem', 'POST_WIN', 'Several players have made selection harder. Is that the kind of problem you want?', 'Welcome competition', 'You say every good performance deserves consideration.', 'Protect roles', 'You insist players should know what is expected of them.'],
  ['postwin_training', 'Work After Winning', 'POST_WIN', 'Will you change training after this result or keep the week familiar?', 'Keep the routine', 'You resist teaching the wrong lesson from one win.', 'Target one weakness', 'You make space for a measured correction.'],
  ['final_whistle', 'A Result, Not a Verdict', 'POST_WIN', 'Does this win prove the squad is ready for the bigger challenges ahead?', 'Stay measured', 'You say readiness must be earned again each week.', 'Show belief', 'You tell the group this should raise their standards.'],
  ['early_collapse', 'Early Wickets', 'POST_LOSS', 'Early wickets changed the game. Did the batting plan ask too much?', 'Own the plan', 'You accept that the opening approach needs review.', 'Protect the batters', 'You keep individual mistakes out of the briefing.'],
  ['missed_chances', 'Chances Left Behind', 'POST_LOSS', 'The side had opportunities it did not take. Is that a skill or a composure issue?', 'Train the skill', 'You promise specific work instead of vague anger.', 'Ease the pressure', 'You say players need room to make the next chance.'],
  ['selection_scrutiny', 'Selection Under Fire', 'POST_LOSS', 'Would you make the same selection again?', 'Explain the choice', 'You defend the reasoning without pretending it worked.', 'Leave it open', 'You say places will be reviewed before the next match.'],
  ['bowling_leak', 'Runs at One End', 'POST_LOSS', 'The opposition targeted one end. Did you wait too long to change it?', 'Take responsibility', 'You say the timing of changes belongs to you.', 'Back the bowler', 'You promise support before a public verdict.'],
  ['captain_feedback', 'Two Leaders, One Message', 'POST_LOSS', 'Did you and the captain agree about the key moment?', 'Keep it internal', 'You protect the honest conversation in the dressing room.', 'Show unity', 'You say both leaders share responsibility for the response.'],
  ['slow_field', 'The Ground Fielding', 'POST_LOSS', 'A few extra runs escaped in the field. How will you address it?', 'Practice the basics', 'You turn frustration into a specific fielding session.', 'Manage fatigue', 'You ask whether the week’s load affected reactions.'],
  ['bench_questions', 'The Bench Is Watching', 'POST_LOSS', 'Do players outside the XI now deserve a chance?', 'Open the door', 'You make it clear that training form will matter.', 'Avoid panic', 'You say one defeat will not force changes for effect.'],
  ['conditions_wrong', 'Reading It Wrong', 'POST_LOSS', 'Did the side misread the surface before the match?', 'Own the assessment', 'You take responsibility for the preparation.', 'Credit opposition', 'You admit they adapted faster once play began.'],
  ['late_chase', 'The Chase Slipped', 'POST_LOSS', 'The chase looked possible before it got away. What was missed?', 'Examine the middle', 'You want better rotation before the final push.', 'Examine the finish', 'You say the final decisions deserve attention.'],
  ['powerplay_cost', 'A Costly Start', 'POST_LOSS', 'The early overs left too much to repair. Will the approach change?', 'Adjust the plan', 'You will set a clearer risk limit next time.', 'Back the intent', 'You say execution, not ambition, let the side down.'],
  ['spinner_matchup', 'Held by Spin', 'POST_LOSS', 'Their spin options slowed your side. Were you ready for that matchup?', 'Review preparation', 'You ask the staff for a better plan against spin.', 'Trust the players', 'You say they have the skill to answer next time.'],
  ['death_bowling', 'The Closing Overs', 'POST_LOSS', 'The final overs were expensive. Who owns the plan now?', 'Own it publicly', 'You keep the heat off an individual bowler.', 'Share the review', 'You ask bowlers and staff to rebuild the plan together.'],
  ['injury_depth', 'Testing the Depth', 'POST_LOSS', 'Availability has tested the squad. Is the depth good enough?', 'Back the replacements', 'You refuse to make absences an excuse.', 'Ask for support', 'You tell the board where the squad needs cover.'],
  ['travel_fatigue', 'Road Weariness', 'POST_LOSS', 'The team looked flat away from home. Is travel taking its toll?', 'Review recovery', 'You want a better turnaround between fixtures.', 'Demand standards', 'You say tiredness cannot excuse every loose ball.'],
  ['dressing_room', 'The Dressing-Room Response', 'POST_LOSS', 'What did you say when the players came in?', 'Speak plainly', 'You tell them what failed without naming a scapegoat.', 'Give space', 'You let the first emotions settle before the review.'],
  ['fan_anger', 'The Supporters’ Question', 'POST_LOSS', 'Supporters are frustrated. What can you promise them?', 'Promise work', 'You offer effort and a clearer plan, not a result.', 'Ask for patience', 'You say rebuilding trust takes more than one statement.'],
  ['board_attention', 'The Board Will Ask', 'POST_LOSS', 'The board will want answers. What will you bring to that meeting?', 'Bring evidence', 'You prepare a specific account of what changed.', 'Bring a solution', 'You arrive with the first adjustment already mapped.'],
  ['youngster_pressure', 'Protecting a Prospect', 'POST_LOSS', 'A young player had a difficult day. Will you keep trusting them?', 'Protect their role', 'You say development includes uncomfortable days.', 'Review the timing', 'You will decide what the next fixture asks of them.'],
  ['senior_form', 'Questions for Senior Players', 'POST_LOSS', 'The experienced group did not steady the side. How direct will you be?', 'Speak honestly', 'You expect senior players to help lead the response.', 'Keep it collective', 'You say the side wins and loses as a unit.'],
  ['tactical_shift', 'Changing Too Late', 'POST_LOSS', 'A tactical change came after the contest had turned. Was that on you?', 'Own the delay', 'You say a manager has to read the game faster.', 'Explain the trade-off', 'You outline what the earlier change risked.'],
  ['rivalry_loss', 'After a Rivalry Defeat', 'POST_LOSS', 'This defeat will sting supporters more than most. Do players understand that?', 'Acknowledge it', 'You say the hurt is real and cannot be talked away.', 'Keep perspective', 'You refuse to let one fixture derail the season.'],
  ['streak_broken', 'When Momentum Stops', 'POST_LOSS', 'The run of results has ended. Does the group need a reset?', 'Reset the work', 'You go back to the habits that built the run.', 'Hold the confidence', 'You say one setback should not erase belief.'],
  ['league_position', 'Looking at the Table', 'POST_LOSS', 'Will the league table influence your next selection?', 'Pick the best XI', 'You say the fixture should decide, not panic about position.', 'Match the urgency', 'You acknowledge the table changes the pressure.'],
  ['training_review', 'A Week to Respond', 'POST_LOSS', 'What changes in training before the next match?', 'Target one issue', 'You choose a narrow correction the squad can absorb.', 'Rebuild intensity', 'You ask for a sharper week across the group.'],
  ['public_blame', 'Who Takes the Blame?', 'POST_LOSS', 'A reporter asks for one name responsible. What do you say?', 'Take responsibility', 'You refuse to offer a player as the headline.', 'Name the collective', 'You say the review belongs to everyone, yourself included.'],
];

const TRADE_OFFS: readonly (readonly [MgrEffect, MgrEffect])[] = [
  [{ squadMorale: 3, boardConfidence: -1 }, { boardConfidence: 3, squadMorale: -1 }],
  [{ boardConfidence: 2, squadForm: 1 }, { squadMorale: 2, reputation: 1 }],
  [{ squadMorale: 2, reputation: 1 }, { boardConfidence: 2, squadForm: 1 }],
  [{ squadForm: 2, boardConfidence: -1 }, { squadMorale: 3, boardConfidence: 1 }],
  [{ boardConfidence: 3, squadMorale: -1 }, { squadForm: 1, squadMorale: 2 }],
];

export const MANAGER_PRESS_SCENARIOS: MgrEvent[] = LINES.map((line, index) => {
  const [id, title, trigger, body, firstLabel, firstResult, secondLabel, secondResult] = line;
  const [firstEffects, secondEffects] = TRADE_OFFS[index % TRADE_OFFS.length];
  return {
    id: `press_manager_${id}`,
    title,
    trigger,
    speaker: 'Press Room',
    weight: 1,
    body,
    choices: [
      { id: 'first', label: firstLabel, effects: firstEffects, resultText: firstResult },
      { id: 'second', label: secondLabel, effects: secondEffects, resultText: secondResult },
    ],
  };
});
