# Interaction Inventory

Source-derived inventory for visible Player Career and Manager Career controls. Running-app verification remains pending unless explicitly noted elsewhere.

| Screen | Label | Expected action | Actual handler | State change | Persistence behavior | Error state | Verification status |
|---|---|---|---|---|---|---|---|
| Player Career Hub | Back to Menu / Save & Exit to Menu | Return to main menu | `goMenu`, `onSaveExit` | None beyond save flush | Existing save is persisted before exit | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Claim daily reward | Claim daily login reward once | `handleClaimDaily` | Wallet/streak update | Store persists active save | Button hidden/disabled by claim state | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Open your story / Your Story | Open pending story/interview beats | `navigation.navigate('Narrative')` | None on open | Story resolution persists in Narrative | Card hidden when no pending story | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Play Match / Not enough energy | Start next eligible fixture | `handlePlayMatch` | Energy spent and match route opens | Match completion persists through store | Disabled/copy changes when energy insufficient | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Top up | Open store | `navigation.navigate('Purchase')` | None | n/a | Hidden unless low energy | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Advance season / Start Season | Rollover season | `advanceSeason` / season start callback | Season/year/fixtures/progression mutate | Store persists active save | Uses existing alerts/blockers | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Training | Open training screen | `navigation.navigate('Training')` | None | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Store | Open purchase screen | `navigation.navigate('Purchase')` | None | n/a | Store handles billing errors | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Challenge | Open daily challenge | `navigation.navigate('DailyChallenge')` | None | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Records / Hall of Fame | Open records | `navigation.navigate('Records')` | None | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Franchise Auction Sign / Stay | Accept or decline transfer offer | `acceptAuction` / `declineAuction` | Team/contract/auction state mutates | Store persists active save | Offer hidden when unavailable | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Negotiate / Sign contract | Open contract negotiation or sign offer | `navigation.navigate('ContractNegotiation')`, signing callback | Contract/wallet/club state mutates | Store persists active save | Button gated by offer state | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Represent country | Start international match | `navigation.navigate('Match', { intl: true })` | Energy spent in match flow | Match completion persists | Disabled/copy changes when energy insufficient | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Manage Portfolio | Open investment screen | `navigation.navigate('InvestmentScreen')` | None on open | Investments persist in target screen | Hidden until senior gate | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Manage Academy | Open academy management | `navigation.navigate('AcademyManagement')` | None on open | Academy actions persist in target screen | Hidden until senior gate | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | View Calendar | Open international calendar | `navigation.navigate('InternationalCalendar')` | None | n/a | Hidden until capped | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | View Bracket | Open U19 World Cup | `navigation.navigate('U19WorldCup')` | None | n/a | Hidden outside U19 context | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Career Hub | Retire | Trigger retirement flow | `onRetire` guarded by `canRetire(user)` and store `retire()` guard | Career retired / Hall of Fame check only from age 33 | Store persists active save | Hidden before age 33; direct store call returns `null` before age 33 | VERIFIED IN RUNNING APP |
| Player Career Hub | Full Profile / Cosmetics / Squad & Tactics / Inbox / Settings | Open support screens | `navigation.navigate(...)` | None on open | Target screens own mutations | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Training | Train | Run one role-eligible training session | `onTrain(group.id)` | Coins spent, attributes/session counters update | Store persists active save | Disabled for maxed, unaffordable, or ineligible groups | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Training | Popup dismiss | Close gain summary | `setPopup(null)` | UI only | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Daily Challenge | Play Challenge | Start challenge match | `onPlay` | Match route opens with challenge context | Completion/reward handled by match/store | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Daily Challenge | Share Your Score | Share completed score | `onShare` | Native share side effect | n/a | Share failure handled by platform | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Daily Challenge | Reward locked | Explain unavailable reward | Non-interactive `View` | None | n/a | No no-op button remains | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Season Pass | Upgrade / Upgrade to Premium | Start premium purchase | `onUpgrade` | Entitlement may update through purchases | Store persists purchase result | Loading state while busy | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Season Pass | Claim rewards | Claim reached pass tiers | `onClaim` | Claimed reward arrays and wallet update | Store persists active save | Locked/claimed states prevent repeat | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Purchase | Product price / Buy Now / Refill / Legend Bundle | Start purchase | `onBuy(product)` | Wallet/entitlement/rewards update on success | Store persists purchase result | Loading/error alert states | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Purchase | Watch ad | Start rewarded ad | `onWatchEnergyAd` | Energy reward only after ad callback | Store persists reward | Ad failure/cancel grants nothing | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Player Profile | Training focus chips | Set player training focus | `setTrainFocus(player.id, group)` | Player focus metadata changes | Store persists active save | Chips reflect selection | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Records | Main tabs / metric/filter chips | Switch record views | Local `set*` state | UI only | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Contract Negotiation | Sign / Counter / Hold out / Walk away | Resolve contract negotiation | `doSign`, `doNegotiate`, `doHoldOut`, navigation | Contract/wallet/story state mutates or route exits | Store persists active save | Response stage and alerts handle outcomes | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Back to Menu / Save & Exit to Menu | Return to menu | `goMenu`, `onSaveExit` | None beyond save flush | Existing save persisted before exit | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Primary action | Start next manager action/match | `primary.onPress` | Depends on action | Store persists through action | Button label reflects availability | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Navigation tiles | Open Squad, Transfers, Office, etc. | `navigation.navigate(tile.to)` | None on open | Target screens own mutations | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Take the job / Stay loyal | Accept or reject manager job offer | `takeNewJob`, `declineManagerJobOffer` | Team/job state mutates or offer clears | Store persists active save | Offer hidden when none | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Claim daily reward | Claim daily manager reward | Store reward callback | Wallet/streak update | Store persists active save | Button hidden/disabled by claim state | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Season Pass / Press Room | Open liveops/story screens | `navigation.navigate(...)` | None on open | Target screens own mutations | Hidden/counted by pending state | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Wage Ledger / Emergency Funds | Open wage ledger or buy budget | Navigation / `purchaseDeal` | Budget may update through purchase | Store persists result | Loading state while busy | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Player row / XI expand / tactical chips | Open player profile, expand XI, set tactics | Navigation / local/set tactics callbacks | Tactics mutate | Store persists tactics | Chips reflect selection | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Play format option | Start manager match | Match navigation callback | Match route opens | Completion persists | Disabled by readiness/energy where applicable | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Manager Hub | Team Talk option / Skip talk | Apply one pre-match talk or skip | `choosePreMatchTalk(...)` | Morale/tactical flag mutates once | Store persists active save | Repeat guarded by fixture flag | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Squad & Tactics | Transfers | Open transfer screen | `navigation.navigate('Transfers')` | None | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Squad & Tactics | Batting/Bowling/Field chips | Set manager tactics | `setTactics(...)` | Tactics mutate | Store persists active save | Selected chip reflects state | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Squad & Tactics | XI row / bench row / Confirm / Cancel | Stage and confirm swap | `swapBenchIntoSlot`, `confirmSwap`, `cancelSwap` | XI mutates only on confirm | Store persists active save | Invalid XI blocks confirm | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Squad & Tactics | Move up/down | Reorder batting order | `move(i, delta)` | XI order mutates | Store persists active save | Edge buttons disabled | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Transfers | Transfer tabs / filters / sort chips | Change transfer view | Local `setTab`, `setFilterRole`, `setSortField` | UI only | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Transfers | Player row | Open player profile | `navigation.navigate('PlayerProfile', { playerId })` | None | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Transfers | Scout | Reveal player info for fee | `onScout(p.id)` | Budget/scouted state mutates | Store persists active save | Disabled by funds/window rules | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Transfers | Sign / Confirm counter / Withdraw | Sign player or resolve bid | `onSign`, `onCounter`, `onWalk` | Transfer/budget/squad/market state mutates atomically | Store persists active save | Budget/window/duplicate guards | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Transfers | Loan / Contract / Recall / Release | Manage squad movement/contracts | Handlers in screen/store | Contract/squad state mutates | Store persists active save | Disabled when invalid or closed | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Club Office | Wage Ledger | Open wage ledger | `navigation.navigate('WageBreakdown')` | None | n/a | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Club Office | Emergency Funds | Purchase budget deal | `purchaseDeal(...)` | Budget may update | Store persists result | Loading/alert states | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Club Office | Staff invest | Improve staff role | `doInvest(s.role)` | Staff rating/budget mutates | Store persists active save | Max/insufficient funds block | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Club Office | Facility upgrade | Upgrade facility | `doUpgrade(kind)` | Facility/budget mutates | Store persists active save | Max/insufficient funds block | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Club Office | Renew | Renew expiring contract | `doRenew(p.id)` | Contract/budget mutates | Store persists active save | Insufficient funds/invalid player block | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Club Office | Youth Academy | Open academy | `navigation.navigate('Academy')` | None on open | Target screen owns mutations | n/a | FIXED IN SOURCE, AUTOMATED TESTS PASS |
| Wage Ledger | Renew | Renew player contract | `onRenew(p)` | Contract/budget mutates | Store persists active save | Disabled/hidden when not renewable | FIXED IN SOURCE, AUTOMATED TESTS PASS |
