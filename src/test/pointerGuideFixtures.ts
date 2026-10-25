// Synthetic multi-step chapters for the generic pointer/scroll engine tests.
// Creation now uses one inline overview; these are not production guide copy.
export const POINTER_GUIDE_FIXTURES = {
  'player.identity': [
    {
      target: 'name',
      title: 'Make this your player',
      body: 'Enter at least two characters for your player name, then tap Next in this guide.',
      required: true,
    },
    {
      target: 'country',
      title: 'Choose your cricket country',
      body: 'This chooses your cricket pathway and clubs. It is not your residence or age-eligibility declaration.',
      required: true,
    },
    {
      target: 'gender',
      title: 'Choose your player’s gender',
      body: 'Choose Male or Female. Your career’s teammates and opponents will use the matching player identities.',
      required: true,
    },
    {
      target: 'skin-tone',
      title: 'Choose your skin tone',
      body: 'Tap a colour swatch to show portraits in that skin tone range. Then choose the face you prefer in the next step.',
      required: true,
    },
    {
      target: 'portrait',
      title: 'Choose your look',
      body: 'Scroll within the highlighted portraits and choose your face. You can change your portrait and kit later through Customise player on Home.',
      required: true,
    },
    {
      target: 'role',
      title: 'Choose your role',
      body: 'Batter, Bowler, All-Rounder or Wicket-Keeper changes which skills you allocate. Pick the role you want to play.',
      required: true,
    },
    {
      target: 'styles',
      title: 'Choose your cricket identity and styles',
      body: 'Review your career identity and batting hand. Bowlers and All-Rounders also choose a bowling hand and style. Scroll within these choices; you may keep the defaults.',
    },
    {
      target: 'creation-next',
      title: 'Ready to build your skills?',
      body: 'Your identity choices are ready. Continue to allocate your starting attributes.',
      action: 'player-creation-next',
    },
  ],
  'player.attributes': [
    {
      target: 'starting-level',
      title: 'Choose your starting pathway',
      body: 'Review the starting level before assigning points. You can keep the selected option or choose another pathway.',
    },
    {
      target: 'creation-difficulty',
      title: 'Choose your challenge',
      body: 'Choose a difficulty for this career. You can keep Normal; this does not spend any starting points.',
    },
    {
      target: 'attribute-budget',
      title: 'Your starting points and rating',
      body: 'Points left is your starting allocation budget. The Grade A rating updates as you change skills. Next we will show the actual + button.',
    },
    {
      target: 'attribute-plus',
      title: 'Build the skills you want',
      body: 'Tap this + to improve the highlighted attribute using your starting points. You choose where the points go; this does not spend Coins or Gems.',
      action: 'attribute-increased',
    },
    {
      target: 'attribute-controls',
      title: 'Shape the rest of your skills',
      body: 'Use + and − on any of these skills. Scroll within this list to reach the other attributes; the points left update above it. You can continue without spending every point.',
    },
    {
      target: 'creation-next',
      title: 'Ready for your club?',
      body: 'Allocate the skills you prefer, then continue. Nothing is auto-allocated and your career has not started yet.',
      action: 'player-creation-next',
    },
  ],
  'player.club': [
    {
      target: 'clubs',
      title: 'Choose your future club',
      body: 'Pick the Tier 3 club you want to build towards. Your player begins in Grade A cricket; senior selection is earned.',
      action: 'player-club',
    },
    {
      target: 'creation-next',
      title: 'Review before starting',
      body: 'Continue to review your name, appearance, role, skills and club. Back lets you change any creation choice.',
      action: 'player-creation-next',
    },
  ],
  'player.review': [
    {
      target: 'review',
      title: 'Your player, your choices',
      body: 'Check your setup. Use Back to customise anything before creating the save.',
    },
    {
      target: 'creation-next',
      title: 'Begin your career',
      body: 'Start Career saves your player and opens Home. We will show you training and your next cricket step there.',
      action: 'player-created',
    },
  ],
  'manager.creation': [
    {
      target: 'difficulty',
      title: 'Choose your challenge',
      body: 'Pick a difficulty before starting. Normal is neutral; higher difficulties give the opposition a stronger challenge.',
    },
    {
      target: 'country',
      title: 'Choose where to manage',
      body: 'Choose the cricket country for your domestic club. This does not change your residence or account eligibility.',
      required: true,
    },
    {
      target: 'clubs',
      title: 'Choose your club',
      body: 'Select a Tier 3 club. Your squad, fixtures and club facilities belong to this club.',
      required: true,
    },
    {
      target: 'create-manager',
      title: 'Take charge',
      body: 'Start Managing saves your career and opens your manager desk. You will prepare the team before playing.',
      action: 'manager-created',
    },
  ],
};
