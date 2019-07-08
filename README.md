<a href="https://www.npmjs.com/package/@smpx/notify"><img src="https://img.shields.io/npm/v/@smpx/notify.svg" alt="Version"></a>
<a href="https://www.npmjs.com/package/@smpx/notify"><img src="https://img.shields.io/npm/dm/@smpx/notify.svg" alt="Downloads"></a>
<a href="https://www.npmjs.com/package/@smpx/notify"><img src="https://img.shields.io/npm/l/@smpx/notify.svg" alt="License"></a>
<a href="https://david-dm.org/smartprix/notify"><img src="https://david-dm.org/smartprix/notify/status.svg" alt="Dependencies"></a>
<a href="https://david-dm.org/smartprix/notify?type=dev"><img src="https://david-dm.org/smartprix/notify/dev-status.svg" alt="Dev Dependencies"></a>

# Notify

It is a message builder for sending notifications and alerts.

Currently supports slack.


## Slack

Works both with legacy tokens and incoming webhooks.

Use a `config.js` file to set token/webhook or use the static functions in the class to set them before sending a message.

Priority is given to webhook if available else token is used.