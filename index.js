const {cfg, Connect} = require('sm-utils');
const os = require('os');

/**
 * @typedef {import('@smpx/slack').MessageAttachment} attach
 */

let packageObj;
function getPackageInfo() {
	if (packageObj) return packageObj;
	try {
		packageObj = require(`${process.cwd()}/package.json`);
	}
	catch(err) {
		packageObj = {name: 'Unknown'};
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
			title: 'Hostname:',
			value: os.hostname(),
			short: true,
		},
		{
			title: 'App: ',
			value: `${name} v${version}`,
			short: true,
		},
		{
			title: 'Node Environment',
			value: cfg.getEnv(),
			short: true,
		},
	];

	if (process.env.name || process.env.pm_id) {
		fields.push({
			title: 'PM2 App',
			value: `${process.env.name} ${process.env.pm_id || -1}`,
			short: true,
		});
	}

	return [{
		fields,
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
	 * @param {Error} err
	 * @param {{label?: string}} [param1={}]
	 */
	error(err, {label = ''} = {}) {
		this._errors.push(err);
		const {bugs} = getPackageInfo();
		const bugsUrl = bugs && bugs.url;

		/** @type {attach} */
		const attachment = {
			pretext: `${Slack.format('Error')}: ${err.message}`,
			text: err.stack,
			color: 'danger',
		};

		if (bugsUrl) {
			label = label ? `[${label}] ` : '';
			attachment.actions = [{
				type: 'button',
				text: 'Create an issue for this error?',
				url: `${bugsUrl}/new?title=${
					encodeURIComponent(`${label}${err.message}`)
				}&body=${
					encodeURIComponent(`Error was: ${err.stack}`)
				}&labels=bug`,
			}];
		}

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

	async send() {
		return Slack
			.postMessage(this._text, {
				channel: this._channel,
				attachments: this._attachments,
				extraProps: this._extraProps,
			});
	}

	/**
	 * @private
	 * @param {object} message 
	 */
	static async _postWithToken(message) {
		try {
			const connect = Connect
				.url('https://slack.com/api/chat.postMessage')
				.fields(message)
				.field('token', getSlackConf().token)
				.post();

			const res = await connect.fetch();

			const parsedBody = JSON.parse(res.body);
			if (parsedBody.error) {
				getLogger().error(message, parsedBody);
			}
		}
		catch (err) {
			getLogger().error(message, err);
		}
	}

	static async _postWithWebhook(message) {
		try {
			const connect = Connect
				.url(getSlackConf().webhook)
				.fields(message)
				.post();

			const res = await connect.fetch();
			const parsedBody = JSON.parse(res.body);
			if (parsedBody.error) {
				getLogger().error(message, parsedBody);
			}
		}
		catch (err) {
			getLogger().error(message, err);
		}
	}

	/**
	 * Send slack message to one of smartprix's channels
	 * @param {string} text
	 * @param {object} [param1={}]
	 * @param {string} [param1.channel] Default value is taken from config
	 * @param {attach[]} [param1.attachments=[]] Attachments to send
	 * @param {object} [param1.extraProps={}]
	 */
	static async postMessage(text, {
		channel = getSlackConf().channel,
		attachments = [],
		extraProps = {},
	} = {}) {
		const finalAttachments = attachments.concat(getDefaultAttachments());
		const message = Object.assign(extraProps, {
			text,
			channel,
			username: this.username,
			attachments: JSON.stringify(finalAttachments),
		});

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
