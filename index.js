const os = require('os');
const {cfg, Connect} = require('sm-utils');
const startCase = require('lodash.startcase');

/**
 * @typedef {import('@smpx/notify').MessageAttachment} attach
 * @typedef {import('@smpx/notify').AttachmentAction} action
 */

let packageObj;
function getPackageInfo() {
	if (packageObj) return packageObj;
	try {
		packageObj = require(`${process.cwd()}/package.json`);
	}
	catch(err) {
		packageObj = {name: 'Unknown', version: '0.0.0'};
	}
	return packageObj;
}

/** @type {Console} */
let logger;
function getLogger() {
	if (logger) return logger;
	try {
		// Try using oak
		// @ts-ignore
		const {Oak} = require('@smpx/oak');
		logger = new Oak('Slack');
	}
	catch (err) {
		logger = console;
	}
	return logger;
}

function getSlackConf() {
	return cfg('slack', {
		token: '',
		webhook: '',
		channel: '',
	});
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

class Slack {
	/**
	 * Overwrite this function to skip slack message sending in some cnditions
	 * and log the message instead. By default skips in test environment
	 */
	static logCondition() {
		return cfg.isTest();
	}
	/**
	 * Username to send message with, default: 'slackbot'
	 */
	static get username() {
		return 'slackbot';
	}

	constructor({text = '', channel = ''} = {}) {
		/** @type {attach[]} */
		this._attachments = [];
		this._errors = [];
		/** @type {action[]} */
		this._actions = [];
		this._extraProps = {};

		if (channel) this.channel(channel);
		if (text) this.text(text);
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

	/**
	 * @param {attach | attach[]} attachments
	 */
	attachment(attachments) {
		if (!Array.isArray(attachments)) attachments = [attachments];
		this._attachments = this._attachments.concat(attachments);
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
	 * @private
	 * @param {object} message
	 */
	static async _postWithToken(message) {
		let res;
		try {
			const connect = Connect
				.url('https://slack.com/api/chat.postMessage')
				.fields(message)
				.field('token', getSlackConf().token)
				.post();

			res = await connect.fetch();

			const parsedBody = JSON.parse(res.body);
			if (parsedBody.error) {
				getLogger().error(message, parsedBody);
			}
		}
		catch (err) {
			getLogger().error(message, res && res.body, err);
		}
	}

	static async _postWithWebhook(message) {
		let res;
		try {
			const connect = Connect
				.url(getSlackConf().webhook)
				.fields(message)
				.post();

			res = await connect.fetch();

			const parsedBody = JSON.parse(res.body);
			if (parsedBody.error) {
				getLogger().error(message, parsedBody);
			}
		}
		catch (err) {
			getLogger().error(message, res && res.body, err);
		}
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
			attachments: JSON.stringify(finalAttachments),
		}, extraProps);

		if (this.logCondition()) {
			getLogger().info({label: 'Slack', ...message}, 'Slack message');
			return;
		}

		if (getSlackConf().webhook) return this._postWithWebhook(message);
		return this._postWithToken(message);
	}

	/**
	 * Format function for message building, default formatting is Bold
	 * @param {string} txt
	 * @param {object} [param1={bold: true}] If no options object is provided then bold is set as true
	 * @param {boolean} [param1.bold=false]
	 * @param {boolean} [param1.code=false]
	 * @param {boolean} [param1.italics=false]
	 * @param {boolean} [param1.strikethrough=false]
	 * @returns {string} formatted txt
	 */
	static format(txt, {
		code = false,
		bold = false,
		italics = false,
		strikethrough = false,
	} = {bold: true}
	) {
		if (code) txt = `\`${txt}\``;
		if (bold) txt = `*${txt}*`;
		if (italics) txt = `_${txt}_`;
		if (strikethrough) txt = `~${txt}~`;
		return txt;
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
