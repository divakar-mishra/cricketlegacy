import { BallOutcome, Dismissal } from '../domain/types';
import { DeliverySpec } from './deliveries';
import { pick, Rng } from './rng';
import { ShotType, SHOT_LABEL } from './shots';

/**
 * Commentary bank — 600+ context-aware lines covering all situations.
 * All selection is deterministic via the injected `rng`. Player/venue
 * names are interpolated where provided (optional fields on ctx) so every
 * game feels unique without hard-coding real brands for legal safety.
 */

// ─── Outcome pools ────────────────────────────────────────────────────────────

const PHRASES: Record<Exclude<BallOutcome, 'W'>, string[]> = {
  DOT: [
    'Solid defence, right behind the line.',
    'Beaten outside off — and the bowler lets him know about it!',
    'No run, watchful from the batter.',
    'Straight to the fielder, no single on offer.',
    'Pushed back down the pitch, dead bat.',
    'Left alone, shoulders arms with authority.',
    'Loud appeal — turned down! Just a dot.',
    'Defended into the surface, nothing doing.',
    'Squirted to point, they stay at home.',
    'Terrific delivery, dot ball, and the pressure ratchets up.',
    'Plays and misses — living dangerously out there!',
    'Beaten by the extra bounce, nowhere near it.',
    'Blocked out, the bowler nods in quiet approval.',
    'Thick inside edge onto the pad, but survives.',
    'Immaculate line, the batter can only smother it.',
    'Dot ball — the crowd groans for a run that never came.',
    'Full and straight — solidly defended.',
    'Outside off, left alone with disdain.',
    'Sharp inswing — jammed out at the last moment.',
    'Hit straight to the fielder at mid-on, no run.',
    'Attacked, but mistimed — straight to cover.',
    'Goes over the top... straight to long-on.',
    'Rapped on the glove, but the ball drops dead at his feet.',
    'Short and on the body — fended away, fielder has it.',
    'Bowler roars — the batter just manages to dig it out.',
    'The dot-ball count climbs; the pressure builds.',
    'Defended off the back foot, keeping it honest.',
    'Angled into the body — works it off hip but straight to square leg.',
    'On a length, no room to play a shot — dot.',
    'Arm ball through the gate — somehow survived!',
    'Full delivery, pushed to the bowler — no run.',
    'Shorter, skids through quickly — jabbed down in the nick of time.',
    'Driven hard but straight to the fielder.',
    'Very tight on the off stump — defended with hands close to the body.',
    'Drifts onto middle, knocked to mid-wicket — no run.',
    'Wide of off, no shot offered — another dot.',
    'Clattered onto the helmet — agonising, but no run.',
    'Pitched up invitingly, only to find mid-off waiting.',
    'The slips wait, the batter waits — dot ball stand-off.',
    'Beautiful length delivery, batter uncertain — defensive.',
    'Quick through the air, the batter does well to keep it out.',
    'Gripping turn — plays inside the line, no damage done.',
    'Slapped straight to covers — the fielder takes it cleanly.',
    'An outstanding maiden is building here.',
    'Seam movement defeats the outside edge — a fine dot.',
    'Pinned on the crease, had no option but to block.',
    'The googly deceives him completely — dot ball.',
    'Full toss outside off — somehow squeezed straight to the fielder.',
    'Searing pace, the batter barely moves — dot.',
    'Gets right behind it, textbook defensive technique.',
    'Nipped back sharply — that was always staying on middle.',
    'Flighted beautifully, the batter plays for the turn that never came.',
    'Back of a length, cramped for room — pushed defensively.',
    'The bouncer surprises him — ducks under it awkwardly.',
    'Slower through the air, completely deceived — dot ball.',
    'Exquisite line and length — the batter has no answer.',
    'In the blockhole — jammed out, but no run.',
    'Plays a tentative push to point — no single available.',
    'Tossed up at the stumps — gets right forward, smothered.',
    'A scoreless ball that told its own story.',
    'Beats the swing, plays on the wrong line — a miracle he survived.',
    'The off-break straightens sharply — defended with great instinct.',
    'Excellent over-the-wicket angle, no scoring opportunity.',
    'Tight to the body, no room to free the arms — dot.',
    'Another dot — the pressure is tangible in the middle.',
    'Great shape away from the batter — the dot count mounts.',
    'Brilliant delivery, deserved a wicket, gets a dot.',
    'Quicker through the air, the bat comes down late — dot.',
    'The yorker is dug out, but no single on offer.',
    'Cross-seam delivery, holds its line — dot ball.',
    'The pull shot is played straight to the fielder.',
    'A probing delivery that the batter can only respect.',
    'He goes hard at it but finds the fielder at extra cover.',
    'Floated up invitingly — the batter plays it straight to the fielder.',
    'The inswinger late movement is exceptional — dot.',
    'Lands on a perfect length, the batter is rooted to the crease.',
    'Shapes away then holds its line — the bat is nowhere near it.',
    'Leg-cutter! Beats the drive completely.',
    'A military medium that finds the edge — but safe! What luck.',
    'Pushed firmly but directly to mid-off — no run.',
    'Raps the back pad — huge appeal, but the umpire says no.',
    'The carrom ball! Catches the outside edge — drops short of slip.',
    'Straightens off the pitch, takes the inside edge onto the thigh.',
    'Bouncer aimed at the body — the batter fends awkwardly, no damage.',
    "Skids through the gate — bat and pad don't cooperate, but survives!",
    'The arm ball! Batter plays for the turn — huge miss, dot ball.',
    'Dragged down short, the pull is uppish — finds mid-on.',
    'Clever change of pace — the batter swings through it, dot.',
    'Perfectly placed mid-off prevents any scoring chance.',
    'The wrist-spinner lands it precisely — nothing doing.',
    'Runs in hard, angled across — forced to leave it alone.',
    'The batter checks the drive — straight to mid-wicket.',
    'A full-on bouncer — the batter rides it over the glovesman.',
    'Tossed up, the batter goes back when he should have come forward.',
    'Late movement off the seam — plays it with the turn, dot.',
    'Nips back off the crease, batter quickly adjusts — no run.',
  ],
  '1': [
    'Tucked away to fine leg for one.',
    'Quick single, easy as you like.',
    'Worked into the gap for a single.',
    'Nudged off the hip and they scamper through.',
    'Dropped into the covers and off they go.',
    'Pushed to mid-on, comfortable single.',
    'Soft hands, one to the sweeper in the deep.',
    'Steals a sharp single — that was close!',
    'Guided down to third man for one.',
    'Rotates the strike with a gentle dab.',
    'Clipped off the toes, keeps the scoreboard ticking.',
    'Milked to long-on, single taken.',
    'A nurdle behind square and they run the one.',
    'Great calling, single completed with a dive.',
    'Punched to cover, keeps the board moving.',
    'Works it away for a single — smart, low-risk cricket.',
    'Worked square on the off side, quick single taken.',
    'Dropped and turned to fine leg — one.',
    'Glanced to mid-wicket, they amble through.',
    'Pushed to backward point — the throw comes in but they are home.',
    'Dabs it fine and calls immediately — one.',
    'Through square leg for a single — well run.',
    'Flicked elegantly to deep mid-wicket, one to the total.',
    'Deflects off the inside edge to fine leg — one.',
    'Takes a cheeky single against the run of play.',
    'Tickled fine, comfortable one.',
    'Taps to mid-off, the fielder advances — they hold up, then scamper.',
    'Keeps the strike rotating with a dab to point.',
    'An important single at this stage of the innings.',
    'Smartly manoeuvred to the leg side — one.',
    'Just behind square — they cross for a brisk single.',
    'Chip to covers, sharp calling gets them a run.',
    'Wristwork behind square leg — comfortable single.',
    'Pushed wide of mid-on, they run an easy one.',
    'Trailing edge sneaks down to third man — one run.',
    'The push to the off side, they scamper the single.',
    'Smart cricket — keeps the scoreboard ticking.',
    'Worked away to deep square, they jog a single.',
    'Drops it and runs immediately — the fielder has no chance.',
    'A well-judged single, and the strike is retained.',
    'Off the hip, they take the easy single.',
    'Drives firmly but finds the man — they run the single anyway.',
    'Turned to long-on — confident calling, one more.',
    'Plays it into the gap, great awareness — one.',
    'Flicks to fine leg — took the single without hesitation.',
    'An invaluable single that oils the innings along.',
    'A soft push to point brings up a single — the calling was crisp.',
    'Pulled firmly to the fielder, they dash through for one.',
    'An inventive reverse-paddle earns a cheeky single.',
    'Punched to extra cover, the field allows a quick one.',
    'A firm but controlled push earns a precious single.',
    'The batters communicate brilliantly — one secured.',
    'Darts down the leg side, easy single to the fine-leg sweeper.',
    'Works it off the pads, content to rotate the strike.',
    'A single that keeps the run rate ticking and the fielding side honest.',
    'Guided with soft hands to the gap — one without fuss.',
    'Pops it into the off side, quick singles for a run.',
    'Comes down the wicket and dabs — single, rotate on.',
  ],
  '2': [
    'Good running between the wickets, two more.',
    'Placed into the gap for a well-run couple.',
    'Two runs, superbly judged.',
    'They come back for the second — just made it!',
    'Driven into the outfield, easy two.',
    'Hard running earns them a brace.',
    'Timed into the gap, back for the second.',
    'Clipped away, two down to the fine-leg fielder.',
    'Sharp turn and they steal the second.',
    'Worked into the deep, comfortable couple.',
    'Two runs, the fielder dives to save the boundary.',
    'Nicely placed, they scurry back for two.',
    'Excellent legwork, a valuable pair of runs.',
    'Pushed square and they cash in for two.',
    'Guided to deep point — two well-run runs.',
    'Cuts to the sweeper cover — they race back for two.',
    'Through the covers for two — excellent timing.',
    'Swept fine and they complete the pair comfortably.',
    'Worked backward of square, the throw comes in too late — two.',
    'The outfield is quick, they take a riskier second.',
    'Two runs from a defensive push — the calling was superb.',
    'Into the gap at mid-wicket, they complete two easily.',
    'A punch through mid-off — swift running makes it two.',
    'Placed sweetly into the cover region, easy couple.',
    'The fielder slips! They come back for a well-earned two.',
    'Both batters commit fully — two more on the board.',
    'Running hard between the wickets — two, and the crowd loves it.',
    'An aggressive single turned into two with brilliant calling.',
    'Flicked to deep fine leg — two more, the partnership grows.',
    'The throw is wide of the stumps — two for alert running.',
  ],
  '3': [
    'Excellent running, three taken!',
    'Into the deep for three, superb legwork.',
    'They run hard and pick up a rare three.',
    'Driven into the gap, three all run!',
    'Beats the throw for the third — brilliant hustle.',
    'A long way to the rope, they settle for three.',
    'Placed wide of the sweeper, three runs.',
    'Three! The fielder cuts it off just short of the fence.',
    'Superb calling turns two into three.',
    'Punched to the fence-chaser, three all the way back.',
    'They just keep running — three to the total!',
    'Perfectly placed, three runs and both batters puffing.',
    'A well-earned three, wonderful awareness.',
    'Threaded into the gap, they come back for the third.',
    'Three! The outfield is quick and the running even quicker.',
    'Slapped through midwicket — they run three in a flash.',
    'Finds the gap wide, three with ease — great batting.',
    'An overthrow adds to the total — three!',
    'Brilliant placement, three all run — the bowler is furious.',
    'Full-blooded drive, the ball hits the fence-rope — three!',
  ],
  '4': [
    'FOUR! Races away through the covers.',
    'Beautifully timed, four to the fence!',
    'Cracked square, no stopping that — four!',
    'Threads the gap, four all the way.',
    'FOUR! A glorious drive on the up.',
    'Flicked off the pads, four to fine leg.',
    'Cut hard behind point, races to the rope!',
    'Four! Pierces the field with a silken drive.',
    'Thick edge and it flies down to third man for four!',
    'FOUR! Pulled emphatically to the midwicket fence.',
    'Lofted over the infield, one bounce and four.',
    'An exquisite late cut, four runs and a smile.',
    'Drilled straight past the bowler for four!',
    'Four! The sweep finds the gap to perfection.',
    'Guides it fine, beats the diving fielder — four!',
    'FOUR! Timing, not muscle, and it beats the lot of them.',
    'Crisp cover drive, ball races to the fence!',
    'Punched off the back foot — FOUR, absolutely clinical!',
    'The on-drive! Rolled away past mid-on to the boundary.',
    'Reverse swept! Finds the third man area — four!',
    'Flicked with the angle to square leg — FOUR!',
    'FOUR! Slashes through the gap at backward point!',
    'Oh, that is a gorgeous extra-cover drive — four!',
    'Upper cut! Flies past the keeper, four to third man!',
    'Short of a length and pulled powerfully — FOUR!',
    'Advances down the track, drives handsomely — four!',
    'FOUR! Read the length early and helped it fine.',
    'Forces off the back foot through extra cover — four!',
    'A gorgeous sweep past square leg — boundary!',
    'Half-volley, driven on the up through midwicket — four!',
    'FOUR! The follow-through is almost as pretty as the shot.',
    'In the gap at deep square! Racing to the rope!',
    'A late cut of real class — splits third man and gully — four!',
    'Glanced away elegantly off the hip — four more!',
    'FOUR! An imperious straight drive, letter-perfect.',
    'Short and wide — cut over the fielder — four!',
    'Sweeps the spinner past square — FOUR!',
    'Mid-on moves but cannot cut it off — four runs!',
    'Driven firmly back past the bowler — four!',
    'Edges through the unguarded gap at third man — four!',
    'Lofts over mid-off with supreme confidence — four!',
    'The pull is early and convincing — FOUR!',
    'FOUR! The ball never really had a chance once it was full.',
    'Caressed through covers — the bat does the talking.',
    'Plays the scoop beautifully — four fine!',
    'Charges and lofts; one bounce over the diving fielder — FOUR!',
    'Opened the face and guided it at speed — FOUR!',
    'A flick of genius past the mid-wicket fielder — boundary!',
    'FOUR! Pierces mid-off and mid-on simultaneously — perfect placement.',
    'Plays the ramp over the keeper — FOUR! Sublime.',
    'Flays it through cover point — FOUR! Unstoppable.',
    'The inside edge races to the fine-leg boundary — four!',
    'Straight bat, full face — driven to the long-off rope — FOUR!',
    'Rocks back and cuts powerfully — four runs through point!',
    'FOUR! The ball zips to the rope before the fielder can react.',
    'Dances down the track and lofts stylishly over the off side — four.',
    'Carved through backward point — FOUR! A stroke of pure class.',
    'The wrist flick sends it whistling to the fine-leg fence — FOUR!',
    'FOUR! An audacious reverse scoop finds the third-man gap.',
    'Chiselled off the outside edge — it just cleared the fielder — FOUR!',
    'Length ball, clipped off the hip — FOUR! Effortless timing.',
    'Cuts past backward point — FOUR, one of the shots of the day!',
    'Goes down on one knee and sweeps — the ball sprints to the rope.',
    'FOUR! A boundary that raises the crowd from their seats.',
  ],
  '6': [
    'SIX! Launched deep into the crowd!',
    'Maximum! What a clean strike that is!',
    'A huge hit, sails into the second tier!',
    'SIX! Down the ground and out of reach.',
    'Slog-swept flat into the stands for six!',
    'That is enormous — six all the way!',
    'SIX! Picks the length early and deposits it over long-on.',
    'Flat and ferocious over cover — six!',
    'Muscled over midwicket, the crowd erupts — six!',
    'SIX! A towering blow into the night sky.',
    'Ramped audaciously over the keeper for a cheeky six!',
    'Skips down and lofts it over long-off — six!',
    'SIX MORE! The bowler can only watch it disappear.',
    'Clubbed over the sightscreen, a monstrous six!',
    'A flick off the pads that just keeps sailing — six!',
    'SIX! Middle of the bat, and the fielder never moved.',
    'Cleared the ropes with something to spare — SIX!',
    'The timing is everything — MAXIMUM!',
    'Skips into the drive and the ball is still rising as it clears the fence!',
    'SIX! Stepped away and carved it over wide long-off!',
    'Into the crowd again — this bat has got some power!',
    'Whipped off the hips with absolute disdain — SIX!',
    'A measured swing, timed to perfection — six more!',
    'SIX! The fielder on the rope never had a chance.',
    'The stadium rises as one — MAXIMUM!',
    'One knee down, the ramp clears the keeper — SIX!',
    'Drives clean, and there is simply no fielder out there — six!',
    'The long handle comes out — smashed flat and true — SIX!',
    'Stepped out and lofted; the ball lands ten rows back!',
    'SIX! Hit down the ground with breathtaking authority!',
    'Into the arc at leg and dispatched — SIX!',
    'The spinner tossed it up — and lived to regret it!',
    'SIX! The crowd is on its feet in disbelief and delight!',
    'An imperious pull shot, soaring into the stands!',
    'Down the track and the loft is perfect — six!',
    'SIX! The ball has not landed yet.',
    'Heaved over midwicket — the fielder watches it go — six!',
    'Knocks it clean over long-on without a second thought — MAXIMUM!',
    'That SIX might have cleared the stadium entirely!',
    'SIX! An outrageous over-the-shoulder scoop!',
    'The reverse sweep lifts over the ropes — six unorthodox runs!',
    'Full toss, and the bat swings freely — SIX!',
    'Picked the length immediately and pulled flat into the crowd!',
    'SIX! The partnership takes on a life of its own!',
    'Back foot, short ball, immense power — MAXIMUM!',
    'Sails into the stands over long-on — what a hit!',
    'Premeditated over the cow corner — SIX! Outrageous.',
    'The bowler went short, the batter went long — SIX!',
    'SIX! It bounced once in the crowd.',
    'Flat-batted over midwicket — sheer audacity and strength — SIX!',
    'A monstrous blow that silences the fielding side instantly!',
    'SIX! The commentators can barely keep up!',
    'Advances down the track, lofts cleanly — six!',
    'Clears extra cover with ease — MAXIMUM!',
    'SIX! A colossal hit over the sightscreen!',
    'Switches hands, scoops over fine leg — SIX! Pure showmanship!',
    'The bowler tosses it up; the batter says thank you very much — SIX!',
    'SIX! Goes downtown in a hurry!',
    'Pulled off the front foot — phenomenal strength — MAXIMUM!',
    'SIX! Absolutely nailed — cleanest of clean hits.',
    'Charge and loft — the ball disappears into the night — SIX!',
    'The whole ground erupts — MAXIMUM! A truly extraordinary hit.',
  ],
  WD: [
    'Wide down the leg side, extra run.',
    'Sprayed wide outside off — called instantly.',
    'Too far down the leg side, that is a wide.',
    'Drifting wide, the umpire stretches both arms.',
    'Wide! Loses his line completely there.',
    'Bounces it over the batter — signalled wide.',
    'Wayward again, another wide added to the tally.',
    'Slides past the tramline, one more to the total.',
    'Wide called — the captain is not impressed.',
    'Too wide to reach, extra to the batting side.',
    'Down the leg side once more, wide signalled.',
    'Overcorrects and sends it wide outside off.',
    'Wide! Sloppy stuff from the bowler under pressure.',
    'Beats everyone, keeper included — wide.',
    'The umpire raises both arms — wide! A gift.',
    'Sails past the off-side tramline — wide, extra run.',
    'Drifts too far down leg — the keeper dives in vain — wide.',
    'The bowler has lost his radar — wide called again.',
    'Two wides in the over now — the captain looks concerned.',
  ],
  NB: [
    'No ball! Overstepped, and a free hit to come.',
    'Front foot well over the line — no ball.',
    'No ball, and a bonus delivery for the batter.',
    'Oversteps under pressure — that will cost more than a run.',
    'No ball! Drags it down and pays the price.',
    'Above the waist on the full — no ball called.',
    'No ball signalled, the captain shakes his head.',
    'Foot fault — no ball, and a free hit looming.',
    'No ball for the second time this over — costly.',
    'Steps over the line, an extra and a free hit.',
    'No ball! A gift handed to the batting side.',
    'Well over the crease — no ball, the pressure shifts.',
    'A rare beamer — no ball, and a stern word from the umpire.',
    'No ball called, and the fielders groan as one.',
    'A front-foot no ball — and the free hit is coming!',
    'Steps over the crease — no ball! Costly mistake under pressure.',
    'Above knee height — that is a no ball. The batter pumps his fist.',
    'No ball! The captain rushes over for a quiet word.',
  ],
  BYE: [
    'Byes taken as it beats absolutely everyone.',
    'Through to the keeper and back for a bye.',
    'Beaten all ends up, they sneak a bye.',
    'Byes! The keeper will not want to see that again.',
    'Zips past the outside edge, a bye taken.',
    'They run a bye off the extra bounce.',
    'Missed by bat and by gloves — bye to the total.',
    'Cheeky byes as the ball rolls away from the keeper.',
    'Beats the stumps and the keeper — bye run.',
    'A bye, the batters alert to the opportunity.',
    'They pinch a run as it evades the keeper.',
    'Byes taken, and the bowler is furious with the gloveman.',
    'Quick thinking, a bye stolen off the wayward line.',
    'Through the gate but past the stumps — bye taken.',
    'Slips past the keeper down the leg side — a bye!',
    'A sharp delivery, a sharper run — bye to the total!',
    'The keeper fumbles and they pinch a bye.',
  ],
  LB: [
    'Off the pads, leg byes taken.',
    'Leg byes as it deflects off the thigh.',
    'Struck on the pad, they run a leg bye.',
    'Ricochets off the hip, leg bye to the total.',
    'Leg byes! The bowler wanted lbw, gets nothing.',
    'Flicked off the pad, a leg bye stolen.',
    'Beaten on the inside, leg byes result.',
    'Onto the pad and away for a leg bye.',
    'Leg bye taken, the bowler appeals in vain.',
    'Deflects off the boot, a quick leg bye.',
    'A leg bye as the ball dribbles to the leg side.',
    'Struck high on the pad, they scamper a leg bye.',
    'Leg bye — no shot offered, but a run all the same.',
    'Off the thigh pad and they nip a leg bye.',
    'Off the inside pad — leg bye taken quickly.',
    'Leg byes — alert running and they make the most of it.',
    'Deflects harmlessly, but the alertness brings a leg bye.',
  ],
};

// ─── Dismissal pools ─────────────────────────────────────────────────────────

const DISMISSAL_PHRASES: Record<Dismissal['type'], string[]> = {
  BOWLED: [
    'BOWLED him! The timber is shattered!',
    'Through the gate — the stumps are in a heap!',
    'BOWLED! Cleaned up by an absolute jaffa.',
    'Castled! The off stump takes a walk.',
    'Played on! Drags it back onto the stumps — bowled!',
    'Yorker! The stump is out of the ground — BOWLED!',
    'Sneaks past the outside edge and clips the off bail — bowled!',
    'A length delivery that got big — BOWLED, the top of off!',
    'Bowled through the gate! The bat and pad parted company.',
    'BOWLED! A perfect inswinger flattens middle stump.',
    'Nips back off the seam and the batter is done — bowled!',
    'What a delivery! Moves off the seam and takes the off stump.',
    'A full-pitched ball — the batter looks to defend and is clean bowled!',
    'Reverse-swings back and cannons into the stumps — BOWLED!',
    'Top of off! Clean bowled — an outstanding delivery.',
    'BOWLED all ends up — the off stump is celebrating by itself!',
    "Goes through the defence like it wasn't there — BOWLED!",
    'The most complete delivery you will ever see — BOWLED!',
    'The bail flies off and the crowd erupts — BOWLED!',
    'Jagged back sharply — the stumps are disturbed — BOWLED!',
  ],
  CAUGHT: [
    'CAUGHT! Taken cleanly by the fielder.',
    'Skies it high — and the catch is pouched safely!',
    'CAUGHT! A brilliant, tumbling grab in the deep.',
    'Edged and taken behind — the keeper does the rest!',
    'Caught on the boundary — he simply timed it too well!',
    'Leading edge! Balloons up and taken easily.',
    'CAUGHT at slip! An edge, and the cordon does its job.',
    'Miscued completely — a simple catch to mid-off.',
    'Caught at fine leg — went for the big pull and did not middle it.',
    'Feathered edge — the keeper accepts with aplomb. CAUGHT!',
    'Top edge on the sweep — up and up — and taken at square leg!',
    'Drives hard and finds the fielder stationed at cover — caught!',
    'A stunning one-handed catch in the deep — CAUGHT!',
    'Scooped up off his own boot — the fielder dives and holds on!',
    'Caught at mid-wicket! Tried to pull but only got a top edge.',
    'Short-pitched, fends awkwardly — gully takes it low — OUT!',
    'He went big over the top but only helped it to long-off — CAUGHT!',
    'Nicks it through and the keeper barely moves — CAUGHT behind!',
    "The ball spirals up — an eternity in the air — and it's CAUGHT!",
    'A regulation slip catch — beautifully taken — CAUGHT!',
    'A reflex catch at short leg — caught!',
    'Goes for the pull — the top edge travels straight up — CAUGHT!',
    'The bat twists at impact — the edge carries to slip — CAUGHT!',
    'A sharp chance put down earlier — but taken now — CAUGHT!',
  ],
  LBW: [
    'LBW! That looked plumb in front.',
    'Trapped on the pads — up goes the finger!',
    'LBW! Dead in front, no doubt about that one.',
    'Struck in line and it was crashing into leg stump — out!',
    'Rapped on the pad and given — a massive wicket.',
    'Swings back in — struck on the knee-roll — LBW!',
    'Goes for the drive, misses — and the umpire does not hesitate!',
    'The arm ball! Hits the pad with its first bounce — LBW!',
    'The ball straightened enough and trapped him in front — OUT!',
    'Huge LBW appeal — GIVEN! That was always going to be out.',
    'Slides on, hits the crease on a length — plumb in front.',
    'LBW! Pitched on middle, the batter offered no shot.',
    'Keeps low — a stunning delivery — struck LBW!',
    'Reviews… but there is nothing to save him — LBW stands!',
    'The inswing curves in late, crashes the front pad — OUT!',
    'The ball misses the bat completely — strikes the pad — LBW!',
    'Pitched on line, kept low — the batter is struck plumb in front.',
    'Swings back very late — the batter is LBW and knew it immediately.',
  ],
  RUN_OUT: [
    'RUN OUT! Direct hit, and he is well short!',
    'A dreadful mix-up — RUN OUT by a distance!',
    'RUN OUT! Sharp work and the bails are off in a flash.',
    'A bullet throw finds the stumps — run out!',
    "Hesitation is fatal — RUN OUT at the striker's end!",
    'Yes! No! Yes! No! — RUN OUT! A needless mix-up ends the innings.',
    'The fielder picks up and hurls — direct hit — RUN OUT!',
    'Neither batter wanted that single — both in the same half!',
    'A superb piece of fielding — runs in, gathers and hits in one motion!',
    'Called through for a suicidal run — RUN OUT by miles!',
    "The throw comes in flat and true — RUN OUT at the striker's end!",
    'A comedy of errors — neither batter communicates and one goes — OUT!',
    'Dived but could not make his ground — RUN OUT! Agonising.',
    'The direct hit is brilliant — RUN OUT! The crowd goes crazy.',
    'The underarm flick at the stumps — direct hit — RUN OUT!',
  ],
  STUMPED: [
    'STUMPED! Lightning-quick gloves behind the timber!',
    'Beaten in the flight and stumped in the blink of an eye!',
    'STUMPED! Dragged well out of his crease and gone.',
    'The keeper whips off the bails in a heartbeat — stumped!',
    'Drawn forward, back foot in the air — stumped!',
    'Drifts down the pitch and misses — the keeper does the rest — STUMPED!',
    'Spun past the bat and those gloves were electric — stumped!',
    'Lured out of his crease by the flight — and that is the end of him!',
    'The stumper anticipates brilliantly — STUMPED before he is back!',
    'A beautifully disguised delivery — misses the ball and his crease — OUT!',
    'Turned down the leg side, the batter is stranded — stumped!',
    'STUMPED! A fine piece of collaboration between spinner and keeper.',
    'The keeper is like a cat — STUMPED in an instant!',
    'Goes for the big shot, misses, and the keeper is too quick — STUMPED!',
  ],
  HIT_WICKET: [
    'HIT WICKET! He has trodden on his own stumps!',
    'Extraordinary — the bat clips the bails, hit wicket!',
    'HIT WICKET! Loses his balance and dislodges a bail.',
    'A tangle of feet and pads — hit wicket, remarkable!',
    'Stumbles back onto the stumps — hit wicket!',
    'Swings hard, overbalances — and treads on his own stumps! HIT WICKET!',
    'Going for the pull, he clips a bail on the backswing — out!',
    'Steps back too far — HIT WICKET! That is truly heartbreaking.',
    'The bail simply falls as the bat follows through — unusual dismissal!',
    'HIT WICKET! Unbelievable scenes — he has done it to himself.',
    'Lost his footing going back — the stumps are hit — HIT WICKET!',
  ],
};

// ─── Wicket-fall atmosphere lines ────────────────────────────────────────────

const WICKET_FALL: string[] = [
  'A wicket falls, and the momentum swings hard!',
  'Big breakthrough! The fielding side is up and about.',
  'That is a huge wicket at a crucial moment.',
  'The new batter has it all to do now.',
  'Wicket! The pressure was building and it finally told.',
  'A vital strike — the bowling side smells blood.',
  'Down goes another — the innings is wobbling badly.',
  'The breakthrough the captain was crying out for!',
  'Wicket! A hush around the ground, then a roar.',
  'OUT! That could well be the turning point of this match.',
  'A wicket — and suddenly the complexion of this game has changed.',
  'The new batter will be feeling the nerves right now.',
  'Another one goes — this fielding side is pumped!',
  'WICKET! The fielding side celebrate wildly — what a moment!',
  'The batter trudges off, and the scoreboard pressure grows.',
  'The bowler has earned that — a wicket of real quality.',
  'OUT! The tension in this ground is electric.',
  'That changes everything — a massive breakthrough!',
  'The home side erupts — what a critical wicket!',
  'Wicket — the lower order will be nervous watching from the balcony.',
  'A huge moment in the match — the innings is in trouble!',
  'The crowd erupts — a wicket they have been building toward!',
  'OUT! The batter shakes his head in disbelief.',
  'A wicket that could define this entire match.',
  'An inspired delivery — the batter had no chance.',
];

// ─── Situational / contextual phrases ────────────────────────────────────────

const POWERPLAY_PHRASES: string[] = [
  'The field is up — the pressure is on the batter to score!',
  'Powerplay cricket — every dot ball is a victory for the fielding side.',
  'The fielding restrictions are on — the batting side must make them count.',
  'A powerplay delivery, and the batter has a chance to cash in.',
  'Early aggression sets the tone — the fielding side needs wickets now.',
  'The powerplay is ticking away — runs or wickets, something must happen.',
  'Six fielders inside the circle — this is batting gold if you can find the gaps.',
  'The powerplay is where matches are won and lost. These overs matter enormously.',
  'Restriction in place — four fielders outside, six inside. Every boundary counts double.',
  'The batting side must capitalise in this powerplay. Good deliveries are getting hit here.',
  'Powerplay aggression — the top order is expected to set the tone right now.',
  'A boundary here would set the tone for the entire innings.',
  'The fielding captain is looking to stem the flow — the batter is hunting boundaries.',
  'Early wickets in the powerplay could strangle this chase before it begins.',
  'The opening burst must establish the foundation — every run in the powerplay is precious.',
  'Powerplay cricket demands clarity of thought — attack or consolidate? The decision is now.',
  'The fielding restrictions are a weapon for the batters. Use them wisely.',
  'Six overs of powerplay left — the equation demands attacking cricket.',
];

const DEATH_OVER_PHRASES: string[] = [
  'Death bowling — the pressure is at its absolute peak.',
  'The crowd senses something special in these final overs.',
  'Every ball in the death is worth its weight in gold.',
  'The field spreads to the boundary — the batter must clear them all.',
  'Death over cricket — the ultimate chess match between bat and ball.',
  'The team needs its finishers to stand up right here.',
  'The yorker is the weapon of choice in the death — but the full toss lurks.',
  'Five fielders on the boundary — the batter needs to thread the gaps.',
  'Death or glory cricket — the finisher must find a way through.',
  'The bowler is hiding the ball — slower deliveries could be the key.',
  'In the death, every single matters. Every dot is a treasure for the defence.',
  'The slog-sweep, the ramp, the scoop — all options on the table in these final overs.',
  'The hardest craft in limited-overs cricket: bowling the death. The batter knows it too.',
  'Final five overs. The equation is set. Someone has to win this battle — bat or ball.',
  'Death bowling mastery — the bowler goes back to the yorker, probing the block-hole.',
  'The crowd is on its feet. Every delivery in these final overs is electric.',
  'Two fielders on the long-on boundary, two on long-off — find the gap or lose the match.',
  'The finisher takes guard. Their job is to be the difference between a good total and a great one.',
];

// ─── Collapse / rout scenarios ────────────────────────────────────────────────

const COLLAPSE_PHRASES: string[] = [
  'Wickets are tumbling at an alarming rate — the innings is in freefall!',
  'Three down! The middle order has completely crumbled.',
  'This is a top-order collapse of the highest order — the batting side is in disarray.',
  'The scoreboard has barely moved but the wickets keep falling. Crisis!',
  'Four wickets for precious few runs — the recovery mission is Herculean now.',
  'The dressing room must be a tense place right now. Wicket after wicket after wicket.',
  'A classic batting collapse — pressure, a poor shot, another wicket, repeat.',
  'The bowling side smells blood and they are hunting in packs. This is a rout in the making.',
  'Helpless. Simply helpless. The middle order has offered nothing.',
  'Five down! The lower order now needs to show extraordinary resolve.',
  'The tail is exposed, and the bowling side knows it. This could be over quickly.',
  'A procession of batters. None of them have answered the call today.',
  'Wicket, wicket, wicket — the momentum has swung violently and completely.',
  'From a position of comfort to a crisis. That is how quickly this game can change.',
  'The batting side needed partnerships. They got collapses instead.',
  'Three wickets in five balls — this match is turning on its head!',
  'Each new batter faces the same problem: a bowling side who cannot be stopped.',
  'The scorecard makes for grim reading for the batting side. A capitulation.',
];

// ─── Last-over thriller phrases ───────────────────────────────────────────────

const LAST_OVER_THRILLER_PHRASES: string[] = [
  'Last over. The match comes down to these six deliveries. Everything is on the line.',
  'Six balls to settle it. This is what limited-overs cricket was made for.',
  'The final over — and the noise in this ground is absolutely deafening!',
  'Everything depends on the next six balls. Both teams can still win this.',
  'Last over of the match — and the crowd is already on their feet!',
  'A thriller is in the making. Six deliveries separate the teams.',
  'The bowler has the ball. The batters need the runs. One over. One result.',
  'The pressure of the final over compresses time itself. Everything. Right. Now.',
  'Six balls. That is all that remains between these two sides.',
  'Last over called! The atmosphere in the stadium has reached fever pitch.',
  'The captain sets the field for the last over — every placement is critical.',
  'Win or lose — it comes down to this final over of cricket.',
  'The tension is unbearable. The last over is upon us. What happens next, nobody knows.',
  'This is what cricket fans come to see — a last-over decider!',
  'Breathtaking scenes. The last six balls will settle this extraordinary contest.',
];

// ─── Tailender heroics ────────────────────────────────────────────────────────

const TAILENDER_PHRASES: string[] = [
  'The tail wags! The lower order refuses to go quietly.',
  'A lower-order partnership is building — this could yet save the innings!',
  'Who needs top-order runs? The tail is doing it themselves!',
  'The numbers nine and ten — unexpected heroes in this remarkable innings.',
  'The batting captain must be grinning in the dressing room. The tail is fighting!',
  'Last-wicket cricket — every run adds to a total that seemed already settled.',
  'A precious stand for the final wicket. Pride and runs in equal measure.',
  'The lower order does not read the script. They just bat. And they are batting magnificently.',
  'The bowlers must be frustrated — they cannot finish this innings off!',
  'Tailenders with the nerve of top-order batters. This is unexpectedly riveting cricket.',
];

const TIGHT_CHASE_PHRASES: string[] = [
  'The required rate is climbing — this is getting desperate.',
  'With wickets in hand, anything is possible — but time is running out!',
  'The asking rate is through the roof — the batting side needs a miracle.',
  'The chase is on — the crowd is absolutely electric right now.',
  'A partnership here could change the whole complexion of this game.',
  'It is down to the wire — can they get over the line?',
];

const PARTNERSHIP_PHRASES: string[] = [
  'The partnership is building nicely — the fielding side grows anxious.',
  'A crucial partnership developing here at exactly the right time.',
  'These two are in excellent touch — the fielding captain shuffles his options.',
  'The partnership grows — and so does the confidence in the batting camp.',
  'Two batters in form, building something special — the crowd loves it.',
  'A vital stand — this is exactly what the innings needed.',
];

// ─── Player-name pools (use {name} placeholder) ───────────────────────────────

const NAMED_FOUR_LINES: string[] = [
  '{name} — cover drive — FOUR!',
  '{name} lofts over the infield — FOUR!',
  '{name} cuts hard — FOUR to the rope!',
  '{name} flicks off the pads — FOUR! Gorgeous.',
  '{name} times it beautifully through extra cover — FOUR!',
  '{name} reverse-sweeps! FOUR to third man!',
  '{name} pulls emphatically — FOUR!',
];

const NAMED_SIX_LINES: string[] = [
  '{name} dispatches it into the stands — MAXIMUM!',
  '{name} goes downtown — SIX! What a shot!',
  '{name} picks the length early and launches it — SIX!',
  '{name} — pure power and timing — SIX!',
  '{name} clears long-on with ease — MAXIMUM!',
  '{name} steps out and lofts — SIX! The crowd erupts!',
];

const NAMED_WICKET_LINES: string[] = [
  '{name} departs — a big wicket!',
  '{name} has to walk — what a blow for the batting side!',
  '{name} is out — and that changes everything.',
  '{name} trudges off — a crucial breakthrough!',
  '{name} is dismissed — the pressure is on now.',
];

// ─── Exported types ───────────────────────────────────────────────────────────

interface BallCommentaryCtx {
  outcome: BallOutcome;
  rng: Rng;
  dismissal?: Dismissal;
  delivery?: DeliverySpec;
  shot?: ShotType;
  runOut?: boolean;
  /** Optional: striker name to personalise key-moment lines. */
  strikerName?: string;
  /** Optional: bowler name to personalise wicket lines. */
  bowlerName?: string;
  /** Is this a powerplay ball? */
  powerplay?: boolean;
  /** Is this a death-over ball (last 20% of innings)? */
  deathOvers?: boolean;
  /** Is this a tight chase situation? */
  tightChase?: boolean;
  /** Partnership runs in current partnership (>= 50 triggers flavour). */
  partnershipRuns?: number;
}

// ─── Core exported functions ──────────────────────────────────────────────────

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function fill(template: string, name: string): string {
  return template.replace('{name}', name);
}

/**
 * Full contextual commentary. Weaves delivery, stroke, player name, and
 * situational flavour into the line. Fully deterministic via the rng.
 */
export function ballCommentary(ctx: BallCommentaryCtx): string {
  const {
    outcome,
    rng,
    dismissal,
    delivery,
    shot,
    runOut,
    strikerName,
    bowlerName,
    powerplay,
    deathOvers,
    tightChase,
    partnershipRuns,
  } = ctx;

  if (outcome === 'W') {
    // Named wicket line (30% of the time when a name is provided)
    if (bowlerName && rng() < 0.3) return fill(pick(NAMED_WICKET_LINES, rng), bowlerName);
    if (strikerName && rng() < 0.3) return fill(pick(NAMED_WICKET_LINES, rng), strikerName);
    const base = dismissal ? pick(DISMISSAL_PHRASES[dismissal.type], rng) : pick(WICKET_FALL, rng);
    if (delivery && !runOut && rng() < 0.5) return `${cap(delivery.label)} — ${base}`;
    return base;
  }

  // Named boundary lines
  if (strikerName) {
    if (outcome === '6' && rng() < 0.45) return fill(pick(NAMED_SIX_LINES, rng), strikerName);
    if (outcome === '4' && rng() < 0.35) return fill(pick(NAMED_FOUR_LINES, rng), strikerName);
  }

  // Enrich boundaries with the actual stroke played.
  if (shot && (outcome === '4' || outcome === '6') && rng() < 0.55) {
    const label = cap(SHOT_LABEL[shot]);
    return outcome === '6' ? `${label} — SIX!` : `${label} — four!`;
  }

  // Situational commentary — only consume RNG when a context flag is actually set
  // (guards the RNG call to preserve backwards-compatible determinism)
  const hasSituational =
    deathOvers ||
    tightChase ||
    powerplay ||
    (partnershipRuns !== undefined && partnershipRuns >= 50);
  if (hasSituational && rng() < 0.2) {
    if (deathOvers) return pick(DEATH_OVER_PHRASES, rng);
    if (tightChase) return pick(TIGHT_CHASE_PHRASES, rng);
    if (powerplay) return pick(POWERPLAY_PHRASES, rng);
    if (partnershipRuns !== undefined && partnershipRuns >= 50)
      return pick(PARTNERSHIP_PHRASES, rng);
  }

  // Delivery-enriched line for dots
  if (delivery && outcome === 'DOT' && rng() < 0.5)
    return `${cap(delivery.label)} — ${pick(PHRASES.DOT, rng).toLowerCase()}`;

  return pick(PHRASES[outcome], rng);
}

/** A batting-collapse atmosphere line. */
export function collapseLine(rng: Rng): string {
  return pick(COLLAPSE_PHRASES, rng);
}

/** A last-over thriller line. */
export function lastOverThrillerLine(rng: Rng): string {
  return pick(LAST_OVER_THRILLER_PHRASES, rng);
}

/** A tailender-heroics line. */
export function tailenderLine(rng: Rng): string {
  return pick(TAILENDER_PHRASES, rng);
}
