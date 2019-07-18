const Slack = require('./slack');
const Teams = require('./teams');

module.exports = {
	default: Slack,
	Slack,
	Teams,
};
