/*global describe, it*/
var unexpected = require('./unexpected-with-plugins'),
    i18nTools = require('../lib/i18nTools');

describe('i18nTools', function () {
    var expect = unexpected.clone().addAssertion('to tokenize as', function (expect, subject, value) {
        expect(i18nTools.tokenizePattern(subject), 'to equal', value);
    });

    describe('#tokenizePattern()', function () {
        it('should recognize a simple text as one text token', function () {
            expect('foo bar', 'to tokenize as', [{type: 'text', value: 'foo bar'}]);
        });

        it('should allow backslash in text tokens', function () {
            expect('foo \\ bar', 'to tokenize as', [{type: 'text', value: 'foo \\ bar'}]);
        });

        it('should recognize a placeholder', function () {
            expect('foo {1} bar', 'to tokenize as', [{type: 'text', value: 'foo '}, {type: 'placeHolder', value: 1}, {type: 'text', value: ' bar'}]);
        });

        it('should support curly brace followed by non-number in text tokens', function () {
            expect('foo { bar', 'to tokenize as', [{type: 'text', value: 'foo { bar'}]);
        });

        it('should support curly brace followed by number followed by non-curly end brace in text tokens', function () {
            expect('foo {5 bar', 'to tokenize as', [{type: 'text', value: 'foo {5 bar'}]);
        });

        it('should work even with a space at the end of a string', function () {
            expect('foo bar ', 'to tokenize as', [{type: 'text', value: 'foo bar '}]);
        });
    });
});
