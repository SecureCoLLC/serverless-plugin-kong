const chai = require('chai');
const dirtyChai = require('dirty-chai');

const httpHelper = require('../../http-helper');

chai.use(dirtyChai);

const { expect } = chai;

// Helper function to handle exceptions with promise/async. Chai throw assertion is not working with promise/async.
const asyncThrowAssertion = async (fn, expectedMessage) => {
    if (!fn || typeof fn !== 'function') {
        throw new Error(`This is not a function ${fn}`);
    }

    let errorMessage;

    await fn().catch(e => {
        errorMessage = (e && e.message) || e;
    });

    expect(() => {
        if (errorMessage) {
            throw new Error(errorMessage);
        }
    }).to.throw(expectedMessage);
};

describe('Helper module - HttpHelper', () => {
    it('should return value', async () => {
        const result = await httpHelper.request({ url: 'http://mockbin.com', data: { test: 'test' } });
        expect(result.statusCode).to.equal(200);
    });

    it('should throw an exception with invalid request', async () => {
        await asyncThrowAssertion(() => httpHelper.request({ url: 'http://google.com', method: 'post', data: { test: 'test' } }), '{"statusCode":405');
    });

    it('should throw an exception with bad url', async () => {
        await asyncThrowAssertion(() => httpHelper.request({ url: 'http://unkonw.tet', method: 'post', data: { test: 'test' } }), 'ENOTFOUND');
    });

    it('should throw an exception with invalid url', async () => {
        await asyncThrowAssertion(() => httpHelper.request({ url: '//mockbin.com', data: [] }), 'Invalid URL');
    });
});
