# Newspaper Content Library — Approved Runtime Specification

> **APPROVED AND WIRED INTO THE APP**
>
> The typed runtime catalogue lives in `src/content/newspaperTemplates.ts`.
> Small factual-safety corrections in that module take precedence where the
> review draft implied an unverified innings phase, control or causality.

## Scope and safeguards

- The catalogue contains exactly **120 original templates**.
- The writing follows the general sports-report pattern of subject, decisive
  action and consequence. It does not reproduce real newspaper headlines or
  article text.
- A template may render only when every required fact is present in
  `MatchState`, its `Fixture`, or `SaveGame`. Missing data must reject the
  template; raw placeholders must never reach the UI.
- The headline announces the angle, the deck gives the verified result or
  performance, and the body adds context. These three fields should not say the
  same thing in different words.
- Copy selection must not change rewards, match results, progression, ratings,
  selection, trophies or any other gameplay feature.

## Exact catalogue count

| Group                          |        Categories | Templates |
| ------------------------------ | ----------------: | --------: |
| Match reports                  |            10 × 8 |        80 |
| Trophy editions                |            1 × 10 |        10 |
| Promotion and call-up editions |            1 × 10 |        10 |
| Tournament-exit editions       |            1 × 10 |        10 |
| Milestone and record editions  |            1 × 10 |        10 |
| **Total**                      | **14 categories** |   **120** |

## Approved data placeholders

All placeholders below are formatting helpers over persisted or computed game
facts. No template may invent a partnership, boundary count, unbeaten status,
crowd reaction, quote, injury, selection opinion or phase-of-play detail.

| Placeholder                           | Verified source                                                      |
| ------------------------------------- | -------------------------------------------------------------------- |
| `[PLAYER]`                            | `SaveGame.players[save.userPlayerId].name`                           |
| `[TEAM]`, `[OPPONENT]`                | Match team IDs resolved through `SaveGame.teams`                     |
| `[RUNS]`, `[BALLS]`, `[WICKETS]`      | User rows in the completed match scorecard                           |
| `[PERFORMANCE_LINE]`                  | Non-zero scorecard facts only, such as `125 from 102` or `5 wickets` |
| `[TEAM_SCORE]`, `[OPPONENT_SCORE]`    | Completed innings totals, formatted with wickets where applicable    |
| `[TARGET]`                            | First-innings total plus one in a completed chase                    |
| `[MARGIN]`                            | Persisted `match.result.margin`                                      |
| `[OUTCOME_LINE]`                      | Verified result sentence built from winner, tie state and `[MARGIN]` |
| `[FORMAT]`                            | `match.format`                                                       |
| `[COMPETITION]`, `[VENUE]`            | Completed fixture metadata                                           |
| `[TROPHY]`, `[TOURNAMENT]`, `[STAGE]` | Confirmed competition and bracket metadata                           |
| `[SEASON]`                            | Season attached to the completed fixture or career event             |
| `[FROM_LEVEL]`, `[TO_LEVEL]`          | Confirmed career transition                                          |
| `[POSITION]`, `[GROUP_SIZE]`          | Final persisted tournament table; position renders as an ordinal     |
| `[MILESTONE]`, `[RECORD]`, `[COUNT]`  | Newly confirmed record or milestone already present in `SaveGame`    |

Capitalisation and possessive forms are renderer concerns. For example,
`[PLAYER]’s` must be formatted safely for names already ending in “s”.

## Eligibility order

Special editions are selected from their explicit event: trophy, promotion or
call-up, tournament exit, then milestone or record. A completed match uses the
first eligible report category in this order:

1. All-round performance: at least 50 runs and 3 wickets.
2. Century in a successful chase: at least 100 runs, batting second, team won.
3. Other century: at least 100 runs.
4. Five-wicket haul: at least 5 wickets.
5. Three- or four-wicket spell: 3–4 wickets.
6. Fifty in a win: 50–99 runs and team won.
7. Fifty in a loss: 50–99 runs and team lost.
8. Close win or close loss, but only when the existing notability gate is met.
9. Player of the Match not already covered above.

A “close” limited-overs result means no more than 10 runs, 2 wickets, or 6 balls
remaining. That threshold is a proposed presentation rule, not a match-engine
change.

## Match reports — 80 templates

### Century while setting a total or in a non-winning chase — 8

| ID      | Headline                                   | Deck                                                                                 | Body                                                                                                                          |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `CS-01` | `[PLAYER] SETS THE TERMS`                  | `[RUNS] from [BALLS] puts [TEAM] in the contest against [OPPONENT]. [OUTCOME_LINE].` | `[PLAYER] gave the innings its shape and left the result to be decided around a substantial individual score.`                |
| `CS-02` | `[PLAYER] BUILDS A SCORE TO REMEMBER`      | `[PLAYER] makes [RUNS] as [TEAM] post [TEAM_SCORE] against [OPPONENT].`              | `The hundred supplied the innings with its clearest source of control. When the match ended, [OUTCOME_LINE].`                 |
| `CS-03` | `[PLAYER] MAKES THE DAY COUNT`             | `[RUNS] from [BALLS] leads [TEAM]’s batting effort in [COMPETITION].`                | `One innings carried much of [TEAM]’s work with the bat, giving [OPPONENT] a performance they had to answer.`                 |
| `CS-04` | `[PLAYER] PUTS THE INNINGS ON FIRM GROUND` | `[TEAM_SCORE] is built around [PLAYER]’s [RUNS] against [OPPONENT].`                 | `The total gathered weight around [PLAYER], whose hundred kept [TEAM] firmly in the contest. [OUTCOME_LINE].`                 |
| `CS-05` | `[PLAYER] TAKES CENTRE STAGE`              | `[RUNS] from [BALLS] is the headline contribution as [TEAM] face [OPPONENT].`        | `The innings became the central fact of the match, supplying [TEAM] with their strongest individual batting return.`          |
| `CS-06` | `[PLAYER] CARRIES THE SCORE`               | `[PLAYER] contributes [RUNS] of [TEAM]’s [TEAM_SCORE] in the [FORMAT] contest.`      | `The hundred held the batting effort together and ensured the match was shaped by more than the final margin alone.`          |
| `CS-07` | `[PLAYER] FINDS ANOTHER LEVEL`             | `[RUNS] from [BALLS] marks a commanding personal return against [OPPONENT].`         | `[TEAM] had a major innings to work with. When the contest was complete, [OUTCOME_LINE].`                                     |
| `CS-08` | `[PLAYER] BATS BEYOND THE ORDINARY`        | `[PLAYER] reaches [RUNS] from [BALLS] at [VENUE].`                                   | `A three-figure score became the defining individual achievement of the fixture and a new entry in [PLAYER]’s season record.` |

### Century in a successful chase — 8

| ID      | Headline                              | Deck                                                                        | Body                                                                                                                       |
| ------- | ------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `CC-01` | `[PLAYER] TAKES THE CHASE HOME`       | `[RUNS] from [BALLS] carries [TEAM] past [TARGET] against [OPPONENT].`      | `[PLAYER] kept the target within reach until the pursuit was complete, turning a major innings into victory.`              |
| `CC-02` | `[PLAYER] ANSWERS EVERY RUN`          | `[TEAM] chase [TARGET], with [PLAYER] making [RUNS], and win by [MARGIN].`  | `The target set the scale; [PLAYER]’s hundred carried [TEAM] through the largest share of the pursuit.`                    |
| `CC-03` | `[PLAYER] GUIDES [TEAM] THROUGH`      | `[RUNS] from [BALLS] anchors a successful chase against [OPPONENT].`        | `The pursuit stayed organised around one major contribution before [TEAM] crossed the target.`                             |
| `CC-04` | `[PLAYER] OWNS THE PURSUIT`           | `[PLAYER] leads [TEAM] to [TARGET] with a score of [RUNS].`                 | `A chase can narrow every decision; this one retained a clear centre as [PLAYER] accumulated the runs that mattered most.` |
| `CC-05` | `[PLAYER] MAKES THE TARGET DISAPPEAR` | `[TEAM] reach their target after [PLAYER] scores [RUNS] from [BALLS].`      | `[OPPONENT] had a total to defend, but [PLAYER] ensured the pursuit ended with [TEAM] on the winning side.`                |
| `CC-06` | `[PLAYER] HOLDS THE CHASE TOGETHER`   | `[RUNS] is the leading contribution as [TEAM] beat [OPPONENT] by [MARGIN].` | `The innings gave the pursuit continuity and kept the target within [TEAM]’s reach.`                                       |
| `CC-07` | `[PLAYER] TURNS TARGET INTO TRIUMPH`  | `[PLAYER] makes [RUNS] in [TEAM]’s successful chase of [TARGET].`           | `The hundred changed a required total into a completed result and put [PLAYER] at the centre of the win.`                  |
| `CC-08` | `[PLAYER] SEES [TEAM] OVER THE LINE`  | `[RUNS] from [BALLS] powers [TEAM] to victory over [OPPONENT] by [MARGIN].` | `The chase ended in [TEAM]’s favour because its largest individual innings matched the scale of the target.`               |

### Fifty in a win — 8

| ID      | Headline                               | Deck                                                                 | Body                                                                                                                      |
| ------- | -------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `FW-01` | `[PLAYER] BUILDS THE PLATFORM`         | `[RUNS] from [BALLS] helps [TEAM] beat [OPPONENT] by [MARGIN].`      | `The half-century gave [TEAM] a dependable batting contribution before the wider result was secured.`                     |
| `FW-02` | `[PLAYER] GIVES [TEAM] THE EDGE`       | `[PLAYER] makes [RUNS] in a winning [FORMAT] effort at [VENUE].`     | `The innings did not need a hundred to matter; it supplied enough weight to influence a completed victory.`               |
| `FW-03` | `[PLAYER] MAKES THE DIFFERENCE`        | `[RUNS] from [BALLS] stands out as [TEAM] overcome [OPPONENT].`      | `The match contained a full team result, but [PLAYER]’s score provided its clearest individual batting contribution.`     |
| `FW-04` | `[PLAYER] PUTS RUNS BEHIND THE WIN`    | `[TEAM] win by [MARGIN] after [PLAYER] contributes [RUNS].`          | `The final margin belongs to the team; the half-century records where a significant share of the batting work came from.` |
| `FW-05` | `[PLAYER] KEEPS [TEAM] MOVING`         | `[RUNS] from [BALLS] supports [TEAM]’s victory over [OPPONENT].`     | `The innings added control to the batting effort and left [TEAM] better placed to finish the contest.`                    |
| `FW-06` | `[PLAYER] DELIVERS WHEN IT COUNTS`     | `[PLAYER] scores [RUNS] as [TEAM] take the result in [COMPETITION].` | `The half-century added substance to [TEAM]’s batting and finished on the winning side of the contest.`                   |
| `FW-07` | `[PLAYER] LEAVES A MARK ON THE RESULT` | `[TEAM] defeat [OPPONENT] by [MARGIN], led by [PLAYER]’s [RUNS].`    | `The innings supplied a substantial block of runs inside a victory built by the full side.`                               |
| `FW-08` | `[PLAYER] TURNS START INTO SUBSTANCE`  | `[RUNS] from [BALLS] helps [TEAM] complete a [FORMAT] win.`          | `The half-century converted time at the crease into a result-bearing contribution and another meaningful season score.`   |

### Fifty in a loss — 8

| ID      | Headline                                       | Deck                                                                       | Body                                                                                                                        |
| ------- | ---------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `FL-01` | `[PLAYER]’S RESISTANCE GOES UNREWARDED`        | `[RUNS] from [BALLS], but [OPPONENT] win by [MARGIN].`                     | `[PLAYER] gave [TEAM] a route into the contest; the result turned elsewhere and left the innings as the clearest positive.` |
| `FL-02` | `[PLAYER] FIGHTS AS [TEAM] FALL SHORT`         | `[PLAYER] makes [RUNS] in [TEAM]’s defeat to [OPPONENT].`                  | `The half-century survived the result as a substantial personal contribution, even though it could not change the winner.`  |
| `FL-03` | `[PLAYER] FINDS RUNS, NOT THE RESULT`          | `[RUNS] from [BALLS] leads [TEAM]’s effort as they lose by [MARGIN].`      | `A strong innings and a difficult outcome sit side by side; [PLAYER] leaves with runs but not the win.`                     |
| `FL-04` | `[PLAYER] STANDS UP IN DEFEAT`                 | `[PLAYER] contributes [RUNS] as [OPPONENT] take the [FORMAT] contest.`     | `[TEAM] had an innings to build around, but the wider match moved beyond the reach of one contribution.`                    |
| `FL-05` | `[PLAYER] CARRIES THE FIGHT`                   | `[RUNS] from [BALLS] gives [TEAM] hope before a loss by [MARGIN].`         | `The half-century kept a competitive thread in the match without disguising the final result.`                              |
| `FL-06` | `[PLAYER] LEAVES WITH RUNS TO SHOW`            | `[PLAYER] scores [RUNS] against [OPPONENT], despite [TEAM]’s defeat.`      | `The outcome denied [TEAM], while the innings gave [PLAYER] something tangible to carry into the next fixture.`             |
| `FL-07` | `[PLAYER] MAKES A CASE AMID THE LOSS`          | `[RUNS] is [TEAM]’s notable batting return as [OPPONENT] win by [MARGIN].` | `Results decide the table, but performances still shape a career; this half-century belongs to the latter record.`          |
| `FL-08` | `[PLAYER]’S HALF-CENTURY CANNOT TURN THE TIDE` | `[PLAYER] reaches [RUNS] from [BALLS] in defeat at [VENUE].`               | `The innings added weight to [TEAM]’s total, though [OPPONENT] still completed the decisive work.`                          |

### Three- or four-wicket spell — 8

| ID      | Headline                               | Deck                                                                                 | Body                                                                                                               |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `WS-01` | `[PLAYER] BREAKS THE GAME OPEN`        | `[WICKETS] wickets give [PLAYER] a leading role against [OPPONENT]. [OUTCOME_LINE].` | `The spell removed enough batters to alter the innings and register a clear bowling contribution in the result.`   |
| `WS-02` | `[PLAYER] FINDS A WAY THROUGH`         | `[PLAYER] takes [WICKETS] wickets in the [FORMAT] meeting with [OPPONENT].`          | `Each dismissal reduced the batting side’s options and gave [TEAM] a spell around which to organise their attack.` |
| `WS-03` | `[PLAYER] MAKES THE BALL COUNT`        | `[WICKETS] wickets mark [PLAYER]’s impact at [VENUE].`                               | `Every dismissal strengthened the spell and gave [TEAM] another opening against [OPPONENT].`                       |
| `WS-04` | `[PLAYER] CUTS THROUGH THE ORDER`      | `[PLAYER] claims [WICKETS] wickets as [TEAM] face [OPPONENT].`                       | `The dismissals supplied repeated progress for [TEAM], ensuring [PLAYER]’s bowling shaped the innings.`            |
| `WS-05` | `[PLAYER] TURNS PRESSURE INTO WICKETS` | `[WICKETS] wickets lead [PLAYER]’s contribution in a match decided by [MARGIN].`     | `The spell repeatedly interrupted [OPPONENT] and gave [TEAM] fresh control of the innings.`                        |
| `WS-06` | `[PLAYER] LEAVES A MARK WITH THE BALL` | `[PLAYER] returns [WICKETS] wickets against [OPPONENT].`                             | `The performance gave [TEAM] a sustained source of dismissals, whatever the direction of the final outcome.`       |
| `WS-07` | `[PLAYER] KEEPS [OPPONENT] IN CHECK`   | `[WICKETS] wickets underline [PLAYER]’s role in the [FORMAT] contest.`               | `Across a sustained multi-wicket return, [PLAYER] gave [TEAM] repeated ways back into the innings.`                |
| `WS-08` | `[PLAYER] STRIKES AGAIN AND AGAIN`     | `[PLAYER] takes [WICKETS] wickets as [OUTCOME_LINE].`                                | `The repeated breakthroughs made [PLAYER] one of the central figures in the innings.`                              |

### Five wickets or more — 8

| ID      | Headline                                     | Deck                                                                           | Body                                                                                                                         |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `WH-01` | `[PLAYER] UNPICKS [OPPONENT]`                | `[WICKETS] wickets give [PLAYER] the outstanding bowling return of the match.` | `[OPPONENT] lost half their order or more to one bowler as [PLAYER] took command of the innings.`                            |
| `WH-02` | `[PLAYER] CLAIMS FIVE AND THE SPOTLIGHT`     | `[PLAYER] takes [WICKETS] wickets in [TEAM]’s meeting with [OPPONENT].`        | `What began as a productive spell grew into an achievement large enough to shape the whole match.`                           |
| `WH-03` | `[PLAYER] LEAVES THE ORDER SHORT OF ANSWERS` | `[WICKETS] wickets lead a major bowling performance at [VENUE].`               | `Dismissal followed dismissal until [PLAYER] had a five-wicket return and the innings had a defining bowler.`                |
| `WH-04` | `[PLAYER] OWNS THE BALL`                     | `[PLAYER] finishes with [WICKETS] wickets as [OUTCOME_LINE].`                  | `The final result has its own line; the bowling achievement earns another, having shaped so much of the opposition innings.` |
| `WH-05` | `[PLAYER] TAKES THE INNINGS APART`           | `[WICKETS] wickets against [OPPONENT] mark a standout [FORMAT] display.`       | `The haul gave [TEAM] repeated breakthroughs and placed [PLAYER] at the centre of the contest.`                              |
| `WH-06` | `[PLAYER] DELIVERS A FIVE-WICKET STATEMENT`  | `[PLAYER] claims [WICKETS] in [COMPETITION] at [VENUE].`                       | `Five or more wickets turned the spell into a career marker and the innings into [PLAYER]’s territory.`                      |
| `WH-07` | `[OPPONENT] CANNOT ESCAPE [PLAYER]`          | `[WICKETS] wickets make [PLAYER] the dominant bowler of the fixture.`          | `The opposition innings kept returning to the same problem, and every breakthrough deepened it.`                             |
| `WH-08` | `[PLAYER] WRITES THE MATCH IN WICKETS`       | `[PLAYER] takes [WICKETS] against [OPPONENT]. [OUTCOME_LINE].`                 | `The final result supplied one story; [PLAYER]’s haul supplied the clearest individual one with the ball.`                   |

### All-round performance — 8

| ID      | Headline                                   | Deck                                                                                   | Body                                                                                                                                         |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `AR-01` | `[PLAYER] SETS IT UP, THEN SHUTS IT DOWN`  | `[RUNS] runs and [WICKETS] wickets give [PLAYER] a complete match against [OPPONENT].` | `The batting created value and the bowling added another route to influence, joining both disciplines in one performance.`                   |
| `AR-02` | `[PLAYER] MAKES BOTH SKILLS MATTER`        | `[RUNS] from [BALLS] and [WICKETS] wickets lead [TEAM]’s all-round effort.`            | `[PLAYER] affected separate innings with separate skills, making the performance broader than either statistic alone.`                       |
| `AR-03` | `[PLAYER] HAS A HAND IN EVERYTHING`        | `[PERFORMANCE_LINE] stands out in the [FORMAT] fixture with [OPPONENT].`               | `Runs strengthened [TEAM]’s batting work; wickets strengthened the bowling response. The result records how far that combination travelled.` |
| `AR-04` | `[PLAYER] WRITES BOTH HALVES OF THE STORY` | `[RUNS] runs and [WICKETS] wickets put [PLAYER] at the centre as [OUTCOME_LINE].`      | `Batting and bowling occupy separate innings, but this performance joins them in one all-round account.`                                     |
| `AR-05` | `[PLAYER] GIVES [TEAM] TWO ANSWERS`        | `[PLAYER] scores [RUNS] and takes [WICKETS] against [OPPONENT].`                       | `Whenever the match demanded a different skill, [PLAYER] had another contribution to offer.`                                                 |
| `AR-06` | `[PLAYER] COMMANDS BAT AND BALL`           | `[PERFORMANCE_LINE] defines [PLAYER]’s day at [VENUE].`                                | `The dual contribution expanded [TEAM]’s options and made [PLAYER] impossible to reduce to one role in this fixture.`                        |
| `AR-07` | `[PLAYER] BUILDS, THEN BREAKS THROUGH`     | `[RUNS] from [BALLS] is followed by [WICKETS] wickets in [COMPETITION].`               | `One contribution helped construct [TEAM]’s position; the other removed opposition batters from theirs.`                                     |
| `AR-08` | `[PLAYER] DELIVERS THE COMPLETE SCORECARD` | `[PLAYER] combines [RUNS] runs with [WICKETS] wickets against [OPPONENT].`             | `The result came from a full team, while the most balanced individual line belonged to [PLAYER].`                                            |

### Close win — 8

| ID      | Headline                                     | Deck                                                                                | Body                                                                                                            |
| ------- | -------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `CW-01` | `[TEAM] HOLD THEIR NERVE`                    | `[TEAM] edge [OPPONENT] by [MARGIN] after [PLAYER] contributes [PERFORMANCE_LINE].` | `The small margin left little distance between the sides, making every contribution carry extra weight.`        |
| `CW-02` | `[TEAM] FIND THE LAST STEP`                  | `[PLAYER]’s [PERFORMANCE_LINE] forms part of a narrow win over [OPPONENT].`         | `The sides stayed close until [TEAM] found enough separation to take the result.`                               |
| `CW-03` | `[PLAYER] HELPS [TEAM] WIN THE FINE MARGINS` | `[TEAM] beat [OPPONENT] by [MARGIN] in [COMPETITION].`                              | `In a contest measured by a narrow margin, [PLAYER] supplied a performance with room to matter.`                |
| `CW-04` | `[TEAM] COME THROUGH THE SQUEEZE`            | `[MARGIN] separates [TEAM] and [OPPONENT] at [VENUE].`                              | `The gap stayed narrow, and [PLAYER]’s [PERFORMANCE_LINE] became part of the difference.`                       |
| `CW-05` | `[TEAM] TAKE A TIGHT ONE`                    | `[PLAYER] contributes [PERFORMANCE_LINE] as [TEAM] prevail by [MARGIN].`            | `The margin alone shows how little divided the teams when the contest closed.`                                  |
| `CW-06` | `[PLAYER] LEAVES A MARK ON A NARROW WIN`     | `[TEAM] overcome [OPPONENT] by [MARGIN] in the [FORMAT] contest.`                   | `A close result magnified [PLAYER]’s contribution while the full side carried the victory.`                     |
| `CW-07` | `[TEAM] EMERGE FROM A CLOSE CONTEST`         | `[MARGIN] confirms [TEAM]’s win after [PLAYER] records [PERFORMANCE_LINE].`         | `The score remained competitive through the completed innings and ended just far enough in [TEAM]’s favour.`    |
| `CW-08` | `[PLAYER] HELPS TIP THE BALANCE`             | `[PERFORMANCE_LINE] supports [TEAM] as they beat [OPPONENT] by [MARGIN].`           | `The match offered little room between winning and losing; [PLAYER]’s contribution landed on the winning side.` |

### Close loss — 8

| ID      | Headline                                      | Deck                                                                         | Body                                                                                                                     |
| ------- | --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `CL-01` | `[TEAM] FALL ON THE WRONG SIDE OF THE MARGIN` | `[OPPONENT] win by [MARGIN] despite [PLAYER]’s [PERFORMANCE_LINE].`          | `The contribution kept [TEAM] within reach, but it could not reverse the final result.`                                  |
| `CL-02` | `[PLAYER] GOES CLOSE WITH [TEAM]`             | `[PERFORMANCE_LINE] keeps [TEAM] in a contest lost by [MARGIN].`             | `The teams finished close together, with [OPPONENT] retaining the decisive edge.`                                        |
| `CL-03` | `[TEAM] MISS BY THE FINEST MEASURE`           | `[PLAYER] contributes [PERFORMANCE_LINE] as [OPPONENT] prevail by [MARGIN].` | `The result carries both a notable individual display and a narrow team defeat.`                                         |
| `CL-04` | `[PLAYER]’S EFFORT ENDS JUST SHORT`           | `[TEAM] lose to [OPPONENT] by [MARGIN] at [VENUE].`                          | `[PLAYER]’s [PERFORMANCE_LINE] helped keep the fixture close, though the completed result still belonged to [OPPONENT].` |
| `CL-05` | `[OPPONENT] EDGE A CONTEST OF INCHES`         | `[MARGIN] decides the [FORMAT] match despite [PLAYER]’s contribution.`       | `The gap was small enough to keep [TEAM] close, but not small enough to change the winner.`                              |
| `CL-06` | `[TEAM] PUSH, [OPPONENT] PREVAIL`             | `[PLAYER] records [PERFORMANCE_LINE] in a narrow loss by [MARGIN].`          | `The performance supplied resistance and the margin supplied the verdict.`                                               |
| `CL-07` | `[PLAYER] CANNOT QUITE CLOSE THE GAP`         | `[OPPONENT] defeat [TEAM] by [MARGIN] in [COMPETITION].`                     | `[PLAYER]’s [PERFORMANCE_LINE] left [TEAM] within range, but the opposition completed enough work to hold on.`           |
| `CL-08` | `[TEAM] LEAVE A CLOSE ONE BEHIND`             | `[MARGIN] separates the sides after [PLAYER] records [PERFORMANCE_LINE].`    | `The fixture ended near the boundary between outcomes, with [TEAM] narrowly outside the winning one.`                    |

### Player of the Match not covered above — 8

| ID      | Headline                                 | Deck                                                                                  | Body                                                                                                                       |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `PM-01` | `[PLAYER] LEAVES NO DOUBT`               | `[PERFORMANCE_LINE] earns [PLAYER] Player of the Match against [OPPONENT].`           | `The award identifies the fixture’s leading individual contribution while the result remains a separate team achievement.` |
| `PM-02` | `[PLAYER] TAKES THE MATCH HONOURS`       | `[PLAYER] receives Player of the Match after [OUTCOME_LINE].`                         | `The award capped the fixture by placing [PLAYER] at the centre of its individual honours.`                                |
| `PM-03` | `[PLAYER] EARNS THE FINAL WORD`          | `Player of the Match goes to [PLAYER] for [PERFORMANCE_LINE].`                        | `When the fixture closed, the award supplied a clear judgement about its strongest individual impact.`                     |
| `PM-04` | `[PLAYER] STANDS ABOVE THE CONTEST`      | `[PERFORMANCE_LINE] secures the individual honour in [COMPETITION].`                  | `The award adds formal recognition to the performance while the result remains a team achievement.`                        |
| `PM-05` | `[PLAYER] OWNS THE MATCH AWARD`          | `[PLAYER] is named Player of the Match in the [FORMAT] game with [OPPONENT].`         | `The honour records a match-specific high point and adds it to [PLAYER]’s career archive.`                                 |
| `PM-06` | `[PLAYER] MAKES THE BIGGEST IMPACT`      | `[PERFORMANCE_LINE] leads to Player of the Match recognition at [VENUE].`             | `The honour turns a notable return into the fixture’s leading individual award.`                                           |
| `PM-07` | `[PLAYER] HAS THE LAST SAY`              | `Player of the Match follows [PLAYER]’s [PERFORMANCE_LINE] against [OPPONENT].`       | `A notable performance became a lasting entry in [PLAYER]’s career scrapbook.`                                             |
| `PM-08` | `[PLAYER] CLAIMS THE MATCH’S TOP HONOUR` | `[TEAM] and [OPPONENT] finish their contest with [PLAYER] named Player of the Match.` | `[PERFORMANCE_LINE] explains why the award and the headline belong to [PLAYER].`                                           |

## Special editions — 40 templates

The four special-edition tables below are part of the approved catalogue.

### Trophy editions — 10

| ID      | Headline                             | Deck                                                                  | Body                                                                                                                                      |
| ------- | ------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `TR-01` | `[TEAM] TAKE THE CROWN`              | `[TROPHY] is secured at the end of the [SEASON] campaign.`            | `The final result confirms [TEAM] as champions of [COMPETITION]. Their name now enters the season’s roll of honour.`                      |
| `TR-02` | `[TROPHY] BELONGS TO [TEAM]`         | `The decisive [FORMAT] fixture ends with the prize settled.`          | `[OPPONENT] were beaten by [MARGIN] in the match that closed [COMPETITION]. For [TEAM], the last result became a title.`                  |
| `TR-03` | `SILVERWARE SIGNS OFF [SEASON]`      | `[TEAM] finish the campaign as [TROPHY] winners.`                     | `The competition’s final entry is complete: [TEAM] at the top. [TROPHY] now anchors their [SEASON] record.`                               |
| `TR-04` | `[PLAYER] SHARES IN [TEAM] TRIUMPH`  | `[TROPHY] crowns the [SEASON] campaign.`                              | `[PLAYER] ends [COMPETITION] as part of its champion side. The achievement reflects the full team run, not one isolated performance.`     |
| `TR-05` | `[TEAM] COMPLETE THE TITLE RUN`      | `The closing result converts a place in [COMPETITION] into [TROPHY].` | `Fixtures are over and the championship is official. [SEASON] will list [TEAM] as the side that finished with the prize.`                 |
| `TR-06` | `FINAL SETTLED, TROPHY WON`          | `[TEAM] defeat [OPPONENT] by [MARGIN] to claim [TROPHY].`             | `The closing [FORMAT] fixture carries the decisive result. [TEAM] leave as champions; [OPPONENT] finish as finalists.`                    |
| `TR-07` | `[TROPHY] GETS A [TEAM] NAMEPLATE`   | `A successful [SEASON] campaign reaches its official conclusion.`     | `[TEAM] are the confirmed winners of [COMPETITION]. The trophy records an achievement built across the tournament.`                       |
| `TR-08` | `[TEAM] TURN RESULT INTO SILVERWARE` | `[TEAM] beat [OPPONENT] by [MARGIN] to decide the [FORMAT] crown.`    | `The final carried a trophy as well as a result, and [TEAM] claimed both. It is the defining entry in their [SEASON] competition record.` |
| `TR-09` | `CHAMPIONS AT THE CLOSE`             | `[TEAM] take [TROPHY] after the last decision of [COMPETITION].`      | `The schedule is complete and the winners are known. [TEAM]’s [SEASON] campaign ends in the champions column.`                            |
| `TR-10` | `[SEASON] ENDS WITH [TROPHY]`        | `[TEAM] convert their place in the deciding match into the title.`    | `[OPPONENT] supplied the final opposition, with [MARGIN] between the sides. That result puts [TEAM] on the [COMPETITION] roll of honour.` |

### Promotion and call-up editions — 10

| ID      | Headline                               | Deck                                                         | Body                                                                                                                                                        |
| ------- | -------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PC-01` | `[PLAYER] MAKES THE STEP UP`           | `A move from [FROM_LEVEL] to [TO_LEVEL] has been confirmed.` | `The new status changes [PLAYER]’s next set of fixtures. The focus now shifts from earning selection to keeping a place.`                                   |
| `PC-02` | `NEXT LEVEL CALLS FOR [PLAYER]`        | `[TEAM] confirm [PLAYER]’s place at [TO_LEVEL].`             | `The call moves [PLAYER] beyond [FROM_LEVEL] after the case made there. Attention now turns to earning a role in the new squad.`                            |
| `PC-04` | `[PLAYER] ADDED TO [TEAM] PLANS`       | `A [TO_LEVEL] call-up opens a new route in [SEASON].`        | `[PLAYER] has been selected for a different level of competition. The call-up creates an opportunity; appearances and results will decide what follows.`    |
| `PC-05` | `THE STEP ARRIVES FOR [PLAYER]`        | `[TO_LEVEL] selection follows a spell at [FROM_LEVEL].`      | `[PLAYER]’s status has changed, but promotion is a starting point rather than a conclusion. [TEAM]’s coming fixtures provide the next test.`                |
| `PC-06` | `FROM [FROM_LEVEL] TO [TO_LEVEL]`      | `[PLAYER]’s promotion is now official.`                      | `The move changes the setting and standard of the next assignment. Previous performances earned attention; new ones will shape the stay.`                   |
| `PC-07` | `[TEAM] SEND FOR [PLAYER]`             | `[PLAYER] receives a call-up to [TO_LEVEL].`                 | `Selection places [PLAYER] in a new squad context. It is a chance to compete at the next level, not a guarantee beyond the call.`                           |
| `PC-08` | `[PLAYER] ENTERS THE [TO_LEVEL] FRAME` | `[SEASON] brings a confirmed move up from [FROM_LEVEL].`     | `[PLAYER] is now eligible for fixtures at the higher level. The record from here will be built against a different field of players.`                       |
| `PC-09` | `A NEW BADGE, A NEW TEST`              | `[PLAYER] joins [TEAM] at [TO_LEVEL].`                       | `The call-up changes both responsibility and opposition. Selection settles who gets the chance; performance settles what comes next.`                       |
| `PC-10` | `[PLAYER]’S NAME MAKES THE LIST`       | `[TEAM] include [PLAYER] in their [TO_LEVEL] squad.`         | `The squad announcement gives [PLAYER] a place in the next phase of [SEASON]. What follows will be measured through appearances rather than announcements.` |

### Tournament-exit editions — 10

| ID      | Headline                              | Deck                                                              | Body                                                                                                                                    |
| ------- | ------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `EX-01` | `RUN ENDS AT [STAGE]`                 | `[TEAM] leave [TOURNAMENT] after facing [OPPONENT].`              | `The result closes their [SEASON] schedule in the competition. There is no next-round fixture, and the campaign moves to review.`       |
| `EX-02` | `[TEAM] OUT OF [TOURNAMENT]`          | `[OPPONENT] advance after beating [TEAM] by [MARGIN].`            | `[TEAM]’s place in the bracket ends at [STAGE]. The defeat fixes their finishing point after the run that carried them there.`          |
| `EX-03` | `LAST PAGE FOR [TEAM]’S CAMPAIGN`     | `[TOURNAMENT] ends at [STAGE] for [TEAM].`                        | `[OPPONENT] won the deciding contest by [MARGIN], closing the route forward. [TEAM]’s [SEASON] tournament record is now complete.`      |
| `EX-04` | `EXIT CONFIRMED, REVIEW BEGINS`       | `[TEAM] finish [POSITION] of [GROUP_SIZE] in [TOURNAMENT].`       | `The standings leave [TEAM] outside the places that continue. Their group campaign ends with every result now on the record.`           |
| `EX-05` | `[OPPONENT] CLOSE THE DOOR`           | `[TEAM]’s [TOURNAMENT] run ends in defeat by [MARGIN].`           | `The decisive [STAGE] fixture sends [OPPONENT] onward. [TEAM] leave the bracket with no further match scheduled.`                       |
| `EX-06` | `[STAGE] PROVES THE FINAL STOP`       | `[TEAM] are eliminated from [TOURNAMENT].`                        | `The campaign reached this round before the path closed. Its completed scorecards now define [TEAM]’s [SEASON] tournament record.`      |
| `EX-07` | `[TEAM] MISS THE NEXT ROUND`          | `[POSITION] place in a group of [GROUP_SIZE] brings elimination.` | `The table, rather than a single knockout result, decides the exit. [TEAM]’s [TOURNAMENT] schedule ends with the group phase complete.` |
| `EX-08` | `NO NEXT FIXTURE FOR [TEAM]`          | `[OPPONENT] win the [STAGE] meeting by [MARGIN].`                 | `That outcome removes [TEAM] from [TOURNAMENT] and fixes their endpoint for [SEASON]. The bracket now moves on without them.`           |
| `EX-09` | `[TOURNAMENT] JOURNEY STOPS HERE`     | `[TEAM] reach [STAGE], but go no further.`                        | `Elimination supplies the final line of this campaign. The result sits alongside the matches that carried [TEAM] into the round.`       |
| `EX-10` | `[TEAM] SIGN OFF IN [POSITION] PLACE` | `A [GROUP_SIZE]-team field is narrowed without [TEAM].`           | `[TOURNAMENT] ends for [TEAM] at [STAGE]. The standings are settled and their remaining competition schedule is closed.`                |

### Milestone and record editions — 10

| ID      | Headline                             | Deck                                                   | Body                                                                                                                                        |
| ------- | ------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `MR-01` | `[PLAYER] REACHES [MILESTONE]`       | `The landmark arrives in [COMPETITION].`               | `[PLAYER]’s latest [FORMAT] outing adds a clear marker to the career record. The confirmed count now stands at [COUNT].`                    |
| `MR-02` | `[COUNT] AND COUNTING FOR [PLAYER]`  | `[MILESTONE] is now part of the official record.`      | `The mark was reached in [COMPETITION], giving [PLAYER]’s [SEASON] a new reference point. Future returns will build from this total.`       |
| `MR-03` | `[PLAYER] SETS [RECORD]`             | `A new benchmark is recorded in [COMPETITION].`        | `[PLAYER] has moved the recognised mark to [COUNT]. That number now provides the standard against which the next attempt will be measured.` |
| `MR-04` | `A LANDMARK IN THE LEDGER`           | `[PLAYER] completes [MILESTONE] during [SEASON].`      | `The achievement gives the career record a precise new marker. In [COMPETITION], the official count now reads [COUNT].`                     |
| `MR-05` | `[RECORD] NOW BELONGS TO [PLAYER]`   | `[COUNT] establishes a new mark in [FORMAT] cricket.`  | `The record book has been updated after [PLAYER]’s contribution for [TEAM]. The benchmark now carries a new name and figure.`               |
| `MR-06` | `[PLAYER] PASSES A CAREER MARK`      | `[MILESTONE] is reached in [COMPETITION].`             | `One fixture supplied the moment; the career before it supplied the count. [COUNT] is now attached to [PLAYER]’s record.`                   |
| `MR-07` | `THE NUMBER THAT MARKS [SEASON]`     | `[PLAYER] records [COUNT] in reaching [MILESTONE].`    | `[COMPETITION] supplied the setting for the landmark. It adds a precise achievement to [PLAYER]’s season summary.`                          |
| `MR-08` | `NEW HIGH FOR [PLAYER]`              | `[RECORD] is established at [COUNT].`                  | `The [FORMAT] benchmark was set in [COMPETITION]. [PLAYER]’s name now sits beside the mark until it is matched or surpassed.`               |
| `MR-09` | `[TEAM] WITNESS [PLAYER]’S LANDMARK` | `[MILESTONE] arrives during the [SEASON] campaign.`    | `The achievement is individual, but it was recorded in competition for [TEAM]. The official total now stands at [COUNT].`                   |
| `MR-10` | `RECORD BOOK, NEW ENTRY`             | `[PLAYER] adds [RECORD] to the [COMPETITION] archive.` | `The mark of [COUNT] is confirmed in [FORMAT] play. It gives the performance a place beyond the immediate fixture.`                         |

## Proposed deterministic selection and repetition control

Each template becomes immutable data with an `id`, category, headline, deck,
body, required placeholders and optional eligibility predicates. Rendering and
selection stay separate.

1. Build a verified fact object from the completed event.
2. Choose one category through the eligibility order above.
3. Reject templates whose required placeholders or predicates are unavailable.
4. Read `templateId` and `headlineFamily` from the five most recent scrapbook
   stories.
5. Exclude those five exact template IDs and the three most recent headline
   families when alternatives exist.
6. Sort the remaining IDs and select with a stable hash of
   `save.id + story.matchId + category`. Reloading the same result therefore
   cannot silently rewrite its article.
7. If filtering removes every candidate, relax headline-family history first,
   then exact-ID history from oldest to newest. Never relax fact eligibility.
8. Persist the chosen `templateId` on `NewspaperStory` so save/reload, sharing
   and the scrapbook always show the same copy.
9. Before archive insertion, normalise the rendered headline and reject an
   exact duplicate of the immediately previous headline when another eligible
   template exists.

The proposed history window is deliberately small: an eight-template match
category still has at least three exact-ID choices after excluding five recent
uses, while ten-template special categories retain five.

## Renderer rules

- Replace placeholders from the verified fact object in one pass.
- Reject the whole template if `/\[[A-Z_]+\]/` remains after rendering.
- Build `[PERFORMANCE_LINE]` from non-zero values only. Never render `0 (0)` or
  `0 WKT` as an achievement.
- Use `[OUTCOME_LINE]` as a clause without terminal punctuation, for example
  `Delhi Under-19 beat Mumbai Under-19 by 5 wickets`.
- Apply name possessives through a helper rather than concatenating blindly.
- Keep persisted copy as plain text; styling, wrapping and capitalisation remain
  responsibilities of the newspaper component.
- Log the chosen category and template ID for QA, but never include them in the
  player-facing clipping.

## Implementation status

The approved implementation includes:

- a typed content module containing these templates;
- unit tests for every required placeholder and eligibility predicate;
- tests proving no raw placeholder can render;
- tests covering five-story repetition avoidance and deterministic reloads;
- save migration for an optional `templateId`, preserving every existing story;
- narrow Android and iOS layout safeguards in the popup presentation.
