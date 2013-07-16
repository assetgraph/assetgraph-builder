var vows = require('vows'),
    assert = require('assert'),
    i18nTools = require('../lib/i18nTools');

function createTestCase(inputStr, expectedOutputObj) {
    return {
        topic: i18nTools.tokenizePattern(inputStr),
        'should return the expected result': function (topic) {
            assert.deepEqual(topic, expectedOutputObj);
        }
    };
}

vows.describe('i18nTools').addBatch({
    'simple text': createTestCase('foo bar', [{type: 'text', value: 'foo bar'}]),
    'backslash': createTestCase('foo \\ bar', [{type: 'text', value: 'foo \\ bar'}]),
    'place holder': createTestCase('foo {1} bar', [{type: 'text', value: 'foo '}, {type: 'placeHolder', value: 1}, {type: 'text', value: ' bar'}]),
    'curly bracket but no place holder': createTestCase('foo { bar', [{type: 'text', value: 'foo { bar'}]),
    'curly bracket and number but no place holder': createTestCase('foo {5 bar', [{type: 'text', value: 'foo {5 bar'}])
})['export'](module);
