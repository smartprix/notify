const {Connect} = require('sm-utils');

const {getLogger} = require('./helpers');

class Notify {
	static bold(txt) {
		return `*${txt}*`;
	}

	static italics(txt) {
		return `_${txt}_`;
	}

	static pre(txt) {
		return `\`${txt}\``;
	}

	static strikethrough(txt) {
		return `~${txt}~`;
	}

	/**
	 * Format function for message building, default formatting is Bold
	 * @param {string} txt
	 * @param {object} [param1={bold: true}] If no options object is provided then bold is set as true
	 * @param {boolean} [param1.bold=false]
	 * @param {boolean} [param1.pre=false]
	 * @param {boolean} [param1.code=false]
	 * @param {boolean} [param1.italics=false]
	 * @param {boolean} [param1.strikethrough=false]
	 * @returns {string} formatted txt
	 */
	static format(txt, {
		code = false,
		pre = false,
		bold = false,
		italics = false,
		strikethrough = false,
	} = {bold: true}
	) {
		if (pre || code) txt = this.pre(txt);
		if (bold) txt = this.bold(txt);
		if (italics) this.italics(txt);
		if (strikethrough) this.strikethrough(txt);
		return txt;
	}

	static async _postMessage(url, message) {
		try {
			const res = await Connect
				.url(url)
				.contentType('application/json')
				.body(message)
				.post();

			const body = res.body;
			if (res.statusCode !== 200) {
				getLogger().error(message, res.statusCode, body);
			}

			const parsedBody = JSON.parse(body);
			if (parsedBody.error) {
				getLogger().error(message, parsedBody);
			}
		}
		catch (err) {
			getLogger().error(message, err.statusCode, err.body, err.message);
		}
	}
}

module.exports = Notify;
