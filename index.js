const Slack = require('./slack');
const Teams = require('./teams');
const cfg = require('sm-utils').cfg;

function selectDefault() {
	switch (cfg('notify', '')) {
		case 'teams': return Teams;
		default: return Slack;
	}
}

module.exports = {
	__esModule: true,
	default: selectDefault(),
	Slack,
	Teams,
};
