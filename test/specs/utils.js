const chai = require('chai');
const dirtyChai = require('dirty-chai');

const utils = require('../../utils');

chai.use(dirtyChai);

const { expect } = chai;

describe('Helper module - Utils', () => {
    it('should return "null" if input params are not passed', () => {
        const result = utils.buildRouteConfig();
        expect(result).to.equal(null);
    });

    it('should return "null" if input params are not passed', () => {
        const result = utils.resolvePath();
        expect(result).to.equal(null);
    });

    it('should return the input value if it is absolute path', () => {
        const absolutePath = '/home/ubuntu';
        const result = utils.resolvePath(absolutePath);
        expect(result).to.equal(absolutePath);
    });

    it('should return home directory', () => {
        const homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
        const result = utils.resolvePath('~');
        expect(result).to.equal(homeDir);
    });

    it('should throw an exception if filePath is invalid', () => {
        expect(() => utils.readJsonFile('')).to.throw('Invalid file path');
    });
});
