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

module.exports = {
	getPackageInfo,
	getLogger,
};
