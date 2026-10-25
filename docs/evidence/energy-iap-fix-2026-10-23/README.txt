ENERGY / IAP FIX VERIFICATION — 23 OCTOBER 2026
=============================================
User approved implementation and testing of+8rewarded energy,3minutes per point,
correct free36/VIP60capacity and a tappable recovery popup, plus an IAP audit.
Reports: docs/ENERGY_IAP_FIX_2026-10-23.txt and docs/how-to/.
Generated full check output is recorded here as jest-full.log.
No live store checkout, charge, native ad fill, account deletion, production
build/install or provider-console change is implied by automated checks.
The old android-energy-review-2026-10-23/reproduce-energy.test.ts characterizes
pre-fix defects and is historical, excluded from the normal suite. Its incorrect
value expectations intentionally do not apply to the fixed source. Permanent
acceptance coverage is under src/**/__tests__/ (energyRecovery, careerEnergy,
rewardedEnergy, useEnergyClock, energyRecoveryModal, VIP and commerce suites).
