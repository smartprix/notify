const os = require('os');
const {cfg, Connect} = require('sm-utils');
const startCase = require('lodash.startcase');

const DEFAULT_CHANNEL = 'default';
const DEFAULT_WEBHOOK_NAME = 'default';

/**
 * @typedef {import('@smpx/notify').TeamsTypes.Section} Section
 * @typedef {import('@smpx/notify').TeamsTypes.Action} Action
 * @typedef {import('@smpx/notify').TeamsTypes.MessageCard} MessageCard
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

/** 
 * @param {string} channel `<channelName>[.<webhookName>]`
 * @returns {string}
 */
function getTeamsWebhookUrl(channel) {
	if (!channel) return null;

	if (!channel.includes('.')) channel += `.${DEFAULT_WEBHOOK_NAME}`;
	// @ts-ignore
	return cfg(`teams.${channel}`);
}

/**
 * @returns {Section[]}
 */
function getDefaultSections() {
	const {name, version} = getPackageInfo();
	const facts = [
		{
			name: 'Hostname',
			value: os.hostname(),
		},
		{
			name: 'Node Environment',
			value: cfg.getEnv(),
		},
	];

	let footerSuffix = '';
	if (process.env.name || process.env.pm_id) {
		footerSuffix = `| ${process.env.name} ${process.env.pm_id || -1}`
	}

	return [{
		activityTitle: 'App Info:',
		activitySubtitle: `${name} v${version} ${footerSuffix} | ${new Date().toLocaleString()}`,
		facts,
	}];
}

class Teams {
	/**
	 * Overwrite this function to skip teams message sending in some cnditions
	 * and log the message instead. By default skips in test environment
	 */
	static logCondition() {
		return cfg.isTest();
	}

	constructor({text = '', channel = ''} = {}) {
		this._themeColor = '439FE0'; // blue
		/** @type {Section[]} */
		this._sections = [];
		/** @type {Error[]} */
		this._errors = [];
		/** @type {Action[]} */
		this._actions = [];

		if (channel) this.channel(channel);
		if (text) this.text(text);
	}

	/** @param {string} channel */
	static set defaultChannel(channel) {
		this._defaultChannel = channel;
	}

	/** @returns {string} */
	static get defaultChannel() {
		return this._defaultChannel || DEFAULT_CHANNEL;
	}

	/** @param {string} channel */
	channel(channel) {
		this._channel = channel;
		return this;
	}

	/** @param {string} summary */
	summary(summary) {
		this._summary = summary;
		return this;
	}

	/** @param {string} color */
	color(color) {
		this._themeColor = color.replace('#', '');
		return this;
	}

	/** @param {string} title */
	title(title) {
		this._title = title;
		return this;
	}

	/** @param {string} text */
	text(text) {
		this._text = text;
		return this;
	}

	/** @param {Section | Section[]} sections */
	section(sections) {
		if (!Array.isArray(sections)) sections = [sections];
		this._sections = this._sections.concat(sections);
		return this;
	}

	/** @param {Action | Action[]} actions */
	action(actions) {
		if (!Array.isArray(actions)) actions = [actions];
		this._actions = this._actions.concat(actions);
		return this;
	}

	/**
	 * Create a MessageBox
	 * @param {Error} err
	 * @param {{label?: string, title?: string}} [this._textaram1={}]
	 */
	error(err, {label = '', title = ''} = {}) {
		this._errors.push(err);
		const {bugs, version} = getPackageInfo();this._text
		const bugsUrl = bugs && bugs.url;

		this.color('F00'); // Red
		this.title(`Error: ${err.message}`);
		this.text(err.stack.replace(/\n/g, '\\n\\n').replace(/ /g, '&nbsp;'));
		this.action({
			"@type": 'OpenUri',
			name: 'Create an issue for this error?',
			targets: [{
				os: 'default',
				uri: `${bugsUrl}/new?title=${
						encodeURIComponent(`${label}${title || err.message}`)
					}&body=${encodeURIComponent(
						`Error encountered on ${new Date().toLocaleString()}\n` +
						`App version: v${version}\n\n` +
						`Full Stack: ${err.stack}`
					)}&labels=bug`,
			}],
		});
		return this;
	}

	/**
	 * Add an error as a section
	 * @param {Error} err
	 * @param {{label?: string, title?: string}} [param1={}]
	 */
	errorSection(err, {label = '', title = ''} = {}) {
		this._errors.push(err);
		const {bugs, version} = getPackageInfo();
		const bugsUrl = bugs && bugs.url;

		/** @type {Section} */
		const section = {
			startGroup: true,
			activityTitle: `${Teams.format('Error')}: ${err.message}`,
			activityText: err.stack.replace(/\n/g, '\\n\\n').replace(/ /g, '&nbsp;'),
		};

		if (bugsUrl) {
			label = `[${label || err.name}] `;
			section.potentialAction = [{
				"@type": 'OpenUri',
				name: 'Create an issue for this error?',
				targets: [{
					os: 'default',
					uri: `${bugsUrl}/new?title=${
							encodeURIComponent(`${label}${title || err.message}`)
						}&body=${encodeURIComponent(
							`Error encountered on ${new Date().toLocaleString()}\n` +
							`App version: v${version}\n\n` +
							`Full Stack: ${err.stack}`
						)}&labels=bug`,
				}],
			}];
		}
		return this.section(section);
	}

	/**
	 * Add a section with facts
	 * @param {string} title
	 * @param {{[statTitle: string]: string | number | boolean | object}} keyValues
	 * @param {{ignoreUndefined?: boolean}} opts
	 */
	stats(title, keyValues, {ignoreUndefined = true} = {}) {
		/** @type {Section} */
		const section = {
			title,
			facts: [],
		};

		Object.keys(keyValues).forEach((key) => {
			let value = keyValues[key];

			if(ignoreUndefined && value === undefined) return;

			if (['boolean', 'number', 'undefined'].includes(typeof value)) value = String(value);
			else if (typeof value !== 'string') value = String(JSON.stringify(value));
			value = value.trim().replace(/\n/g, '\\n\\n').replace(/ /g, '&nbsp;');

			section.facts.push({
				name: startCase(key.trim()),
				value,
			});
		})

		return this.section(section);
	}

	/**
	 * @param {string} name
	 * @param {string} uri
	 */
	button(name, uri) {
		/** @type {Action} */
		const button = {
			"@type": 'OpenUri',
			name,
			targets: [{
				os: 'default',
				uri,
			}],
		};
		return this.action(button);
	}

	/**
	 * @param {{defaultSection?: boolean}} opts
	 */
	async send({defaultSection = true} = {}) {
		if (!this._summary && !this._text) throw new Error('Either summary or text is required');

		/** @type {MessageCard} */
		const message = {
			summary: this._summary,
			themeColor: this._themeColor,
			title: this._title,
			text: this._text,
			sections: this._sections,
			potentialAction: this._actions,
		}

		return Teams.postMessage(message, {channel: this._channel, defaultSection});
	}

	/** 
	 * @private
	 * @param {string} webhookUrl
	 * @param {MessageCard} message
	 */
	static async _postWithWebhook(webhookUrl, message) {
		/** @type {import('sm-utils').response | undefined} */
		let res;
		try {
			const connect = Connect
				.url(webhookUrl)
				.contentType('application/json')
				.body(message)
				.post();

			res = await connect.fetch();

			const body = res.body;
			if (res.statusCode !== 200) {
				getLogger().error(message, res.statusCode, body);
			}
		}
		catch (err) {
			getLogger().error(message, res && res.statusCode, res && res.body, err);
		}
	}

	/**
	 * @param {MessageCard} message 
	 * @param {object} [opts]
	 * @param {string} [opts.channel]
	 * @param {boolean} [opts.defaultSection=true]
	 */
	static async postMessage(message, {channel, defaultSection = true} = {}) {
		// Do not modify original message;
		message = Object.assign({}, message);

		message.sections = message.sections || [];
		if (defaultSection) message.sections = message.sections.concat(getDefaultSections());

		if (this.logCondition()) {
			getLogger().info({label: 'Teams', ...message}, 'Teams message');
			return;
		}

		channel = channel || Teams.defaultChannel;
		const webhookUrl = getTeamsWebhookUrl(channel);
		if (!webhookUrl) throw new Error(`No webhook url for channel: "${channel}"`)

		return this._postWithWebhook(webhookUrl, message);
	}

	/**
	 * Format function for message building, default formatting is Bold
	 * @param {string} txt
	 * @param {object} [opts={bold: true}] If no options object is provided then bold is set as true
	 * @param {boolean} [opts.bold=false]
	 * @param {boolean} [opts.code=false]
	 * @param {boolean} [opts.italics=false]
	 * @param {boolean} [opts.strikethrough=false]
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
		if (bold) txt = `**${txt}**`;
		if (italics) txt = `*${txt}*`;
		if (strikethrough) txt = `~~${txt}~~`;
		return txt;
	}

	/**
	 * @param {string} url
	 * @param {string} text
	 */
	static formatUrl(url, text) {
		return `[${text}](${url})`;
	}

	/**
	 * @param {string} webhookUrl
	 * @param {string} [channel] default: `Teams.defaultChannel`
	 */
	static setWebhook(webhookUrl, channel = Teams.defaultChannel) {
		if (!channel.includes('.')) channel += `.${DEFAULT_WEBHOOK_NAME}`;
		cfg.set(`teams.${channel}`, webhookUrl);
	}
}

module.exports = Teams;