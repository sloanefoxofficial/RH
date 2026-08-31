# Plan progress reset fix

Replace `App.jsx` and `images.js` with the supplied files, then deploy the whole project.

A newly constructed plan now starts with an empty progress object both locally and in the account’s `member_data` record. The Start over action also clears the local progress cache and updates the signed-in account record with `progress: {}` along with the cleared plan and profile data.

To retest, complete a few tasks on an existing plan, use Start over and confirm the plan is cleared, then create a new plan. Its progress should begin at zero.
