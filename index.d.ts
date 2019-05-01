declare module '@smpx/slack' {
	/**
	 * Taken from @slack/client
	 */
	interface MessageAttachment {
		fallback?: string;
		color?: 'good' | 'warning' | 'danger' | string;
		pretext?: string;
		author_name?: string;
		author_link?: string;
		author_icon?: string;
		title?: string;
		title_link?: string;
		text?: string;
		fields?: {
			title: string;
			value: string;
			short?: boolean;
		}[];
		image_url?: string;
		thumb_url?: string;
		footer?: string;
		footer_icon?: string;
		ts?: number;
		actions?: AttachmentAction[];
		callback_id?: string;
		mrkdwn_in?: ('pretext' | 'text' | 'fields')[];
	}
	interface AttachmentAction {
		id?: string;
		confirm?: Confirmation;
		data_source?: string;
		min_query_length?: number;
		name?: string;
		options?: OptionField[];
		option_groups?: {
			text: string;
			options: OptionField[];
		}[];
		selected_options?: OptionField[];
		style?: string;
		text: string;
		type: string;
		value?: string;
		url?: string;
	}
	interface OptionField {
		description?: string;
		text: string;
		value: string;
	}
	interface Confirmation {
		dismiss_text?: string;
		ok_text?: string;
		text: string;
		title?: string;
	}
	class Slack {
		/**
		 * Overwrite this function to skip slack message sending in some cnditions
		 * and log the message instead. By default skips in test environment
		 */
		static logCondition: () => boolean;
		/**
		 * Username to send message with, default: 'slackbot'
		 */
		static username: string;

		constructor(init?: {text?: string, channel?: string})
		text(text: string): this;
		channel(channelName: string): this;
		attachment(attachments: MessageAttachment | MessageAttachment[]): this;
		/**
		 * Add an attachment with stats as fields
		 */
		stats(
			title: string,
			statsKeyValue: {[statTitle: string]: string | number | boolean | object},
			extraProps?: Partial<MessageAttachment>
		): this;
		/**
		 * Add an error as an attachement to the slack message
		 * Also automatically adds a button to create issue on  github
		 * if a `bugs.url` property exists in package.json
		 */
		error(err: Error, opts?: {label?: string, title?: string}): this;
		/**
		 * @param linkOrEmoji Url of image to use as icon or string for emoji
		 */
		icon(linkOrEmoji: string): this;
		button(text: string, url: string, opts?: {style?: string}): this;
		send(opts?: {defaultAttachment?: boolean, extraProps?: object}): Promise<void>;

		static postMessage(text: string, opts?: {
			channel?: string;
			attachments?: MessageAttachment[],
			/**
			 * Will overwrite properties, use carefully
			 */
			extraProps?: object,
			/**
			 * default true
			 */
			defaultAttachment?: boolean,
		}): Promise<void>;

		/**
		 * Format function for message building, default formatting is Bold
		 * @param text
		 * @param opts If no options object is provided then bold is set as true
		 * @returns formatted txt
		 */
		static format(text: string, opts?: {
			code?: boolean;
			bold?: boolean;
			italics?: boolean;
			strikethrough?: boolean;
		}): string;

		static formatUrl(url: string, text: string): string;
		/**
		 * Webhook is given priority over legacy tokens
		 * @param webhook
		 */
		static setWebhook(webhook: string);
		static setToken(token: string);
	}

	export default Slack;

	export {
		MessageAttachment,
		AttachmentAction,
	};
}

