require.config({
    shim: {
        shimmed: ['somethingElse']
    }
});

require([
    'shimmed',
    'amdDependency',
    'tpl!view/template.ko',
    'less!view/styles.less'
], function (shimmedDependency, amdDependency) {
    alert(TR('greeting', 'Hello!'));
});
