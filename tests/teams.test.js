const Teams = require('../teams');

Teams.setWebhook('<webhook_url_for_test_channel>', 'test');

new Teams({channel: 'test'})
	.error(new Error('test'), {label: 'ErrorTest', title: 'Error Test'})
	.send();
/*
	Expected MessageCard = {
		title: 'Error: test',
		themeColor: 'F00',
		text: 'Error: test\n\n&nbsp;&nbsp;at Test:1:1',
		potentialAction: [{
			'@type': 'OpenUriAction',
			name: 'Create an issue for this error?',
			targets: [{os: 'default', uri: 'bugs_link'}]
		}]
	}
*/

new Teams({channel: 'test'})
	.text(`User ${Teams.format('user@host')} deployed ${Teams.format('app v0.0.0')} `)
	.send();
/*
	Expected MessageCard = {
		text: 'User **user@host** deployed **app v0.0.0**',
		activityTitle: 'App Info:',
		activitySubtitle: 'name v0.0.0 | 19/7/2019, 2:04:57 pm',
		facts: [
			{name: 'Hostname', value: '<hostname>'},
			{name: 'Node Environment', value: '<env>'},
		]
	}
 */



new Teams({channel: 'test'})
	.summary('test')
	.color('#0F0') // green
	.attachment({
		activityImage: 'img_url',
		activityTitle: Teams.formatUrl('url', 'user'),
		text:
		`Good job ${Teams.formatUrl('url', 'user')}!\n\n` +
		`Build ${Teams.formatUrl('build_url', 'build')} on branch ${Teams.formatUrl('branch_url', Teams.format('branch', {code: true}))}`,
	})
	.button('Test Report', 'report_url')
	.button('Coverate Report', 'report_url')
	.send({defaultAttachment: false});
/*
	Expected MessageCard = {
		summary: 'test',
		themeColor: '0F0',
		sections: [{
			activityImage: 'img_url',
			activityTitle: '[user](url)',
			text: 'Good job [user](url)!\n\n&nbsp;\n\nBuild [build](build_url) on branch [`branch`](branch_url)',
		}],
		potentialAction: [
			{
				'@type': 'OpenUriAction',
				name: 'Test Report',
				targets: [{os: 'default', uri: 'report_url'}],
			},
			{
				'@type': 'OpenUriAction',
				name: 'Coverage Report',
				targets: [{os: 'default', uri: 'report_url'}],
			}
		]
	} 
 */



new Teams({channel: 'test'})
	.text(`${Teams.formatUrl('user_link', 'user')} scheduled a push at <time>`)
	.button('Edit Push', 'edit_link')
	.stats('Mediums:', {appPush: true, webPush: true})
	.stats('Details:', {
		title: 'title',
		link: Teams.formatUrl('link', 'link'),
		message: 'message',
	})
	.send({defaultAttachment: false});
/*
	Expected MessageCard = {
		text: '[user](user_link) scheduled a push at <time>',
		sections: [
			{
				title: 'Mediums:',
				facts: [
					{name: 'App Push', value: 'true'},
					{name: 'Web Push', value: 'true'}
				]
			},
			{
				title: 'Details:',
				facts: [
					{name: 'Title', value: 'title'},
					{name: 'Link', value: '[link](link)'},
					{name: 'Message', value: 'message'}
				]
			}
		],
		potentialAction: [{
			'@type': 'OpenUriAction',
			name: 'Edit Push',
			targets: [{os: 'default', uri: 'edit_link'}]
		}]
	}
*/
