const chai = require('chai');
const dirtyChai = require('dirty-chai');

const httpHelper = require('../../http-helper');

chai.use(dirtyChai);

const { expect } = chai;

const chaiHelper = require('../chai-helper');

describe('Helper module - HttpHelper', () => {
    it('should return value', async () => {
        const result = await httpHelper.request({ url: 'http://mockbin.com', data: { test: 'test' } });
        expect(result.statusCode).to.equal(200);
    });

    it('should throw an exception with invalid request', async () => {
        await chaiHelper.asyncThrowAssertion(() => httpHelper.request({ url: 'http://google.com', method: 'post', data: { test: 'test' } }), '{"statusCode":405');
    });

    it('should throw an exception with bad url', async () => {
        await chaiHelper.asyncThrowAssertion(() => httpHelper.request({ url: 'http://unkonw.tet', method: 'post', data: { test: 'test' } }), 'ENOTFOUND');
    });

    it('should throw an exception with invalid url', async () => {
        await chaiHelper.asyncThrowAssertion(() => httpHelper.request({ url: '//mockbin.com', data: [] }), 'Invalid URL');
    });
});
