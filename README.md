<a href="https://www.npmjs.com/package/@smpx/slack"><img src="https://img.shields.io/npm/v/@smpx/slack.svg" alt="Version"></a>
<a href="https://www.npmjs.com/package/@smpx/slack"><img src="https://img.shields.io/npm/dm/@smpx/slack.svg" alt="Downloads"></a>
<a href="https://www.npmjs.com/package/@smpx/slack"><img src="https://img.shields.io/npm/l/@smpx/slack.svg" alt="License"></a>
<a href="https://david-dm.org/smartprix/slack-utils"><img src="https://david-dm.org/smartprix/slack-utils/status.svg" alt="Dependencies"></a>
<a href="https://david-dm.org/smartprix/slack-utils?type=dev"><img src="https://david-dm.org/smartprix/slack-utils/dev-status.svg" alt="Dev Dependencies"></a>

# Slack-Utils

It is a set of utility functions for sending messages to Slack

Works both with legacy tokens and incoming webhooks.

Use a `config.js` file to set token/webhook or use the static functions in the class to set them before sending a message.

Priority is given to webhook if available else token is used.