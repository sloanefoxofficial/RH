# Personalised 8-week plan engagement update

Replace `App.jsx` and `images.js` in the existing project, then deploy the full project.

The original Carlos-generated weekly tasks remain intact. The plan page now adds a small optional weekly activity layer based on the person’s setup answers: areas of difficulty, coping preferences, support level, sleep, energy, mood, pace, and stated goal. Gentle or low-energy answers receive one small optional extra; steady/challenge-oriented answers can receive two. Optional extras can be ticked off and are included in the overall progress count.

The update also passes the stored onboarding answers into the plan page and correctly decodes the app’s numeric single-choice answers, so the adaptive logic responds to the actual selected labels. Existing plan completion, week navigation, journal access, plan review, and back-navigation behaviour are preserved.
