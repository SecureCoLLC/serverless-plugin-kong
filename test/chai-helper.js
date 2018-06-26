const chai = require('chai');
const dirtyChai = require('dirty-chai');

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

module.exports = {
    asyncThrowAssertion
};
