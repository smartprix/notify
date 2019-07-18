declare module '@smpx/notify' {
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
		 * By default: ignores undefined values
		 */
		stats(
			title: string,
			statsKeyValue: {[statTitle: string]: string | number | boolean | object},
			opts?: {extraProps?: Partial<MessageAttachment>, ignoreUndefined?: boolean}
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
		username(name: string): this;
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
		static setWebhook(webhook: string): void;
		static setToken(token: string): void;
	}

	namespace TeamsTypes {
		interface Image {
			/** URL of the image */
			image?: string;
			title?: string;
		}

		interface commonInputFields {
			id?: string;
			isRequired?: boolean;
			title?: string;
			value?: string;
		}

		interface TextInput extends commonInputFields {
			"@type": 'TextInput';
			isMultiline?: boolean;
			maxLength?: number;
		}

		interface DateInput extends commonInputFields {
			"@type": 'DateInput';
			includeTime?: boolean;
		}

		interface MultichoiceInput extends commonInputFields {
			"@type": 'MultichoiceInput';
			choices?: Array<{display: string, value: string}>;
			isMultiSelect?: boolean;
			style?: 'normal' | 'expanded';
		}

		/** To use input value `{{<id of input>.value}}` */
		type Input = TextInput | DateInput | MultichoiceInput;


		type OS = 'default' | 'windows' | 'iOS' | 'Android';
		interface OpenUriAction {
			"@type": 'OpenUri';
			name: string;
			targets: Array<{os: OS, uri: string}>;
		}

		interface HttpPOSTAction {
			"@type": 'HttpPOST';
			name: string;
			target: string;
			headers?: Array<{name: string, value: string}>;
			body: string;
			/** default: `application/json` */
			bodyContentType?: string;
		}

		interface ActionCardAction {
			"@type": 'ActionCard';
			name: string;
			inputs: Input[];
			actions: Array<OpenUriAction | HttpPOSTAction>;
		}

		type Action = OpenUriAction | HttpPOSTAction | ActionCardAction;


		interface Section {
			title?: string;
			/** When set to `true`, the `startGroup` property marks the start of a logical group of information. */
			startGroup?: boolean;
			activityImage?: string;
			activityTitle?: string;
			activitySubtitle?: string;
			activityText?: string;
			/** Use `heroImage` to make an image the centerpiece of your card. */
			heroImage?: Image;
			text?: string;
			facts?: Array<{name: string, value: string}>;
			images?: Image[];
			potentialAction?: Action[];
		}

		interface MessageCard {
			summary?: string;
			themeColor?: string;
			title?: string;
			text?: string;
			sections?: Section[];
			potentialAction?: Action[];
		}
	}

	class Teams {
		/**
		 * Overwrite this function to skip slack message sending in some cnditions
		 * and log the message instead. By default skips in test environment
		 */
		static logCondition: () => boolean;
		/** default channel to use, (default: 'default') */
		static defaultChannel: string;

		constructor(init?: {text?: string, channel?: string});
		username(name: string): this;
		icon(linkOrEmoji: string): this;
		channel(channel: string): this;
		summary(summary: string): this;
		/** @param color Hex Code */
		color(color: string): this;
		title(title: string): this;
		text(text: string): this;
		section(sections: TeamsTypes.Section | TeamsTypes.Section[]): this;
		action(actions: TeamsTypes.Action | TeamsTypes.Action[]): this;
		/**
		 * Add a section with facts
		 * By default: ignores undefined values
		 */
		stats(
			title: string,
			statsKeyValue: {[statTitle: string]: string | number | boolean | object},
			opts?: {ignoreUndefined?: boolean}
		): this;
		/**
		 * Creates an error as MessageCard
		 * Also automatically adds a button to create issue,
		 * if a `bugs.url` property exists in package.json
		 */
		error(err: Error, opts?: {label?: string, title?: string}): this;
		button(text: string, url: string): this;
		send(opts?: {defaultAttachment?: boolean}): Promise<void>;

		static postMessage(message: TeamsTypes.MessageCard, opts?: {
			channel?: string;
			/** default `true` */
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
		/** @param channel default: `Teams.defaultChannel` */
		static setWebhook(webhook: string, channel?: string): void;
	}

	export default Slack;

	export {
		MessageAttachment,
		AttachmentAction,
		TeamsTypes,
		Teams,
	};
}

