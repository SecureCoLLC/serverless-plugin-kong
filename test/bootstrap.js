const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);


global.bootstrap = {
    init: done => {
        global.expect = chai.expect;
        done();
    },

    teardown: done => {
        delete global.expect;
        done();
    }
};
