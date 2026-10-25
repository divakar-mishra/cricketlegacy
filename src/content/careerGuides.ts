import type { GuideStep } from '../game/coachGuide';

export const CAREER_GUIDES = {
  'player.match.setup': [
    {
      target: 'match-conditions',
      title: 'Read the ground',
      body: 'Pitch and weather affect the contest. This is a real career fixture, not a scripted demo; results count normally.',
    },
    {
      target: 'match-toss',
      title: 'The toss and your role',
      body: 'Call the toss if you are allowed. The winning captain chooses batting or bowling first. Your chosen role does not make you captain.',
    },
    {
      target: 'match-play',
      title: 'Choose how to play',
      body: 'Watch ball-by-ball gives you personal batting and bowling choices when you are involved. Key moments and Instant sim automate play. A short chase can end before everyone bowls.',
    },
  ],
  'manager.match.setup': [
    {
      target: 'match-conditions',
      title: 'Plan for the conditions',
      body: 'Check the pitch and weather before choosing your approach. Real fixtures have genuine results; this guide does not force a win.',
    },
    {
      target: 'match-toss',
      title: 'Your captaincy choice',
      body: 'Call the toss where available, then choose batting or bowling if you win. Review and confirm your match preparation before continuing.',
    },
    {
      target: 'match-play',
      title: 'Choose your match view',
      body: 'Watch ball-by-ball lets you adjust tactics live. Key moments and Instant sim automate play through the same match authority.',
    },
  ],
  'player.match.batting': [
    {
      target: 'batting-approach',
      title: 'Your turn to bat',
      body: 'Open your batting approach. Defend, Balanced and Attack change intent and risk; no choice guarantees runs.',
      action: 'batting-approach-opened',
    },
    {
      target: 'live-score',
      title: 'Read the match',
      body: 'Use the score, wickets, overs and chase requirement to judge your approach. Finish the guide to resume play; you can change your approach later.',
    },
  ],
  'player.match.bowling': [
    {
      target: 'bowling-plan',
      title: 'Your over',
      body: 'Choose your bowling plan from the highlighted options. The descriptions explain their intent. Your choice applies to your actual spell, not a guaranteed wicket.',
      action: 'bowling-plan-chosen',
    },
  ],
  'manager.match.live': [
    {
      target: 'manager-tactics',
      title: 'Manage the contest',
      body: 'Open Tactics to change the team approach, bowling plan and field. Match conditions and actual player ability still matter.',
      action: 'manager-tactics-opened',
    },
    {
      target: 'live-score',
      title: 'Judge the situation',
      body: 'Watch the score, wickets and run rate. Finish the guide, close Tactics when ready, and adapt your plan as the match develops.',
    },
  ],
  'common.menu': [
    {
      target: 'new-career',
      title: 'Your cricket story',
      body: 'Open New Game to create your own player or take charge of a club. Existing careers stay in Continue and Saved Games.',
      action: 'new-career',
    },
  ],
  'common.mode': [
    {
      target: 'player-mode',
      title: 'Play as a cricketer',
      body: 'Player Career follows your own cricketer: create your player, develop their skills and earn selection.',
    },
    {
      target: 'manager-mode',
      title: 'Manage a club',
      body: 'Manager Career puts you in charge of the XI, tactics, training and club. Choose either career when you are ready.',
    },
  ],
  'player.identity': [
    {
      target: 'identity-basics',
      title: 'Name and cricket country',
      body: 'Enter at least two characters for your name and choose your cricket country. This sets your cricket pathway, not your residence or age eligibility.',
      required: true,
    },
    {
      target: 'appearance',
      title: 'Make the player yours',
      body: 'Choose gender, a skin tone and a portrait. Scroll within this section to see the faces. Teammates and opponents match your chosen gender; your look stays customisable on Home.',
      required: true,
    },
    {
      target: 'role-and-styles',
      title: 'Choose how you play',
      body: 'Choose your role, then scroll through career identity, optional Ironman and batting/bowling styles. Defaults are fine for these extra options. Finish this guide, then use Next to build your skills.',
      required: true,
    },
  ],
  'player.attributes': [
    {
      target: 'attribute-setup',
      title: 'Set your starting skills',
      body: 'Review pathway, difficulty, Points left and Active Grade A OVR. Use + / − on your role’s skills; starting points cost no Coins or Gems. You can leave points unspent. Close this popup, customise, then tap Next.',
    },
  ],
  'player.club': [
    {
      target: 'clubs',
      title: 'Choose your future club',
      body: 'Compare the Tier 3 clubs and select one. You start in Grade A cricket and work towards senior selection. Next opens your final review; Back lets you change your skills.',
      required: true,
    },
  ],
  'player.review': [
    {
      target: 'review',
      title: 'Ready to start?',
      body: 'Check your name, country, appearance, role, styles, skills, difficulty and club. Back changes your choices; Start Career creates and saves your career, then opens Home.',
    },
  ],
  'manager.creation': [
    {
      target: 'difficulty',
      title: 'Take charge of a club',
      body: 'Set difficulty, choose a country, then compare and select a Tier 3 club. Changing country clears the club choice. Start Managing saves your squad, fixtures and facilities, then opens Home.',
    },
  ],
  'player.home': [
    {
      target: 'customise',
      title: 'Your player stays customisable',
      body: 'Open Customise player to change your portrait, shirt and owned cosmetics. Role and starting attributes were chosen during creation; training develops your skills now.',
    },
    {
      target: 'wallet',
      title: 'Know your resources',
      body: 'Coins, Gems and Energy have separate uses. Tap Energy to see recovery time and optional recovery choices; an ad is never compulsory.',
    },
    {
      target: 'tab-stats',
      title: 'Your statistics',
      body: 'Stats shows your performances. Open it whenever you want to inspect your cricket record; return through Home.',
    },
    {
      target: 'tab-progress',
      title: 'Your career pathway',
      body: 'Progress shows your pathway and milestones. Selection and promotion depend on actual performances, not completing this guide.',
    },
    {
      target: 'tab-profile',
      title: 'More of your career',
      body: 'More contains your profile, Player Life, records, settings and other destinations, including the optional Store.',
    },
    {
      target: 'next-step',
      title: 'Follow your cricket chapter',
      body: 'This card tells you the next eligible step: a fixture, selection meeting, recovery or another career event. It changes with your actual career.',
    },
    {
      target: 'training',
      title: 'Visit the training ground',
      body: 'Open Training to learn how sessions develop your attributes. We will show the costs before you decide whether to train.',
      action: 'open-player-training',
    },
  ],
  'manager.home': [
    {
      target: 'next-step',
      title: 'Your manager desk',
      body: 'Continue follows your actual calendar: preparation, fixtures and season events. Check the current chapter before advancing.',
    },
    {
      target: 'tab-team',
      title: 'Your squad and XI',
      body: 'Team opens your squad. Review players, selection and batting order before a fixture.',
    },
    {
      target: 'tab-club',
      title: 'Run your club',
      body: 'Club opens your office, facilities, staff and club finances. Club Balance is separate from personal Wallet Coins.',
    },
    {
      target: 'tab-academy',
      title: 'Develop future players',
      body: 'Academy opens the club youth system. Review its options and requirements before making an investment.',
    },
    {
      target: 'tab-records',
      title: 'Review the competition',
      body: 'Records holds competition results and records. These update from completed fixtures, not guide steps.',
    },
    {
      target: 'tab-store',
      title: 'Optional purchases',
      body: 'Store contains optional purchases. Coaching does not require a purchase and will never check out for you.',
    },
    {
      target: 'manager-actions',
      title: 'Prepare your team',
      body: 'Use Team Sheet to review the XI and batting order, and Tactics for your match plan. Transfers and scouting help you recruit.',
    },
    {
      target: 'training',
      title: 'Set the training plan',
      body: 'Open Training to choose the squad focus and workload. Manager training happens automatically after fixtures, not by buying Player training sessions.',
      action: 'open-manager-training',
    },
  ],
  'player.training': [
    {
      target: 'training-sessions',
      title: 'Your seasonal sessions',
      body: 'Sessions are limited per season, with limits for each training focus too. The screen shows what you have left. Valid sessions cost Coins.',
    },
    {
      target: 'training-focus',
      title: 'Train skills for your role',
      body: 'Each session develops the attributes listed on its card. Compare the options before choosing; you do not need to train just to finish this guide.',
    },
    {
      target: 'training-cost',
      title: 'Check the cost first',
      body: 'Read the Coins cost and remaining sessions. An unavailable session explains its restriction. The guide will never press Train or spend resources for you.',
    },
    {
      target: 'training-button',
      title: 'Your choice to train',
      body: 'Tap Train only if you want this session. A successful session shows the actual attribute gains and OVR progress. You can finish this guide without buying or training.',
    },
    {
      target: 'development',
      title: 'Your support team',
      body: 'Development Centre contains personal coaches, equipment and other support. Hiring is optional; return to Home whenever you are ready.',
    },
  ],
  'manager.training': [
    {
      target: 'training-focus',
      title: 'Choose a squad focus',
      body: 'Choose Batting, Bowling, Fielding, Fitness, Balanced or Recovery. Recovery restores condition without attribute growth.',
      action: 'manager-training-focus',
    },
    {
      target: 'training-workload',
      title: 'Balance work and recovery',
      body: 'Light favours recovery; Normal balances workload; High develops faster with more fatigue risk. Recovery does not need a workload setting.',
    },
    {
      target: 'training-save',
      title: 'Save only if you want to change it',
      body: 'Save applies a changed plan. If Plan Saved is disabled, your selected plan is already active. There is no training purchase or immediate stat grant.',
    },
    {
      target: 'training-overrides',
      title: 'Individual player needs',
      body: 'Player overrides let you give one squad member a different focus. Otherwise they follow the team plan. Development settles after actual fixtures.',
    },
  ],
} as const satisfies Record<string, readonly GuideStep[]>;
export type GuideChapter = keyof typeof CAREER_GUIDES;
