require([
    'shimmed',
    'amdDependency',
    'less!view/styles.less'
], function (shimmedDependency, amdDependency) {
    alert(TR('greeting', 'Hello!'));
});
