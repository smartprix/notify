const os = require('os');
const {cfg, Connect} = require('sm-utils');
const startCase = require('lodash/startCase');

const Notify = require('./Notify');
const {getPackageInfo, getLogger} = require('./helpers');

/**
 * @typedef {import('@smpx/notify').MessageAttachment} attach
 * @typedef {import('@smpx/notify').AttachmentAction} action
 */

const defaultConfig = {
	token: '',
	webhook: '',
	channel: '#general',
	username: 'slackbot',
};

function getSlackConf() {
	return cfg('slack') || defaultConfig;
}

/**
 * @returns {attach[]}
 */
function getDefaultAttachments() {
	const {name, version} = getPackageInfo();
	const fields = [
		{
			title: 'Hostname',
			value: os.hostname(),
			short: true,
		},
		{
			title: 'Node Environment',
			value: cfg.getEnv(),
			short: true,
		},
	];

	let footerSuffix = '';
	if (process.env.name || process.env.pm_id) {
		footerSuffix = `| ${process.env.name} ${process.env.pm_id || -1}`
	}

	return [{
		title: 'App Info:',
		fields,
		footer: `${name} v${version} ${footerSuffix}`,
		ts: Date.now() / 1000,
	}];
}

class Slack extends Notify {
	/**
	 * Overwrite this function to skip slack message sending in some conditions
	 * and log the message instead. By default skips in test environment
	 */
	static logCondition() {
		return cfg.isTest();
	}

	/**
	 * Username to send message with, default: 'slackbot'
	 */
	static get username() {
		return this._username || getSlackConf().username || 'slackbot';
	}

	/** @param {string} username */
	static set username(username) {
		this._username = username;
	}

	/** @param {{text?: string, channel?: string}} opts */
	constructor({text, channel} = {}) {
		super();

		/** @type {attach[]} */
		this._attachments = [];
		/** @type {Error[]} */
		this._errors = [];
		/** @type {action[]} */
		this._actions = [];
		this._extraProps = {};

		if (channel) this.channel(channel);
		if (text) this.text(text);
	}

	/** [Dummy] Slack does not support color */
	color() { return this }
	/** [Dummy] Slack does not support title */
	title() { return this }

	/**
	 * Sets fallback for the first attachment
	 * @param {string} fallback
	 */
	summary(fallback) {
		if (this._attachments.length) this._attachments[0].fallback = fallback;
		return this;
	}

	/** @param {string} text */
	text(text) {
		this._text = text;
		return this;
	}

	channel(channelName) {
		this._channel = channelName;
		return this;
	}

	username(name) {
		this._extraProps.username = name;
		return this;
	}

	/**
	 * @param {attach | attach[]} attachments
	 */
	attachment(attachments) {
		if (!Array.isArray(attachments)) attachments = [attachments];
		this._attachments = this._attachments.concat(attachments);
		return this;
	}

	/** @param {action | action[]} actions */
	action(actions) {
		if (!Array.isArray(actions)) actions = [actions];
		this._actions = this._actions.concat(actions);
		return this;
	}

	/**
	 * Add an error as an attachement to the slack message
	 * @param {Error} err
	 * @param {{label?: string, title?: string}} [param1={}]
	 */
	error(err, {label = '', title = ''} = {}) {
		this._errors.push(err);
		const {bugs, version} = getPackageInfo();
		const bugsUrl = bugs && bugs.url;

		/** @type {attach} */
		const attachment = {
			pretext: Slack.escapeText(`${Slack.format('Error')}: ${err.message}`),
			text: Slack.escapeText(err.stack),
			color: 'danger',
		};

		attachment.fallback = attachment.pretext;

		if (bugsUrl) {
			label = `[${label || err.name}] `;
			attachment.actions = [{
				type: 'button',
				text: 'Create an issue for this error?',
				style: 'danger',
				url: `${bugsUrl}/new?title=${
						encodeURIComponent(`${label}${title || err.message}`)
					}&body=${encodeURIComponent(
						`Error encountered on ${new Date().toLocaleString()}\n` +
						`App version: v${version}\n\n` +
						`Full Stack: ${err.stack}`
					)}&labels=bug`,
			}];
		}
		return this.attachment(attachment);
	}

	/**
	 * Add an attachment with stats as fields
	 * @param {string} title
	 * @param {{[key: string]: string}} keyValues
	 * @param {{extraProps?: Partial<attach>, ignoreUndefined?: boolean}} opts
	 */
	stats(title, keyValues, {extraProps = {}, ignoreUndefined = true} = {}) {
		/** @type {attach} */
		const attachment = Object.assign({
			color: '#439FE0', // blue
			fallback: title,
			title,
			fields: [],
		}, extraProps);

		Object.keys(keyValues).forEach((key) => {
			let value = keyValues[key];

			if(ignoreUndefined && value === undefined) return;

			if (['boolean', 'number', 'undefined'].includes(typeof value)) value = String(value);
			else if (typeof value !== 'string') value = String(JSON.stringify(value));
			value = value.trim();

			attachment.fields.push({
				title: startCase(key.trim()),
				value,
				short: value.length <= 30 && key.length <= 30,
			})
		})

		return this.attachment(attachment);
	}

	/**
	 * @param {string} linkOrEmoji Url of image to use as icon or string for emoji
	 */
	icon(linkOrEmoji) {
		if (linkOrEmoji[0] === ':') {
			this._extraProps.icon_emoji = linkOrEmoji;
		}
		else this._extraProps.icon_url = linkOrEmoji;
		return this;
	}

	/**
	 * @param {string} text
	 * @param {string} url
	 * @param {{style?: string}} [param2]
	 */
	button(text, url, {style = ''} = {}) {
		/** @type {action} */
		const button = {
			type: 'button',
			text,
			url,
		};
		if (style) button.style = style;
		this._actions.push(button);
		return this;
	}

	/**
	 *
	 * @param {{defaultAttachment?: boolean, extraProps?: object}} param0
	 */
	async send({defaultAttachment = true, extraProps = {}} = {}) {
		if (this._actions.length) {
			this.attachment({
				title: '',
				actions: this._actions,
			});
		}

		extraProps = Object.assign({}, this._extraProps, extraProps);
		return Slack
			.postMessage(this._text, {
				channel: this._channel,
				attachments: this._attachments,
				extraProps,
				defaultAttachment,
			});
	}

	/**
	 * Send slack message to one of smartprix's channels
	 * @param {string} text
	 * @param {object} [param1={}]
	 * @param {string} [param1.channel] Default value is taken from config
	 * @param {attach[]} [param1.attachments=[]] Attachments to send
	 * @param {object} [param1.extraProps={}] this overwrites any other props
	 * @param {boolean} [param1.defaultAttachment=true] Add default attachement with system info
	 */
	static async postMessage(text, {
		channel = getSlackConf().channel,
		attachments = [],
		extraProps = {},
		defaultAttachment = true,
	} = {}) {
		const finalAttachments = defaultAttachment ?
			attachments.concat(getDefaultAttachments()) : attachments;

		const message = Object.assign({
			text,
			channel,
			username: this.username,
			attachments: finalAttachments,
		}, extraProps);

		if (this.logCondition()) {
			getLogger().info({label: 'Slack', ...message}, 'Slack message');
			return;
		}

		const webhook = getSlackConf().webhook;
		if (webhook) return this._postMessage(webhook, message);

		message.token = getSlackConf().token;
		return this._postMessage('https://slack.com/api/chat.postMessage', message);
	}

	/**
	 * @param {string} url
	 * @param {string} text
	 */
	static formatUrl(url, text) {
		return `<${url}|${text}>`;
	}

	/**
	 * @see https://api.slack.com/docs/message-formatting#how_to_escape_characters
	 * @param {string} text
	 */
	static escapeText(text) {
		return text.replace(/([&<>])/g, (match, g1) => {
			switch(g1) {
				case '<': return '&lt;';
				case '>': return '&gt;';
				case '&': return '&amp;';
				default: return g1;
			}
		});
	}

	/**
	 * @param {string} webhookUrl
	 */
	static setWebhook(webhookUrl) {
		cfg.set('slack.webhook', webhookUrl);
	}

	static setToken(token) {
		cfg.set('slack.token', token);
	}
}

module.exports = Slack;
