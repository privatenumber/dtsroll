import { describe } from 'manten';

describe('dtsroll', ({ runTestSuite }) => {
	runTestSuite(import('./spec/utils.js'));
	runTestSuite(import('./spec/cli.js'));
	runTestSuite(import('./spec/node.js'));
	runTestSuite(import('./spec/vite.js'));
});
